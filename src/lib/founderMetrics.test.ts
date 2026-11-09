import { describe, it, expect } from "vitest";
import {
  buildChart,
  chartDays,
  computeMrr,
  consolidatePayments,
  isInRange,
  periodBounds,
  type RawCommissionPayment,
  type RawPayment,
  type ShopForMrr,
} from "./founderMetrics";
import type { SubscriptionPlan } from "./subscriptionPlans";

const NOW = new Date(2026, 10, 10, 15, 0, 0); // 10 novembre 2026, 15h
const at = (dayOffset: number, hour = 10) => new Date(2026, 10, 10 + dayOffset, hour, 0, 0).toISOString();
const ALL = { start: null, end: null };

const plan = (code: string, price_monthly: number, price_annual: number | null = null): SubscriptionPlan => ({
  code, name: `Plan ${code}`, description: null, badge: null, price_monthly, price_annual, max_shops: 1,
  ai_video_quota: 0, ai_image_quota: 0, features: [], is_active: true, is_public: true, sort_order: 0,
});
const PLANS = [plan("pro_monthly", 12000, 118800), plan("premium_academy_pro", 35000, 342000)];

const shop = (id: string, user_id: string, subscription_plan: string | null, untilDays: number | null): ShopForMrr => ({
  id, user_id, business_name: `Boutique ${id}`, subscription_plan,
  subscription_active_until: untilDays === null ? null : new Date(NOW.getTime() + untilDays * 86400000).toISOString(),
});

describe("periodBounds", () => {
  it("« 7 jours » = aujourd'hui et les 6 jours précédents, comme les 7 barres du graphique", () => {
    expect(periodBounds("7d", NOW).start).toEqual(new Date(2026, 10, 4));
    expect(periodBounds("30d", NOW).start).toEqual(new Date(2026, 9, 12));
    expect(periodBounds("today", NOW).start).toEqual(new Date(2026, 10, 10));
  });
  it("« mois précédent » a une borne haute (le 1er du mois en cours, exclu)", () => {
    const b = periodBounds("last_month", NOW);
    expect(b.start).toEqual(new Date(2026, 9, 1));
    expect(b.end).toEqual(new Date(2026, 10, 1));
    expect(isInRange(new Date(2026, 9, 31, 23, 0).toISOString(), b)).toBe(true);
    expect(isInRange(new Date(2026, 10, 1, 0, 0).toISOString(), b)).toBe(false);
  });
  it("« tout » n'a aucune borne", () => {
    expect(periodBounds("all", NOW)).toEqual(ALL);
    expect(isInRange("2020-01-01T00:00:00Z", ALL)).toBe(true);
    expect(isInRange(null, ALL)).toBe(false);
  });
  it("chartDays : 7, 30 ou 90", () => {
    expect(chartDays("7d")).toBe(7);
    expect(chartDays("90d")).toBe(90);
    expect(chartDays("all")).toBe(30);
  });
});

describe("consolidatePayments", () => {
  const pay = (over: Partial<RawPayment>): RawPayment => ({
    id: "p", user_id: "u1", amount: 1000, currency: "XOF", status: "completed", created_at: at(0), ...over,
  });
  const email = (id: string) => (id === "u1" ? "a@x.com" : undefined);

  it("ne compte que les paiements validés ; les en attente sont comptés à part", () => {
    const r = consolidatePayments(
      [pay({ id: "a", amount: 1000 }), pay({ id: "b", amount: 500, status: "pending" }), pay({ id: "c", amount: 700, status: "failed" })],
      email, ALL
    );
    expect(r.revenue).toBe(1000);
    expect(r.completedCount).toBe(1);
    expect(r.pendingCount).toBe(1);
  });

  it("convertit l'euro à parité fixe et exclut une devise sans parité plutôt que de l'additionner", () => {
    const r = consolidatePayments(
      [pay({ id: "a", amount: 1000, currency: "XOF" }), pay({ id: "b", amount: 10, currency: "EUR" }), pay({ id: "c", amount: 50, currency: "USD" })],
      email, ALL
    );
    expect(r.revenue).toBeCloseTo(1000 + 6559.57, 1);
    expect(r.excludedCount).toBe(1);
    expect(r.transactions.map(t => t.id).sort()).toEqual(["a", "b"]);
  });

  it("n'invente ni méthode de paiement ni e-mail", () => {
    const r = consolidatePayments([pay({ id: "a", user_id: "inconnu", payment_method: null })], email, ALL);
    expect(r.transactions[0].payment_method).toBe("Non renseigné");
    expect(r.transactions[0].user_email).toBe("Compte inconnu");
  });

  it("applique la période, mais garde les activations de toutes périodes pour retrouver leur montant réel", () => {
    const activation = (id: string, shopId: string, amount: number, day: number) =>
      pay({ id, amount, created_at: at(day), metadata: { payment_type: "shop_activation", shop_id: shopId } });
    const r = consolidatePayments(
      [activation("old", "shopA", 1300, -40), activation("new", "shopB", 2000, 0)],
      email, periodBounds("7d", NOW)
    );
    expect(r.revenue).toBe(2000);
    expect(r.activationByShop.get("shopA")?.amount).toBe(1300);
    expect(r.activationByShop.get("shopB")?.amount).toBe(2000);
    expect(r.activationByShop.get("shopA")?.id).toBe("old");
  });

  it("classe les types et ne mélange pas les références d'une boutique à l'autre", () => {
    const r = consolidatePayments(
      [
        pay({ id: "s", metadata: { payment_type: "shop_subscription", plan: "pro_monthly" } }),
        pay({ id: "k", metadata: { payment_type: "commission_payment" } }),
        pay({ id: "a1", transaction_id: "REF-A", metadata: { payment_type: "shop_activation", shop_id: "A" } }),
        pay({ id: "a2", transaction_id: "REF-B", metadata: { payment_type: "shop_activation", shop_id: "B" } }),
      ],
      email, ALL
    );
    const type = (id: string) => r.transactions.find(t => t.id === id)?.type;
    expect(type("s")).toBe("subscription");
    expect(type("k")).toBe("commission");
    expect(r.activationByShop.get("A")?.reference).toBe("REF-A");
    expect(r.activationByShop.get("B")?.reference).toBe("REF-B");
  });

  describe("règlements de commission enregistrés à la main", () => {
    const owner = (shopId: string) => (shopId === "shop1" ? "u1" : undefined);
    const cp = (over: Partial<RawCommissionPayment>): RawCommissionPayment => ({
      id: "c", shop_id: "shop1", amount: 12000, payment_method: "wave_direct",
      transaction_reference: "MANUAL-WAVE_DIRECT-1", status: "paid", created_at: at(0), ...over,
    });
    const run = (payments: RawPayment[], rows: RawCommissionPayment[], bounds = ALL) =>
      consolidatePayments(payments, email, bounds, { rows, ownerOfShop: owner });

    it("compte un règlement manuel absent de payments, rattaché au propriétaire de la boutique", () => {
      const r = run([pay({ id: "a", amount: 1000 })], [cp({})]);
      expect(r.revenue).toBe(13000);
      expect(r.completedCount).toBe(2);
      const tx = r.transactions.find(t => t.id === "commission-c");
      expect(tx).toMatchObject({ type: "commission", user_id: "u1", user_email: "a@x.com", amount: 12000, payment_method: "wave_direct" });
    });

    it("ne double pas un règlement en ligne : sa référence est celle de la ligne payments", () => {
      const r = run(
        [pay({ id: "p1", amount: 12000, transaction_id: "GP-123", metadata: { payment_type: "commission_payment", shop_id: "shop1" } })],
        [cp({ transaction_reference: "GP-123" })]
      );
      expect(r.revenue).toBe(12000);
      expect(r.completedCount).toBe(1);
    });

    it("reconnaît aussi la référence passerelle des métadonnées, même sur un paiement non validé", () => {
      const r = run(
        [pay({ id: "p1", status: "pending", amount: 12000, metadata: { gateway_reference: "GP-9" } })],
        [cp({ transaction_reference: "GP-9" })]
      );
      expect(r.revenue).toBe(0);
    });

    it("ignore une ligne sans référence, non payée, ou hors période ; exclut et signale une ligne sans date", () => {
      const rows = [
        cp({ id: "1", transaction_reference: null }),
        cp({ id: "2", status: "pending" }),
        cp({ id: "3", created_at: at(-40) }),
        cp({ id: "4", created_at: null, transaction_reference: "MANUAL-4" }),
        cp({ id: "5", amount: "abc", transaction_reference: "MANUAL-5" }),
      ];
      const r = run([], rows, periodBounds("7d", NOW));
      expect(r.revenue).toBe(0);
      expect(r.excludedCount).toBe(2);
    });

    it("sans propriétaire connu, reste rattaché à la boutique, jamais à un compte inventé", () => {
      const r = run([], [cp({ shop_id: "orpheline" })]);
      expect(r.transactions[0].user_id).toBe("shop:orpheline");
      expect(r.transactions[0].user_email).toBe("Compte inconnu");
    });
  });
});

describe("computeMrr", () => {
  it("valorise au tarif réel du plan, plus d'estimation 15 000 / 25 000 / 1 300", () => {
    const r = computeMrr(
      [shop("1", "u1", "pro_monthly", 10), shop("2", "u2", "premium_academy_pro", 10)],
      [], PLANS, NOW
    );
    expect(r.mrr).toBe(12000 + 35000);
    expect(r.items).toHaveLength(2);
    expect(r.unpricedCount).toBe(0);
  });

  it("un plan inconnu est compté mais pas valorisé", () => {
    const r = computeMrr([shop("1", "u1", "business", 10), shop("2", "u2", "pro_monthly", 10)], [], PLANS, NOW);
    expect(r.mrr).toBe(12000);
    expect(r.items).toHaveLength(2);
    expect(r.unpricedCount).toBe(1);
    expect(r.items.find(i => i.shop_id === "1")).toMatchObject({ priced: false, monthly_amount: 0 });
  });

  it("ignore les boutiques gratuites et les abonnements expirés ou sans date de fin", () => {
    const r = computeMrr(
      [shop("1", "u1", "free", 10), shop("2", "u2", "pro_monthly", -1), shop("3", "u3", "pro_monthly", null), shop("4", "u4", null, 10)],
      [], PLANS, NOW
    );
    expect(r.items).toHaveLength(0);
    expect(r.mrr).toBe(0);
  });

  it("un propriétaire = un abonnement, même avec plusieurs boutiques couvertes", () => {
    const r = computeMrr([shop("1", "u1", "pro_monthly", 10), shop("2", "u1", "pro_monthly", 10)], [], PLANS, NOW);
    expect(r.items).toHaveLength(1);
    expect(r.mrr).toBe(12000);
  });

  it("un abonnement annuel compte pour 1/12 du prix annuel", () => {
    const r = computeMrr([shop("1", "u1", "pro_monthly", 300)], [], PLANS, NOW);
    expect(r.mrr).toBe(9900);
  });

  it("un abonnement de compte actif compte à son montant payé (annuel ramené au mois), sans doublon avec la boutique", () => {
    const sub = (id: string, user_id: string, amount: number, status = "active", endDays = 20) => ({
      id, user_id, amount, status, end_date: new Date(NOW.getTime() + endDays * 86400000).toISOString(),
    });
    const r = computeMrr(
      [shop("1", "u1", "pro_monthly", 10)],
      [sub("a", "u1", 12000), sub("b", "u2", 118800), sub("c", "u3", 12000, "cancelled"), sub("d", "u4", 0), sub("e", "u5", 12000, "active", -2)],
      PLANS, NOW
    );
    expect(r.items.map(i => i.user_id).sort()).toEqual(["u1", "u2"]);
    expect(r.mrr).toBe(12000 + 9900);
  });
});

describe("buildChart", () => {
  it("une barre par jour local, sans valeur inventée, et un seul jour par encaissement", () => {
    const pts = buildChart(
      [{ amount: 1000, created_at: at(0, 9) }, { amount: 500, created_at: at(0, 23) }, { amount: 700, created_at: at(-2) }, { amount: 9, created_at: at(-20) }],
      [at(0), at(-1), at(-1), at(-50)],
      7, NOW
    );
    expect(pts).toHaveLength(7);
    expect(pts[6].revenue).toBe(1500);
    expect(pts[4].revenue).toBe(700);
    expect(pts[5].signups).toBe(2);
    expect(pts[6].signups).toBe(1);
    expect(pts.reduce((s, p) => s + p.revenue, 0)).toBe(2200);
  });
});
