// Vue d'ensemble d'une structure de livraison (cahier §3.1) : regroupement des totaux calculés par la base.

export interface DeliveryDailyActivity {
  /** Jour local, « AAAA-MM-JJ ». */
  day: string;
  received: number;
  delivered: number;
  failed: number;
  returned: number;
}

export interface DeliveryCompanyOverview {
  by_status: Record<string, number>;
  daily: DeliveryDailyActivity[];
}

const GROUPS = {
  fresh: ["transmitted"],
  accepted: ["accepted", "preparing", "pending_assignment", "assigned"],
  inProgress: ["picked_up", "in_transit"],
  delivered: ["delivered", "cod_collected", "deposit_pending", "completed"],
  failed: ["failed"],
  returned: ["returned"],
} as const;

export function overviewCounts(byStatus: Record<string, number>): Record<keyof typeof GROUPS | "total", number> {
  const sum = (statuses: readonly string[]) => statuses.reduce((total, s) => total + (byStatus[s] ?? 0), 0);
  return {
    total: Object.values(byStatus).reduce((total, n) => total + n, 0),
    fresh: sum(GROUPS.fresh),
    accepted: sum(GROUPS.accepted),
    inProgress: sum(GROUPS.inProgress),
    delivered: sum(GROUPS.delivered),
    failed: sum(GROUPS.failed),
    returned: sum(GROUPS.returned),
  };
}

const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Les `days` derniers jours, aujourd'hui d'abord ; un jour sans activité vaut zéro partout. */
export function activityRows(daily: DeliveryDailyActivity[], days: number, today: Date = new Date()): DeliveryDailyActivity[] {
  const byDay = new Map(daily.map((row) => [row.day, row]));
  return Array.from({ length: days }, (_, i) => {
    const day = localDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i));
    return byDay.get(day) ?? { day, received: 0, delivered: 0, failed: 0, returned: 0 };
  });
}

export type DispatchPeriod = "all" | "today" | "7d" | "30d";

/** Début (ISO) de la période du filtre « date » du suivi, ou null pour tout l'historique. */
export function periodStart(period: DispatchPeriod, now: Date = new Date()): string | null {
  if (period === "all") return null;
  if (period === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  return new Date(now.getTime() - (period === "7d" ? 7 : 30) * 86400000).toISOString();
}
