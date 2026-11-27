import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { lastSevenDays, salesPeriods } from "./shopOrderSummary";

const day = (d: string, count: number, total: number) => ({ day: d, count, total });

describe("salesPeriods", () => {
  // Jeudi 5 novembre 2026 : la semaine commence le lundi 2, le mois le dimanche 1er.
  const now = new Date(2026, 10, 5, 15, 0);
  const days = [
    day("2026-10-31", 1, 100), day("2026-11-01", 2, 200), day("2026-11-02", 3, 300),
    day("2026-11-04", 4, 400), day("2026-11-05", 5, 500),
  ];

  it("découpe aujourd'hui, hier, la semaine et le mois", () => {
    expect(salesPeriods(days, now)).toEqual({
      today: { count: 5, total: 500 },
      yesterday: { count: 4, total: 400 },
      week: { count: 12, total: 1200 },
      month: { count: 14, total: 1400 },
    });
  });

  it("la semaine peut commencer le mois précédent", () => {
    // Dimanche 1er novembre : semaine depuis le lundi 26 octobre.
    const result = salesPeriods([day("2026-10-26", 1, 10), day("2026-10-25", 1, 1000), day("2026-11-01", 1, 5)], new Date(2026, 10, 1, 9, 0));
    expect(result.week).toEqual({ count: 2, total: 15 });
    expect(result.month).toEqual({ count: 1, total: 5 });
  });

  it("sans vente, tout est à zéro", () => {
    expect(salesPeriods([], now).month).toEqual({ count: 0, total: 0 });
  });
});

describe("lastSevenDays", () => {
  it("rend sept jours dans l'ordre, jours vides compris", () => {
    const result = lastSevenDays([day("2026-11-05", 1, 500), day("2026-10-30", 1, 90), day("2026-10-29", 1, 7)], new Date(2026, 10, 5, 0, 5));
    expect(result.map((d) => d.total)).toEqual([90, 0, 0, 0, 0, 0, 500]);
    expect(result[0].date.getDate()).toBe(30);
    expect(result[6].date.getDate()).toBe(5);
  });
});
