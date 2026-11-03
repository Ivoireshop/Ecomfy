import { describe, expect, test, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { computeShopSubscription, pricingPlanIdFor, pricingPlanIdFromAmount } from "../lib/shopSubscription";

const DAY = 86_400_000;
const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString();

describe("pricingPlanIdFor : une seule formule par plan stocké", () => {
  test("premium n'est pas pris pour Pro (« premium_academy_pro » contient « pro »)", () => {
    expect(pricingPlanIdFor("premium_academy_pro")).toBe("premium_academy_pro");
  });
  test("pro_monthly et l'ancien starter donnent Pro", () => {
    expect(pricingPlanIdFor("pro_monthly")).toBe("pro_monthly");
    expect(pricingPlanIdFor("starter")).toBe("pro_monthly");
  });
  test("free, starter_free, vide donnent la formule gratuite", () => {
    expect(pricingPlanIdFor("free")).toBe("starter_free");
    expect(pricingPlanIdFor("starter_free")).toBe("starter_free");
    expect(pricingPlanIdFor(null)).toBe("starter_free");
  });
});

describe("pricingPlanIdFromAmount : abonnement de compte sans boutique", () => {
  test.each([
    [12_000, "pro_monthly"],
    [118_800, "pro_monthly"],
    [35_000, "premium_academy_pro"],
    [342_000, "premium_academy_pro"],
  ])("%i FCFA", (amount, expected) => {
    expect(pricingPlanIdFromAmount(amount)).toBe(expected);
  });
});

describe("plan actif d'une boutique : seule la date de fin fait foi", () => {
  test("abonnement en cours : actif", () => {
    const s = computeShopSubscription({ subscription_plan: "pro_monthly", subscription_active_until: inDays(10) });
    expect(s.isActive).toBe(true);
  });
  test("abonnement échu : plus actif, même avec un plan payant", () => {
    const s = computeShopSubscription({ subscription_plan: "pro_monthly", subscription_active_until: inDays(-1) });
    expect(s.isActive).toBe(false);
    expect(s.isExpired).toBe(true);
  });
  test("plan free avec une date future : pas un abonnement", () => {
    const s = computeShopSubscription({ subscription_plan: "free", subscription_active_until: inDays(10) });
    expect(s.isActive).toBe(false);
  });
});
