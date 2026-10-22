import { supabase } from "@/integrations/supabase/client";

/** Même valeur que public.subscription_grace_interval() côté base : délai entre l'échéance et la fermeture. */
export const SUBSCRIPTION_GRACE_DAYS = 3;
/** Rappel de renouvellement affiché à partir de ce nombre de jours avant l'échéance. */
export const SUBSCRIPTION_REMINDER_DAYS = 5;

/** Tarifs mensuels de renouvellement (mêmes montants que supabase/functions/_shared/pricing.ts, PLAN_PRICES). */
const MONTHLY_PRICES: Record<string, number> = {
  starter: 12000,
  pro_monthly: 12000,
  premium_academy_pro: 35000,
};

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
  const graceEndsAt = valid ? new Date(activeUntil!.getTime() + SUBSCRIPTION_GRACE_DAYS * DAY_MS) : null;
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
    renewalAmount: MONTHLY_PRICES[plan] ?? null,
  };
}

/** Démarre le paiement d'un mois d'abonnement pour la boutique et retourne l'URL de paiement. */
export async function startShopSubscriptionPayment(shopId: string, plan: string): Promise<string> {
  const amount = MONTHLY_PRICES[plan];
  if (!amount) throw new Error("Formule inconnue : choisissez votre formule depuis la page des tarifs.");
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
