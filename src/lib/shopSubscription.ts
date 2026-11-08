import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_BILLING_SETTINGS, FALLBACK_PLANS, fetchBillingSettings, fetchSubscriptionPlans } from "@/lib/subscriptionPlans";

/** Valeurs de repli : délai de grâce (public.subscription_grace_interval()) et rappel avant l'échéance. */
export const SUBSCRIPTION_GRACE_DAYS = DEFAULT_BILLING_SETTINGS.subscription_grace_days;
export const SUBSCRIPTION_REMINDER_DAYS = DEFAULT_BILLING_SETTINGS.subscription_reminder_days;

/**
 * Configuration en vigueur (réglée par le fondateur) : délai de grâce, rappel, tarifs mensuels de renouvellement.
 * Partie des anciennes valeurs, remplacée par loadBillingRuntimeConfig() (appelée par les écrans marchands) pour que
 * computeShopSubscription reste synchrone.
 */
const runtime = {
  graceDays: SUBSCRIPTION_GRACE_DAYS,
  reminderDays: SUBSCRIPTION_REMINDER_DAYS,
  monthlyPrices: Object.fromEntries(FALLBACK_PLANS.map((p) => [p.code, p.price_monthly])) as Record<string, number>,
  loadedAt: 0,
  inflight: null as Promise<void> | null,
};

export const getSubscriptionGraceDays = () => runtime.graceDays;
export const getSubscriptionReminderDays = () => runtime.reminderDays;

/** Charge (au plus une fois par minute) délai de grâce, rappel et tarifs depuis la base. N'échoue jamais. */
export function loadBillingRuntimeConfig(): Promise<void> {
  if (runtime.inflight) return runtime.inflight;
  if (Date.now() - runtime.loadedAt < 60_000) return Promise.resolve();
  runtime.inflight = (async () => {
    try {
      const [settings, { plans, fromDb }] = await Promise.all([fetchBillingSettings(), fetchSubscriptionPlans()]);
      runtime.graceDays = settings.subscription_grace_days;
      runtime.reminderDays = settings.subscription_reminder_days;
      if (fromDb) runtime.monthlyPrices = Object.fromEntries(plans.filter((p) => p.is_active).map((p) => [p.code, p.price_monthly]));
      runtime.loadedAt = Date.now();
    } catch {
      /* on garde les valeurs courantes */
    } finally {
      runtime.inflight = null;
    }
  })();
  return runtime.inflight;
}

const DAY_MS = 86_400_000;

export interface ShopSubscriptionState {
  plan: string;
  activeUntil: Date | null;
  /** La boutique a déjà eu un abonnement payant (plan autre que free et date de fin connue). */
  hasSubscribed: boolean;
  /** Abonnement en cours : seule la date de fin fait foi (comme côté base). */
  isActive: boolean;
  /** Échu, qu'on soit dans le délai de grâce ou après. */
  isExpired: boolean;
  /** Échu depuis moins de SUBSCRIPTION_GRACE_DAYS : la boutique reste ouverte, le renouvellement est demandé. */
  inGrace: boolean;
  graceEndsAt: Date | null;
  /** Jours entiers restants avant l'échéance (0 le dernier jour), null si pas d'abonnement en cours. */
  daysLeft: number | null;
  /** Montant du renouvellement mensuel, null si le plan est inconnu. */
  renewalAmount: number | null;
}

export function computeShopSubscription(shop: any): ShopSubscriptionState {
  const plan = String(shop?.subscription_plan || "free").toLowerCase();
  const raw = shop?.subscription_active_until;
  const activeUntil = raw ? new Date(raw) : null;
  const valid = !!activeUntil && !Number.isNaN(activeUntil.getTime());
  const hasSubscribed = valid && plan !== "free" && plan !== "starter_free";
  const now = Date.now();
  const isActive = valid && activeUntil!.getTime() > now;
  const isExpired = hasSubscribed && !isActive;
  const graceEndsAt = valid ? new Date(activeUntil!.getTime() + runtime.graceDays * DAY_MS) : null;
  const inGrace = isExpired && !!graceEndsAt && graceEndsAt.getTime() > now;
  return {
    plan,
    activeUntil: valid ? activeUntil : null,
    hasSubscribed,
    isActive: hasSubscribed && isActive,
    isExpired,
    inGrace,
    graceEndsAt: hasSubscribed ? graceEndsAt : null,
    daysLeft: hasSubscribed && isActive ? Math.floor((activeUntil!.getTime() - now) / DAY_MS) : null,
    renewalAmount: runtime.monthlyPrices[plan] ?? null,
  };
}

export type PricingPlanId = "starter_free" | "pro_monthly" | "premium_academy_pro";

/**
 * Formule de la page des tarifs qui correspond à un plan stocké. `starter` est l'ancien nom de Pro.
 * Premium est testé en premier : « premium_academy_pro » contient « pro ».
 */
export function pricingPlanIdFor(plan: string | null | undefined): PricingPlanId {
  const p = String(plan || "free").toLowerCase();
  if (p.includes("premium") || p.includes("vip") || p.includes("academy")) return "premium_academy_pro";
  if (p === "free" || p === "starter_free") return "starter_free";
  return "pro_monthly";
}

/**
 * Abonnement de compte sans boutique : la table `subscriptions` n'a pas de colonne de plan, seul le montant payé
 * (12 000 / 118 800 pour Pro, 35 000 / 342 000 pour Premium) permet de retrouver la formule.
 */
export function pricingPlanIdFromAmount(amount: number | null | undefined): PricingPlanId {
  const a = Number(amount) || 0;
  return a >= 300_000 || (a >= 30_000 && a < 100_000) ? "premium_academy_pro" : "pro_monthly";
}

/** Démarre le paiement d'un mois d'abonnement pour la boutique et retourne l'URL de paiement. */
export async function startShopSubscriptionPayment(shopId: string, plan: string): Promise<string> {
  // Prix du jour lu en base (le serveur le revérifie) ; repli sur la configuration chargée si la base ne répond pas.
  const { plans, fromDb } = await fetchSubscriptionPlans();
  const amount = fromDb
    ? plans.find((p) => p.code === plan && p.is_active)?.price_monthly
    : runtime.monthlyPrices[plan];
  if (!amount) throw new Error("Formule inconnue ou retirée de la vente : choisissez votre formule depuis la page des tarifs.");
  const { data: sess } = await supabase.auth.getUser();
  const userId = sess?.user?.id;
  if (!userId) throw new Error("Connectez-vous d'abord.");
  const { data, error } = await supabase.functions.invoke("process-payment", {
    body: { amount, user_id: userId, payment_type: "shop_subscription", plan, shop_id: shopId, billing_cycle: "monthly" },
  });
  if (error || !data?.success) {
    throw new Error(data?.error || error?.message || "Paiement non démarré. Réessayez dans un instant.");
  }
  const url = data.checkout_url || data.payment_url || data.url;
  if (!url) throw new Error("Lien de paiement non généré. Réessayez dans un instant.");
  return url as string;
}

/**
 * Demande au serveur de constater l'échéance de la boutique (taux de commission rétabli, fermeture après le délai de
 * grâce). La tâche planifiée le fait aussi ; ceci évite d'attendre son prochain passage. Sans effet si rien n'est dû.
 */
export async function enforceShopSubscriptionExpiry(shopId: string): Promise<string | null> {
  try {
    const { data, error } = await (supabase as any).rpc("enforce_subscription_expiry_for", { _shop_id: shopId });
    if (error) return null;
    return (data as string) ?? null;
  } catch {
    return null;
  }
}
