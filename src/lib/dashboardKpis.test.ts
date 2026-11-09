import { describe, it, expect } from "vitest";
import {
  computeTodayKpis,
  dailyRevenue,
  isSale,
  statusBreakdown,
  topProducts,
  trendOf,
  type DashboardOrder,
} from "./dashboardKpis";

// 10 novembre 2026, 15h00 heure locale.
const NOW = new Date(2026, 10, 10, 15, 0, 0);
const at = (dayOffset: number, hour: number) => new Date(2026, 10, 10 + dayOffset, hour, 0, 0).toISOString();
const order = (id: string, total: number, created_at: string, order_status = "new", items?: DashboardOrder["order_items"]): DashboardOrder =>
  ({ id, total, created_at, order_status, order_items: items });

describe("trendOf", () => {
  it("renvoie null quand il n'y a rien à comparer (jamais un faux pourcentage)", () => {
    expect(trendOf(0, 0)).toBeNull();
  });
  it("signale « Nouveau » plutôt que +100% quand la référence est nulle", () => {
    expect(trendOf(5000, 0)).toEqual({ label: "Nouveau", up: true });
  });
  it("calcule une hausse et une baisse", () => {
    expect(trendOf(150, 100)).toEqual({ label: "+50%", up: true });
    expect(trendOf(50, 100)).toEqual({ label: "-50%", up: false });
  });
  it("une baisse à zéro est bien -100%", () => {
    expect(trendOf(0, 100)).toEqual({ label: "-100%", up: false });
  });
});

describe("isSale", () => {
  it("exclut annulées et retournées", () => {
    expect(isSale({ order_status: "cancelled" })).toBe(false);
    expect(isSale({ order_status: "returned" })).toBe(false);
    expect(isSale({ order_status: "new" })).toBe(true);
    expect(isSale({ order_status: "delivered" })).toBe(true);
  });
});

describe("computeTodayKpis", () => {
  it("ne compte ni les commandes annulées ni les retournées", () => {
    const k = computeTodayKpis(
      [order("a", 1000, at(0, 9)), order("b", 9999, at(0, 10), "cancelled"), order("c", 5000, at(0, 11), "returned")],
      NOW
    );
    expect(k.todayRevenue).toBe(1000);
    expect(k.todayCount).toBe(1);
    expect(k.windowCount).toBe(1);
  });

  it("panier moyen = null sans vente aujourd'hui, sinon CA / nombre de ventes", () => {
    expect(computeTodayKpis([order("a", 1000, at(-1, 9))], NOW).avgCart).toBeNull();
    expect(computeTodayKpis([order("a", 1000, at(0, 9)), order("b", 3000, at(0, 10))], NOW).avgCart).toBe(2000);
  });

  it("compare à hier jusqu'à la même heure, pas à la journée entière", () => {
    const k = computeTodayKpis(
      [
        order("t", 2000, at(0, 10)),
        order("y-avant", 1000, at(-1, 10)), // avant 15h hier : comparé
        order("y-apres", 50000, at(-1, 20)), // après 15h hier : ignoré
      ],
      NOW
    );
    expect(k.revenueTrend).toEqual({ label: "+100%", up: true });
    expect(k.countTrend).toEqual({ label: "0%", up: true });
  });

  it("aucune vente hier : « Nouveau », pas un +100% inventé ; aucune vente du tout : null", () => {
    expect(computeTodayKpis([order("t", 2000, at(0, 10))], NOW).revenueTrend).toEqual({ label: "Nouveau", up: true });
    const empty = computeTodayKpis([], NOW);
    expect(empty.revenueTrend).toBeNull();
    expect(empty.countTrend).toBeNull();
    expect(empty.todayRevenue).toBe(0);
  });

  it("ignore les dates illisibles et les totaux non numériques", () => {
    const k = computeTodayKpis([order("a", NaN, at(0, 9)), order("b", 500, "pas une date")], NOW);
    expect(k.todayRevenue).toBe(0);
    expect(k.windowCount).toBe(1);
  });

  it("totalise la fenêtre de 30 jours", () => {
    const k = computeTodayKpis([order("a", 1000, at(-10, 9)), order("b", 2000, at(0, 9))], NOW);
    expect(k.windowCount).toBe(2);
    expect(k.windowRevenue).toBe(3000);
  });
});

describe("dailyRevenue", () => {
  it("renvoie exactement N jours, le dernier étant aujourd'hui, sans compter les annulées", () => {
    const days = dailyRevenue(
      [order("a", 1000, at(0, 9)), order("b", 700, at(0, 23)), order("c", 4000, at(-2, 9)), order("d", 999, at(0, 9), "cancelled"), order("old", 5, at(-9, 9))],
      7,
      NOW
    );
    expect(days).toHaveLength(7);
    expect(days[6].total).toBe(1700);
    expect(days[4].total).toBe(4000);
    expect(days.reduce((s, d) => s + d.total, 0)).toBe(5700);
  });
});

describe("statusBreakdown", () => {
  it("compte chaque statut, annulées comprises, et n'invente aucune part quand il n'y a rien", () => {
    expect(statusBreakdown([])).toEqual([]);
    const slices = statusBreakdown([order("a", 1, at(0, 9), "new"), order("b", 1, at(0, 9), "cancelled"), order("c", 1, at(0, 9), "new")]);
    expect(slices).toEqual([
      { status: "new", count: 2 },
      { status: "cancelled", count: 1 },
    ]);
  });
});

describe("topProducts", () => {
  it("cumule par produit, trie par CA, exclut les commandes annulées et limite à 5", () => {
    const items = (name: string, price: number, qty: number) => [{ product_name: name, total_price: price, quantity: qty }];
    const list = topProducts([
      order("a", 0, at(0, 9), "new", items("Sac", 3000, 1)),
      order("b", 0, at(0, 9), "delivered", items("Sac", 6000, 2)),
      order("c", 0, at(0, 9), "new", items("Montre", 5000, 1)),
      order("d", 0, at(0, 9), "cancelled", items("Fantôme", 99999, 9)),
    ]);
    expect(list).toEqual([
      { name: "Sac", revenue: 9000, qty: 3 },
      { name: "Montre", revenue: 5000, qty: 1 },
    ]);
    const many = topProducts(Array.from({ length: 8 }, (_, i) => order(`o${i}`, 0, at(0, 9), "new", items(`P${i}`, i + 1, 1))));
    expect(many).toHaveLength(5);
    expect(many[0].name).toBe("P7");
  });

  it("une commande sans lignes ne fait pas planter", () => {
    expect(topProducts([order("a", 100, at(0, 9), "new", null), order("b", 100, at(0, 9))])).toEqual([]);
  });
});
