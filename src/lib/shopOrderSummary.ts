// Indicateurs des commandes d'une boutique, calculés par la base (shop_orders_overview) : ils restent exacts quel que
// soit le nombre de commandes. Les périodes affichées sont recomposées à partir des ventes par jour.

import { supabase } from "@/integrations/supabase/client";
import { localDayKey } from "@/lib/shopFinance";

export interface ShopDaySales {
  /** Jour AAAA-MM-JJ dans le fuseau du navigateur. */
  day: string;
  count: number;
  total: number;
}

export interface ShopRecentOrder {
  id: string;
  order_number: string;
  customer_name: string;
  total: number;
  order_status: string;
  is_read: boolean;
  created_at: string;
}

export interface ShopOrderSummary {
  totalCount: number;
  unreadCount: number;
  /** Chiffre d'affaires cumulé, hors commandes annulées ou retournées. */
  revenueTotal: number;
  /** Ventes (hors annulées et retournées) depuis le début du mois ou les 7 derniers jours. */
  days: ShopDaySales[];
  recent: ShopRecentOrder[];
}

interface SummaryRow {
  total_count: number;
  unread_count: number;
  revenue_total: number;
  days: ShopDaySales[];
  recent: ShopRecentOrder[];
}

export async function fetchShopOrderSummary(shopId: string): Promise<ShopOrderSummary> {
  const { data, error } = (await supabase.rpc("shop_orders_overview" as never, {
    _shop_id: shopId,
    _tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  } as never)) as unknown as { data: SummaryRow | null; error: { message: string } | null };
  if (error) throw error;
  if (!data) throw new Error("Réponse vide");
  return {
    totalCount: Number(data.total_count || 0),
    unreadCount: Number(data.unread_count || 0),
    revenueTotal: Number(data.revenue_total || 0),
    days: (data.days ?? []).map((d) => ({ day: d.day, count: Number(d.count || 0), total: Number(d.total || 0) })),
    recent: (data.recent ?? []).map((o) => ({ ...o, total: Number(o.total || 0) })),
  };
}

export interface PeriodSales {
  count: number;
  total: number;
}

/** Jour situé `offset` jours après (ou avant, si négatif) le jour de `now`. */
const shiftDay = (now: Date, offset: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);

/** Cumul des jours compris entre `from` et `to` (inclus) ; sans `to`, jusqu'à la fin. */
function sumDays(days: ShopDaySales[], from: string, to?: string): PeriodSales {
  return days.reduce<PeriodSales>(
    (acc, d) => (d.day >= from && (!to || d.day <= to) ? { count: acc.count + d.count, total: acc.total + d.total } : acc),
    { count: 0, total: 0 },
  );
}

/** « Aujourd'hui », « Hier », « Cette semaine » (depuis lundi) et « Ce mois ». */
export function salesPeriods(days: ShopDaySales[], now = new Date()) {
  const today = localDayKey(now);
  const yesterday = localDayKey(shiftDay(now, -1));
  const monday = localDayKey(shiftDay(now, -((now.getDay() + 6) % 7)));
  const firstOfMonth = localDayKey(new Date(now.getFullYear(), now.getMonth(), 1));
  return {
    today: sumDays(days, today),
    yesterday: sumDays(days, yesterday, yesterday),
    week: sumDays(days, monday),
    month: sumDays(days, firstOfMonth),
  };
}

/** Les 7 derniers jours, du plus ancien à aujourd'hui, jours sans vente compris. */
export function lastSevenDays(days: ShopDaySales[], now = new Date()): { date: Date; total: number }[] {
  const byDay = new Map(days.map((d) => [d.day, d.total]));
  return Array.from({ length: 7 }, (_, i) => {
    const date = shiftDay(now, i - 6);
    return { date, total: byDay.get(localDayKey(date)) ?? 0 };
  });
}
