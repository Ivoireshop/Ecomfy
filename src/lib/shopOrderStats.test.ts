import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { financeTotals, salesChart, type FinanceDay } from "./shopOrderStats";

describe("salesChart", () => {
  // Jeudi 5 novembre 2026, 02 h 30.
  const now = new Date(2026, 10, 5, 2, 30);
  const base = { hours: [], days: [], firstOrderAt: null };

  it("« Aujourd'hui » : une entrée par heure jusqu'à l'heure en cours, avec le panier moyen", () => {
    const points = salesChart({ ...base, period: "today", hours: [{ hour: 1, count: 4, total: 1000 }] }, now);
    expect(points.map((p) => p.date)).toEqual(["0h", "1h", "2h"]);
    expect(points[1]).toEqual({ date: "1h", commandes: 4, ventes: 1000, panier_moyen: 250 });
    expect(points[0].panier_moyen).toBe(0);
  });

  it("7 et 30 jours : tous les jours, du plus ancien à aujourd'hui", () => {
    const days = [{ day: "2026-10-30", count: 1, total: 90 }, { day: "2026-11-05", count: 2, total: 500 }, { day: "2026-10-29", count: 1, total: 7 }];
    const week = salesChart({ ...base, period: "7d", days }, now);
    expect(week.map((p) => p.ventes)).toEqual([90, 0, 0, 0, 0, 0, 500]);
    expect(salesChart({ ...base, period: "30d", days }, now)).toHaveLength(30);
  });

  it("« Tout » : depuis la première vente, entre 7 et 90 jours", () => {
    const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86400000).toISOString();
    expect(salesChart({ ...base, period: "all", firstOrderAt: at(1) }, now)).toHaveLength(7);
    expect(salesChart({ ...base, period: "all", firstOrderAt: at(20) }, now)).toHaveLength(21);
    expect(salesChart({ ...base, period: "all", firstOrderAt: at(500) }, now)).toHaveLength(90);
    expect(salesChart({ ...base, period: "all" }, now)).toHaveLength(30);
  });
});

describe("financeTotals", () => {
  const day = (d: string, n: number): FinanceDay => ({ day: d, count: n, confirmedCount: n, deliveredCount: n, revenue: n * 10, cashIn: n * 5 });
  const days = [day("2026-10-31", 1), day("2026-11-01", 2), day("2026-11-05", 4)];

  it("cumule les jours de la période", () => {
    expect(financeTotals(days, "2026-11-01")).toEqual({ count: 6, confirmedCount: 6, deliveredCount: 6, revenue: 60, cashIn: 30 });
    expect(financeTotals(days, null).count).toBe(7);
  });

  it("sans commande, tout est à zéro", () => {
    expect(financeTotals([], null)).toEqual({ count: 0, confirmedCount: 0, deliveredCount: 0, revenue: 0, cashIn: 0 });
  });
});
