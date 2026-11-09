// Règles de calcul de la console fondateur : périodes, devises, paiements validés, MRR.
// Fonctions pures, sans accès réseau (testées dans founderMetrics.test.ts). Règle d'or : un montant inconnu reste
// inconnu (null, « tarif non renseigné ») au lieu d'être remplacé par une estimation.

import { localDayKey, toFcfa } from "@/lib/shopFinance";
import type { SubscriptionPlan } from "@/lib/subscriptionPlans";

export type TimeRangeFilter = "today" | "7d" | "30d" | "this_month" | "last_month" | "90d" | "12m" | "all";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Bornes d'une période, en jours calendaires locaux. « 7 jours » = aujourd'hui et les 6 jours précédents
 * (la même fenêtre que les 7 barres du graphique). `end` est exclusive ; null = pas de borne haute.
 */
export function periodBounds(range: TimeRangeFilter, now: Date = new Date()): { start: Date | null; end: Date | null } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  switch (range) {
    case "all": return { start: null, end: null };
    case "today": return { start: new Date(y, m, d), end: null };
    case "7d": return { start: new Date(y, m, d - 6), end: null };
    case "30d": return { start: new Date(y, m, d - 29), end: null };
    case "90d": return { start: new Date(y, m, d - 89), end: null };
    case "this_month": return { start: new Date(y, m, 1), end: null };
    case "last_month": return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
    case "12m": return { start: new Date(y - 1, m, d), end: null };
  }
}

export function isInRange(iso: string | null | undefined, bounds: { start: Date | null; end: Date | null }): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  if (bounds.start && t < bounds.start.getTime()) return false;
  if (bounds.end && t >= bounds.end.getTime()) return false;
  return true;
}

/** Nombre de barres du graphique pour une période : 7, 30 ou 90 jours (30 par défaut). */
export function chartDays(range: TimeRangeFilter): 7 | 30 | 90 {
  return range === "7d" ? 7 : range === "90d" ? 90 : 30;
}

export const isPaidStatus = (status: string | null | undefined): boolean =>
  ["completed", "paid", "success"].includes(String(status || "").toLowerCase());

export type TransactionType = "activation" | "subscription" | "commission" | "credits" | "payment";

export interface TransactionDetail {
  id: string;
  user_id: string;
  user_email?: string;
  /** Montant converti en FCFA. */
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  created_at: string;
  type: TransactionType;
  description?: string;
  reference?: string;
  /** Boutique visée (activation, abonnement), quand le paiement l'indique. */
  shop_id?: string | null;
}

export interface RawPayment {
  id: string;
  user_id: string;
  amount: number | string | null;
  currency?: string | null;
  status?: string | null;
  payment_method?: string | null;
  created_at: string | null;
  transaction_id?: string | null;
  metadata?: unknown;
}

/** Ligne de `commission_payments` : règlement de commission d'une boutique (en ligne ou enregistré à la main). */
export interface RawCommissionPayment {
  id: string;
  shop_id: string;
  amount: number | string | null;
  payment_method?: string | null;
  transaction_reference?: string | null;
  status?: string | null;
  created_at: string | null;
}

export const UNKNOWN_METHOD = "Non renseigné";
export const UNKNOWN_EMAIL = "Compte inconnu";

function classify(paymentType: unknown): TransactionType {
  switch (paymentType) {
    case "shop_activation": return "activation";
    case "shop_subscription":
    case "subscription": return "subscription";
    case "commission_payment": return "commission";
    case "credits": return "credits";
    default: return "payment";
  }
}

function describe(type: TransactionType, meta: Record<string, unknown>): string {
  switch (type) {
    case "activation": return "Activation de boutique";
    case "subscription": return meta.plan ? `Abonnement boutique (${String(meta.plan)})` : "Abonnement boutique";
    case "commission": return "Règlement de commission";
    case "credits": return "Achat de crédits IA";
    default: return "Paiement validé";
  }
}

export interface Consolidated {
  /** Paiements validés de la période, du plus récent au plus ancien. */
  transactions: TransactionDetail[];
  /** Tous les paiements d'activation validés (toutes périodes), par boutique : la dernière en date. */
  activationByShop: Map<string, TransactionDetail>;
  revenue: number;
  completedCount: number;
  pendingCount: number;
  /**
   * Paiements validés de la période qu'on ne peut pas chiffrer : devise sans parité fixe, ou date absente.
   * Exclus du chiffre d'affaires (jamais convertis ni datés à l'estime) et signalés à l'écran.
   */
  excludedCount: number;
}

/**
 * Réunit les paiements validés sur une période : table `payments`, puis les règlements de commission enregistrés à la
 * main. Ces derniers (apply_commission_payment) ne laissent aucune ligne dans `payments` ; les règlements en ligne,
 * eux, partagent la référence de leur ligne `payments`. Une ligne de commission n'est donc ajoutée que si sa référence
 * est absente de `payments` : jamais de double compte, et une ligne sans référence est ignorée (impossible à vérifier).
 * Les montants sont ramenés en FCFA ; une devise sans parité fixe est exclue et comptée à part.
 */
export function consolidatePayments(
  payments: RawPayment[],
  emailOf: (userId: string) => string | undefined,
  bounds: { start: Date | null; end: Date | null },
  commission?: { rows: RawCommissionPayment[]; ownerOfShop: (shopId: string) => string | undefined }
): Consolidated {
  const byId = new Map<string, TransactionDetail>();
  const activationByShop = new Map<string, TransactionDetail>();
  let revenue = 0;
  let completedCount = 0;
  let pendingCount = 0;
  let excludedCount = 0;

  for (const p of payments) {
    if (!p.created_at) {
      // Sans date, impossible de le placer dans une période.
      if (isPaidStatus(p.status)) excludedCount++;
      continue;
    }
    const createdAt = p.created_at;
    const inPeriod = isInRange(createdAt, bounds);
    if (isPaidStatus(p.status)) {
      const currency = String(p.currency || "XOF").toUpperCase();
      const amount = toFcfa(Number(p.amount), currency);
      if (amount === null) {
        if (inPeriod) excludedCount++;
        continue;
      }
      const meta = (p.metadata && typeof p.metadata === "object" ? p.metadata : {}) as Record<string, unknown>;
      const type = classify(meta.payment_type);
      const shopId = typeof meta.shop_id === "string" ? meta.shop_id : null;
      const tx: TransactionDetail = {
        id: p.id,
        user_id: p.user_id,
        user_email: emailOf(p.user_id) || UNKNOWN_EMAIL,
        amount,
        currency,
        status: p.status || "completed",
        payment_method: p.payment_method || UNKNOWN_METHOD,
        created_at: createdAt,
        type,
        description: describe(type, meta),
        reference: String(p.transaction_id || meta.gateway_reference || meta.order_id || p.id),
        shop_id: shopId,
      };
      if (type === "activation" && shopId) {
        const known = activationByShop.get(shopId);
        if (!known || new Date(tx.created_at) > new Date(known.created_at)) activationByShop.set(shopId, tx);
      }
      if (inPeriod) {
        byId.set(p.id, tx);
        completedCount++;
        revenue += amount;
      }
    } else if (inPeriod && String(p.status || "").toLowerCase() === "pending") {
      pendingCount++;
    }
  }

  // Références déjà présentes dans `payments` (tous statuts, toutes dates) : ces règlements y sont déjà comptés.
  const knownRefs = new Set<string>();
  for (const p of payments) {
    const meta = (p.metadata && typeof p.metadata === "object" ? p.metadata : {}) as Record<string, unknown>;
    for (const ref of [p.transaction_id, meta.gateway_reference, meta.order_id]) {
      if (typeof ref === "string" && ref.trim()) knownRefs.add(ref.trim());
    }
  }

  for (const c of commission?.rows ?? []) {
    if (!isPaidStatus(c.status)) continue;
    const ref = String(c.transaction_reference || "").trim();
    if (!ref || knownRefs.has(ref)) continue;
    if (!c.created_at) {
      excludedCount++;
      continue;
    }
    if (!isInRange(c.created_at, bounds)) continue;
    const amount = Number(c.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      excludedCount++;
      continue;
    }
    const owner = commission?.ownerOfShop(c.shop_id);
    const id = `commission-${c.id}`;
    byId.set(id, {
      id,
      // Sans propriétaire connu, le règlement reste rattaché à sa boutique plutôt qu'à un compte inventé.
      user_id: owner ?? `shop:${c.shop_id}`,
      user_email: (owner && emailOf(owner)) || UNKNOWN_EMAIL,
      amount,
      currency: "XOF",
      status: c.status || "paid",
      payment_method: c.payment_method || UNKNOWN_METHOD,
      created_at: c.created_at,
      type: "commission",
      description: "Règlement de commission (hors ligne)",
      reference: ref,
      shop_id: c.shop_id,
    });
    completedCount++;
    revenue += amount;
  }

  const transactions = [...byId.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return { transactions, activationByShop, revenue, completedCount, pendingCount, excludedCount };
}

// ---------------------------------------------------------------------------------------------------------------
// MRR
// ---------------------------------------------------------------------------------------------------------------

export interface ShopForMrr {
  id: string;
  business_name?: string | null;
  user_id: string;
  subscription_plan?: string | null;
  subscription_active_until?: string | null;
  subscription_started_at?: string | null;
}

export interface AccountSubForMrr {
  id: string;
  user_id: string;
  amount?: number | string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string | null;
}

export interface MrrItem {
  id: string;
  user_id: string;
  shop_id: string | null;
  shop_name: string | null;
  plan_code: string | null;
  plan_name: string;
  /** Équivalent mensuel en FCFA ; 0 quand `priced` est faux. */
  monthly_amount: number;
  /** Faux quand le plan n'a pas de tarif connu : l'abonnement est compté mais pas valorisé. */
  priced: boolean;
  start_date: string | null;
  end_date: string | null;
}

export interface MrrResult {
  mrr: number;
  items: MrrItem[];
  unpricedCount: number;
}

const FREE_PLANS = new Set(["", "free", "starter_free"]);
/** Au-delà de ce délai restant, l'abonnement est traité comme annuel (un cumul de renouvellements mensuels n'y arrive pas). */
const ANNUAL_THRESHOLD_DAYS = 120;
/** Même règle que apply_shop_subscription : un paiement d'au moins 100 000 FCFA est un paiement annuel. */
const ANNUAL_PAYMENT_THRESHOLD = 100000;

/**
 * MRR : somme, par propriétaire, de l'abonnement en cours (un propriétaire = un abonnement, même s'il couvre plusieurs
 * boutiques). Le tarif vient de la table des plans ; un plan inconnu est compté sans valeur, jamais estimé.
 * Un abonnement annuel compte pour 1/12 de son prix annuel. Le tarif utilisé est le tarif ACTUEL du plan.
 */
export function computeMrr(
  shops: ShopForMrr[],
  subscriptions: AccountSubForMrr[],
  plans: SubscriptionPlan[],
  now: Date = new Date()
): MrrResult {
  const planByCode = new Map(plans.map(p => [p.code.toLowerCase(), p]));
  const best = new Map<string, MrrItem>();

  const consider = (item: MrrItem) => {
    const cur = best.get(item.user_id);
    if (
      !cur ||
      (item.priced && !cur.priced) ||
      (item.priced === cur.priced && item.monthly_amount > cur.monthly_amount)
    ) {
      best.set(item.user_id, item);
    }
  };

  for (const s of shops) {
    const code = String(s.subscription_plan || "").trim().toLowerCase();
    if (FREE_PLANS.has(code)) continue;
    const until = s.subscription_active_until ? new Date(s.subscription_active_until) : null;
    if (!until || Number.isNaN(until.getTime()) || until.getTime() <= now.getTime()) continue;

    const plan = planByCode.get(code);
    const daysLeft = (until.getTime() - now.getTime()) / DAY_MS;
    const monthly = plan
      ? plan.price_annual && daysLeft > ANNUAL_THRESHOLD_DAYS
        ? Math.round(plan.price_annual / 12)
        : plan.price_monthly
      : 0;
    consider({
      id: `shop-sub-${s.id}`,
      user_id: s.user_id,
      shop_id: s.id,
      shop_name: s.business_name || null,
      plan_code: code,
      plan_name: plan ? plan.name : code,
      monthly_amount: monthly,
      priced: Boolean(plan),
      start_date: s.subscription_started_at || null,
      end_date: s.subscription_active_until || null,
    });
  }

  for (const sub of subscriptions) {
    if (String(sub.status || "").toLowerCase() !== "active") continue;
    const until = sub.end_date ? new Date(sub.end_date) : null;
    if (!until || Number.isNaN(until.getTime()) || until.getTime() <= now.getTime()) continue;
    const paid = Number(sub.amount);
    if (!Number.isFinite(paid) || paid <= 0) continue;
    consider({
      id: sub.id,
      user_id: sub.user_id,
      shop_id: null,
      shop_name: null,
      plan_code: null,
      plan_name: "Abonnement du compte",
      monthly_amount: paid >= ANNUAL_PAYMENT_THRESHOLD ? Math.round(paid / 12) : paid,
      priced: true,
      start_date: sub.start_date || sub.created_at || null,
      end_date: sub.end_date || null,
    });
  }

  const items = [...best.values()].sort((a, b) => b.monthly_amount - a.monthly_amount);
  return {
    mrr: items.reduce((sum, i) => sum + i.monthly_amount, 0),
    items,
    unpricedCount: items.filter(i => !i.priced).length,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Graphique
// ---------------------------------------------------------------------------------------------------------------

export interface ChartPoint {
  /** Jour local AAAA-MM-JJ. */
  key: string;
  date: Date;
  revenue: number;
  signups: number;
}

/** Une barre par jour local sur `days` jours (aujourd'hui inclus). Les jours sont ceux de l'utilisateur, pas UTC. */
export function buildChart(
  transactions: Pick<TransactionDetail, "amount" | "created_at">[],
  signupDates: string[],
  days: number,
  now: Date = new Date()
): ChartPoint[] {
  const points: ChartPoint[] = Array.from({ length: days }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1 - i));
    return { key: localDayKey(date), date, revenue: 0, signups: 0 };
  });
  const index = new Map(points.map((p, i) => [p.key, i]));
  const keyOf = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : localDayKey(d);
  };
  for (const tx of transactions) {
    const k = keyOf(tx.created_at);
    const i = k === null ? undefined : index.get(k);
    if (i !== undefined) points[i].revenue += tx.amount;
  }
  for (const iso of signupDates) {
    const k = keyOf(iso);
    const i = k === null ? undefined : index.get(k);
    if (i !== undefined) points[i].signups++;
  }
  return points;
}
