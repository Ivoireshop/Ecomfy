import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_BILLING_SETTINGS,
  FALLBACK_PLANS,
  fetchBillingSettings,
  fetchMyShopCoverage,
  fetchSubscriptionPlans,
  type BillingSettings,
  type MyShopCoverage,
  type SubscriptionPlan,
} from "@/lib/subscriptionPlans";

export const PLANS_QUERY_KEY = ["subscription_plans"] as const;
export const BILLING_SETTINGS_QUERY_KEY = ["billing_settings"] as const;
export const MY_COVERAGE_QUERY_KEY = ["my_shop_coverage"] as const;

/** Plans d'abonnement (réglés par le fondateur). Repli sur les anciens montants tant que la base ne répond pas. */
export function useSubscriptionPlans() {
  const query = useQuery({ queryKey: PLANS_QUERY_KEY, queryFn: fetchSubscriptionPlans, staleTime: 60_000 });
  const plans: SubscriptionPlan[] = query.data?.plans ?? FALLBACK_PLANS;
  return { plans, fromDb: query.data?.fromDb ?? false, isLoading: query.isLoading, refetch: query.refetch };
}

/** Commission par commande, seuil et délais (réglés par le fondateur). */
export function useBillingSettings() {
  const query = useQuery({ queryKey: BILLING_SETTINGS_QUERY_KEY, queryFn: fetchBillingSettings, staleTime: 60_000 });
  const settings: BillingSettings = query.data ?? DEFAULT_BILLING_SETTINGS;
  return { settings, isLoading: query.isLoading, refetch: query.refetch };
}

/** Boutiques couvertes par l'abonnement du marchand connecté (null = non connecté ou migration non appliquée). */
export function useMyShopCoverage(enabled = true) {
  const query = useQuery<MyShopCoverage | null>({
    queryKey: MY_COVERAGE_QUERY_KEY,
    queryFn: fetchMyShopCoverage,
    staleTime: 30_000,
    enabled,
  });
  return { coverage: query.data ?? null, isLoading: query.isLoading, refetch: query.refetch };
}

/** Après un enregistrement fondateur : relire plans et réglages partout. */
export function useInvalidateBillingConfig() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: PLANS_QUERY_KEY });
    qc.invalidateQueries({ queryKey: BILLING_SETTINGS_QUERY_KEY });
    qc.invalidateQueries({ queryKey: MY_COVERAGE_QUERY_KEY });
  };
}
