import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Grilles d'abonnement et réglages de commission : réglés par le fondateur (menu « Abonnements & commissions »),
 * stockés dans `subscription_plans` et `billing_settings` (migration 20261107100000).
 * Les valeurs ci-dessous ne servent que de REPLI quand la base n'a pas ces tables (migration pas encore appliquée)
 * ou n'est pas joignable : elles reprennent les anciens montants codés en dur.
 */

export interface SubscriptionPlan {
  code: string;
  name: string;
  description: string | null;
  badge: string | null;
  price_monthly: number;
  price_annual: number | null;
  /** Nombre de boutiques couvertes (0 commission). null = inconnu (repli sans base). */
  max_shops: number | null;
  ai_video_quota: number;
  ai_image_quota: number;
  features: string[];
  is_active: boolean;
  is_public: boolean;
  sort_order: number;
}

export interface BillingSettings {
  commission_per_order: number;
  commission_threshold: number;
  payment_deadline_days: number;
  subscription_grace_days: number;
  subscription_reminder_days: number;
}

export const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  commission_per_order: 50,
  commission_threshold: 12000,
  payment_deadline_days: 3,
  subscription_grace_days: 3,
  subscription_reminder_days: 5,
};

export const FALLBACK_PLANS: SubscriptionPlan[] = [
  {
    code: "starter", name: "Starter", description: "Formule historique, renouvellement mensuel.", badge: null,
    price_monthly: 12000, price_annual: null, max_shops: null, ai_video_quota: 0, ai_image_quota: 0, features: [],
    is_active: true, is_public: false, sort_order: 0,
  },
  {
    code: "pro_monthly", name: "Ecomfy Pro", description: "Pour les e-commerçants actifs voulant zéro commission et un domaine propre.", badge: "POPULAIRE",
    price_monthly: 12000, price_annual: 118800, max_shops: null, ai_video_quota: 10, ai_image_quota: 20,
    features: [
      "Zéro commission sur vos ventes (0 FCFA)", "Domaine personnalisé (.com, .net)", "10 vidéos animées IA par mois",
      "20 images HD studio IA par mois", "Support prioritaire WhatsApp 24/7",
    ],
    is_active: true, is_public: true, sort_order: 10,
  },
  {
    code: "premium_academy_pro", name: "Premium Académie & VIP", description: "Masterclasses vidéo, vidéos et images IA, communauté.", badge: "OFFRE MEMBRE VIP",
    price_monthly: 35000, price_annual: 342000, max_shops: null, ai_video_quota: 20, ai_image_quota: 40,
    features: [
      "Masterclasses vidéo Académie Ecomfy", "Jusqu'à 20 vidéos animées IA / mois", "Jusqu'à 40 images HD studio IA / mois",
      "Accès VIP à la Communauté Marchands", "Zéro commission sur vos ventes (0 FCFA)", "Support prioritaire VIP WhatsApp 24/7",
    ],
    is_active: true, is_public: true, sort_order: 20,
  },
];

export interface MyShopCoverage {
  authenticated: boolean;
  subscription_active?: boolean;
  plan_code?: string | null;
  plan_name?: string | null;
  max_shops?: number | null;
  active_until?: string | null;
  commission_per_order?: number;
  /** covered : abonnement en cours sur cette boutique ; within_plan : son rang tient dans les boutiques incluses du plan. */
  shops?: Array<{ id: string; business_name: string | null; covered: boolean; within_plan?: boolean }>;
}

// Les nouvelles tables ne sont pas (encore) dans src/integrations/supabase/types.ts : appels non typés.
const db = supabase as unknown as SupabaseClient;

const asText = (v: unknown): string | null => (typeof v === "string" ? v : null);
const asInt = (v: unknown): number | null =>
  v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);

function normalizePlan(row: Record<string, unknown>): SubscriptionPlan {
  return {
    code: String(row.code),
    name: asText(row.name) || String(row.code),
    description: asText(row.description),
    badge: asText(row.badge),
    price_monthly: asInt(row.price_monthly) ?? 0,
    price_annual: asInt(row.price_annual),
    max_shops: asInt(row.max_shops),
    ai_video_quota: asInt(row.ai_video_quota) ?? 0,
    ai_image_quota: asInt(row.ai_image_quota) ?? 0,
    features: Array.isArray(row.features) ? row.features.map(String) : [],
    is_active: row.is_active !== false,
    is_public: row.is_public !== false,
    sort_order: asInt(row.sort_order) ?? 0,
  };
}

/** Tous les plans visibles par l'appelant (les fondateurs voient aussi les plans désactivés). */
export async function fetchSubscriptionPlans(): Promise<{ plans: SubscriptionPlan[]; fromDb: boolean }> {
  try {
    const { data, error } = await db.from("subscription_plans").select("*").order("sort_order", { ascending: true });
    if (error || !Array.isArray(data) || data.length === 0) return { plans: FALLBACK_PLANS, fromDb: false };
    return { plans: (data as Array<Record<string, unknown>>).map(normalizePlan), fromDb: true };
  } catch {
    return { plans: FALLBACK_PLANS, fromDb: false };
  }
}

export async function fetchBillingSettings(): Promise<BillingSettings> {
  try {
    const { data, error } = await db.from("billing_settings").select("key, value");
    if (error || !Array.isArray(data)) return DEFAULT_BILLING_SETTINGS;
    const out: Record<string, number> = { ...DEFAULT_BILLING_SETTINGS };
    for (const row of data as Array<{ key: string; value: unknown }>) {
      const n = Number(row.value);
      if (row.key in out && Number.isFinite(n)) out[row.key] = n;
    }
    return out as unknown as BillingSettings;
  } catch {
    return DEFAULT_BILLING_SETTINGS;
  }
}

export async function fetchMyShopCoverage(): Promise<MyShopCoverage | null> {
  try {
    const { data, error } = await db.rpc("get_my_shop_coverage");
    if (error || !data || (data as MyShopCoverage).authenticated === false) return null;
    return data as MyShopCoverage;
  } catch {
    return null;
  }
}

/**
 * Boutique fermée pour abonnement échu mais hors des boutiques incluses du plan : la repasse à la commission.
 * Retourne 'released', 'covered' (rien à faire), ou lève une erreur.
 */
export async function releaseShopToCommission(shopId: string): Promise<"released" | "covered"> {
  const { data, error } = await db.rpc("release_shop_to_commission", { _shop_id: shopId });
  if (error || (data !== "released" && data !== "covered")) {
    throw new Error(error?.message || "Impossible de repasser cette boutique à la commission.");
  }
  return data;
}

/** Plans proposés à la vente sur la page des tarifs. */
export function publicPlans(plans: SubscriptionPlan[]): SubscriptionPlan[] {
  return plans
    .filter((p) => p.is_active && p.is_public)
    .sort((a, b) => a.sort_order - b.sort_order || a.price_monthly - b.price_monthly);
}

export const formatFcfa = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));

/** Prix mensuel équivalent d'une formule annuelle (arrondi), null si le plan n'a pas de formule annuelle. */
export function annualMonthlyEquivalent(plan: Pick<SubscriptionPlan, "price_annual">): number | null {
  return plan.price_annual ? Math.round(plan.price_annual / 12) : null;
}

/** Économie annuelle en % par rapport à 12 mois au tarif mensuel. */
export function annualSavingsPercent(plan: Pick<SubscriptionPlan, "price_monthly" | "price_annual">): number {
  if (!plan.price_annual || !plan.price_monthly) return 0;
  return Math.max(0, Math.round((1 - plan.price_annual / (plan.price_monthly * 12)) * 100));
}

/** « 3 boutiques incluses », ou null si la limite est inconnue. */
export function shopsIncludedLabel(maxShops: number | null | undefined): string | null {
  if (maxShops === null || maxShops === undefined) return null;
  if (maxShops <= 0) return "Aucune boutique incluse";
  return maxShops === 1 ? "1 boutique incluse" : `${maxShops} boutiques incluses`;
}

/** Montant à envoyer à process-payment pour une période. null si le plan n'a pas de formule annuelle. */
export function planChargeAmount(plan: Pick<SubscriptionPlan, "price_monthly" | "price_annual">, annual: boolean): number | null {
  return annual ? plan.price_annual : plan.price_monthly;
}
