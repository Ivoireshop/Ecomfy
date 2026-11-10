import { supabase } from "@/integrations/supabase/client";
import { fetchSubscriptionPlans, type SubscriptionPlan } from "@/lib/subscriptionPlans";
import {
  buildChart,
  chartDays,
  computeMrr,
  consolidatePayments,
  periodBounds,
  UNKNOWN_EMAIL,
  type RawCommissionPayment,
  type RawPayment,
  type TimeRangeFilter,
  type TransactionDetail,
} from "@/lib/founderMetrics";

export type { TimeRangeFilter, TransactionDetail } from "@/lib/founderMetrics";

export interface ActivatedShopDetail {
  id: string;
  name: string;
  slug: string;
  user_id: string;
  owner_email: string;
  /** Date du paiement d'activation ; null si la boutique est activée sans paiement enregistré. */
  activation_date: string | null;
  /** Montant réellement encaissé ; null si aucun paiement d'activation n'est enregistré pour cette boutique. */
  activation_fee: number | null;
  transaction_reference: string | null;
  is_activated: boolean;
}

export interface SubscriptionDetail {
  id: string;
  user_id: string;
  user_email: string;
  shop_name: string | null;
  plan_name: string;
  /** Équivalent mensuel en FCFA ; 0 quand `priced` est faux. */
  monthly_amount: number;
  /** Faux quand le plan n'a pas de tarif connu : abonnement compté, mais non valorisé dans le MRR. */
  priced: boolean;
  status: string;
  start_date: string | null;
  end_date?: string | null;
}

export interface PayingClientDetail {
  user_id: string;
  user_email: string;
  total_spent: number;
  payments_count: number;
  first_payment_date: string;
  last_payment_date: string;
}

export interface FinancialMetrics {
  cumulativeRevenue: number;
  mrr: number;
  /** Boutiques activées depuis le lancement (toutes périodes). */
  activatedStoresCount: number;
  payingUsersCount: number;
  activeSubscriptionsCount: number;
  /** Abonnements actifs dont le plan n'a pas de tarif connu (non valorisés dans le MRR). */
  unpricedSubscriptionsCount: number;
  totalUsersCount: number;
  completedPaymentsCount: number;
  pendingPaymentsCount: number;
  /** Paiements validés de la période exclus du chiffre d'affaires (devise sans parité fixe, date absente). */
  excludedPaymentsCount: number;
  validatedTransactions: TransactionDetail[];
  activatedShops: ActivatedShopDetail[];
  subscriptions: SubscriptionDetail[];
  payingClients: PayingClientDetail[];
}

export interface RevenueChartPoint {
  /** Libellé du jour, ex. « 05 nov. ». */
  date: string;
  revenue: number;
  signups: number;
}

// ---------------------------------------------------------------------------------------------------------------
// Lecture de la base
// ---------------------------------------------------------------------------------------------------------------

const PAGE_SIZE = 1000;
const MAX_PAGES = 100;
const CACHE_TTL_MS = 5000;

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

/**
 * Lit toutes les lignes, page par page : une requête simple s'arrête à 1000 lignes sans prévenir, ce qui ferait
 * afficher des totaux tronqués. Une erreur de lecture est toujours remontée (jamais remplacée par « 0 »).
 */
async function fetchAllRows<T>(
  label: string,
  page: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data, error } = await page(i * PAGE_SIZE, (i + 1) * PAGE_SIZE - 1);
    if (error) throw new Error(`Lecture de ${label} impossible : ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
  throw new Error(`Lecture de ${label} interrompue : trop de lignes.`);
}

interface RawData {
  profiles: { id: string; email: string; created_at: string }[];
  payments: RawPayment[];
  /** Règlements de commission (en ligne et enregistrés à la main). Les manuels n'ont pas de ligne dans `payments`. */
  commissionPayments: RawCommissionPayment[];
  subscriptions: {
    id: string; user_id: string; amount: number | null; status: string | null;
    start_date: string | null; end_date: string | null; created_at: string | null;
  }[];
  shops: {
    id: string; business_name: string | null; slug: string | null; user_id: string;
    is_activated: boolean | null; activation_fee_paid: boolean | null;
    subscription_plan: string | null; subscription_active_until: string | null; subscription_started_at: string | null;
    created_at: string;
  }[];
  plans: SubscriptionPlan[];
}

async function loadRaw(): Promise<RawData> {
  const [profiles, payments, commissionPayments, subscriptions, shops, plans] = await Promise.all([
    fetchAllRows("les comptes", (from, to) =>
      supabase.from("profiles").select("id, email, created_at").order("created_at").order("id").range(from, to)),
    fetchAllRows("les paiements", (from, to) =>
      supabase.from("payments")
        .select("id, user_id, amount, currency, status, payment_method, created_at, transaction_id, metadata")
        .order("created_at").order("id").range(from, to)),
    fetchAllRows("les règlements de commission", (from, to) =>
      supabase.from("commission_payments")
        .select("id, shop_id, amount, payment_method, transaction_reference, status, created_at")
        .order("created_at").order("id").range(from, to)),
    fetchAllRows("les abonnements", (from, to) =>
      supabase.from("subscriptions")
        .select("id, user_id, amount, status, start_date, end_date, created_at")
        .order("created_at").order("id").range(from, to)),
    fetchAllRows("les boutiques", (from, to) =>
      supabase.from("shops")
        .select("id, business_name, slug, user_id, is_activated, activation_fee_paid, subscription_plan, subscription_active_until, subscription_started_at, created_at")
        .order("created_at").order("id").range(from, to)),
    fetchSubscriptionPlans(),
  ]);
  return { profiles, payments, commissionPayments, subscriptions, shops, plans: plans.plans };
}

/** Règlements de commission avec le propriétaire de chaque boutique (pour les rattacher à un client). */
function commissionOf(raw: RawData) {
  const ownerByShop = new Map(raw.shops.map(s => [s.id, s.user_id]));
  return { rows: raw.commissionPayments, ownerOfShop: (shopId: string) => ownerByShop.get(shopId) };
}

/**
 * Service unique des indicateurs financiers de la console fondateur. Les règles de calcul sont dans
 * `@/lib/founderMetrics` (pures, testées) ; ici on ne fait que lire la base. Aucun montant n'est estimé :
 * ce qui est inconnu reste inconnu (null, « non valorisé »).
 */
export class FinancialMetricsService {
  private static cache: { at: number; promise: Promise<RawData> } | null = null;

  /** À appeler avant un rechargement explicite : les appels qui suivent relisent la base. */
  public static invalidate(): void {
    this.cache = null;
  }

  /** Les cartes, le graphique et les listes d'un même écran partagent une seule lecture. */
  private static getRaw(): Promise<RawData> {
    const now = Date.now();
    if (!this.cache || now - this.cache.at > CACHE_TTL_MS) {
      const promise = loadRaw();
      this.cache = { at: now, promise };
      promise.catch(() => {
        if (this.cache?.promise === promise) this.cache = null;
      });
    }
    return this.cache.promise;
  }

  public static async fetchFinancialMetrics(timeRange: TimeRangeFilter = "all"): Promise<FinancialMetrics> {
    const raw = await this.getRaw();
    const bounds = periodBounds(timeRange);

    const emailMap = new Map(raw.profiles.map(p => [p.id, p.email]));
    const emailOf = (id: string) => emailMap.get(id);

    const consolidated = consolidatePayments(raw.payments, emailOf, bounds, commissionOf(raw));

    // MRR : abonnements en cours à cet instant, indépendants de la période affichée.
    const mrrResult = computeMrr(raw.shops, raw.subscriptions, raw.plans);
    const subscriptions: SubscriptionDetail[] = mrrResult.items.map(i => ({
      id: i.id,
      user_id: i.user_id,
      user_email: emailOf(i.user_id) || UNKNOWN_EMAIL,
      shop_name: i.shop_name,
      plan_name: i.plan_name,
      monthly_amount: i.monthly_amount,
      priced: i.priced,
      status: "active",
      start_date: i.start_date,
      end_date: i.end_date,
    }));

    // Boutiques activées depuis le lancement ; montant, date et référence viennent du paiement de CETTE boutique.
    const activatedShops: ActivatedShopDetail[] = [];
    for (const shop of raw.shops) {
      const tx = consolidated.activationByShop.get(shop.id);
      if (!(shop.is_activated || shop.activation_fee_paid || tx)) continue;
      activatedShops.push({
        id: shop.id,
        name: shop.business_name || "Boutique sans nom",
        slug: shop.slug || "",
        user_id: shop.user_id,
        owner_email: emailOf(shop.user_id) || UNKNOWN_EMAIL,
        activation_date: tx?.created_at ?? null,
        activation_fee: tx?.amount ?? null,
        transaction_reference: tx?.reference ?? null,
        is_activated: true,
      });
    }

    // Clients payants de la période
    const clients = new Map<string, PayingClientDetail>();
    for (const tx of consolidated.transactions) {
      const c = clients.get(tx.user_id);
      if (!c) {
        clients.set(tx.user_id, {
          user_id: tx.user_id,
          user_email: tx.user_email || UNKNOWN_EMAIL,
          total_spent: tx.amount,
          payments_count: 1,
          first_payment_date: tx.created_at,
          last_payment_date: tx.created_at,
        });
        continue;
      }
      c.total_spent += tx.amount;
      c.payments_count += 1;
      if (new Date(tx.created_at) < new Date(c.first_payment_date)) c.first_payment_date = tx.created_at;
      if (new Date(tx.created_at) > new Date(c.last_payment_date)) c.last_payment_date = tx.created_at;
    }
    const payingClients = [...clients.values()].sort((a, b) => b.total_spent - a.total_spent);

    return {
      cumulativeRevenue: consolidated.revenue,
      mrr: mrrResult.mrr,
      activatedStoresCount: activatedShops.length,
      payingUsersCount: payingClients.length,
      activeSubscriptionsCount: mrrResult.items.length,
      unpricedSubscriptionsCount: mrrResult.unpricedCount,
      totalUsersCount: raw.profiles.length,
      completedPaymentsCount: consolidated.completedCount,
      pendingPaymentsCount: consolidated.pendingCount,
      excludedPaymentsCount: consolidated.excludedCount,
      validatedTransactions: consolidated.transactions,
      activatedShops,
      subscriptions,
      payingClients,
    };
  }

  /**
   * Revenus et inscriptions par jour local sur 7, 30 ou 90 jours (30 par défaut), exclusivement à partir des
   * paiements validés et des comptes réels. Chaque barre correspond à un jour de la fenêtre des cartes.
   */
  public static async fetchChartData(timeRange: TimeRangeFilter = "30d"): Promise<RevenueChartPoint[]> {
    const days = chartDays(timeRange);
    const raw = await this.getRaw();
    const emailMap = new Map(raw.profiles.map(p => [p.id, p.email]));
    const { transactions } = consolidatePayments(
      raw.payments, id => emailMap.get(id), periodBounds(`${days}d` as TimeRangeFilter), commissionOf(raw)
    );
    return buildChart(transactions, raw.profiles.map(p => p.created_at), days).map(p => ({
      date: p.date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
      revenue: p.revenue,
      signups: p.signups,
    }));
  }
}
