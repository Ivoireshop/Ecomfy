import { describe, expect, it } from "vitest";
import { activityRows, overviewCounts, periodStart } from "./deliveryOverview";

describe("vue d'ensemble livraison", () => {
  it("regroupe les statuts comme le tableau de bord", () => {
    expect(overviewCounts({ transmitted: 1, accepted: 2, assigned: 3, in_transit: 4, completed: 5, cod_collected: 1, failed: 2, returned: 1, refused: 7 }))
      .toEqual({ total: 26, fresh: 1, accepted: 5, inProgress: 4, delivered: 6, failed: 2, returned: 1 });
    expect(overviewCounts({})).toEqual({ total: 0, fresh: 0, accepted: 0, inProgress: 0, delivered: 0, failed: 0, returned: 0 });
  });

  it("affiche chaque jour de la période, même sans activité", () => {
    const rows = activityRows([{ day: "2026-02-28", received: 2, delivered: 1, failed: 0, returned: 0 }], 3, new Date(2026, 2, 1, 9));
    expect(rows.map((r) => r.day)).toEqual(["2026-03-01", "2026-02-28", "2026-02-27"]);
    expect(rows.map((r) => r.received)).toEqual([0, 2, 0]);
  });

  it("calcule le début des périodes du filtre", () => {
    const now = new Date(2026, 2, 10, 15, 30);
    expect(periodStart("all", now)).toBeNull();
    expect(periodStart("today", now)).toBe(new Date(2026, 2, 10).toISOString());
    expect(periodStart("7d", now)).toBe(new Date(now.getTime() - 7 * 86400000).toISOString());
  });
});
