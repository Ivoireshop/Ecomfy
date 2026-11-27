// Commandes d'une boutique agrégées par la base, pour les pages Statistiques et Finances : les montants restent exacts
// quel que soit le nombre de commandes.

import { supabase } from "@/integrations/supabase/client";
import { readAll } from "@/lib/pagination";
import { isInPeriod, localDayKey } from "@/lib/shopFinance";

type Failure = { message: string } | null;

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

async function callRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = (await supabase.rpc(name as never, args as never)) as unknown as { data: T | null; error: Failure };
  if (error) throw error;
  if (data === null) throw new Error("Réponse vide");
  return data;
}

const num = (value: unknown) => Number(value || 0);

// ---------------------------------------------------------------------------------------------------------------
// Statistiques
// ---------------------------------------------------------------------------------------------------------------

export type StatsPeriod = "today" | "7d" | "30d" | "all";

export interface ShopStatsData {
  period: StatsPeriod;
  /** Ventes de la période : les commandes annulées ou retournées n'en font pas partie. */
  count: number;
  revenue: number;
  /** Montant des ventes ni livrées ni payées d'avance. */
  awaitingTotal: number;
  firstOrderAt: string | null;
  /** Période précédente de même durée ; zéro pour « Tout ». */
  previousCount: number;
  previousRevenue: number;
  monthRevenue: number;
  /** Au plus les 90 derniers jours de la période. */
  days: { day: string; count: number; total: number }[];
  /** Heures de la journée (0 à 23) ayant au moins une vente. */
  hours: { hour: number; count: number; total: number }[];
  /** Un groupe par pays saisi et par indicatif ; `phone` sert à deviner le pays quand il n'est pas saisi. */
  countries: { country: string | null; phone: string | null; count: number; total: number }[];
  /** `key` : identifiant du produit, ou « name:… » pour un produit supprimé. */
  products: { key: string; name: string; quantity: number; revenue: number }[];
}

interface StatsRow {
  count: number;
  revenue: number;
  awaiting_total: number;
  first_order_at: string | null;
  previous_count: number;
  previous_revenue: number;
  month_revenue: number;
  days: ShopStatsData["days"];
  hours: ShopStatsData["hours"];
  countries: ShopStatsData["countries"];
  products: ShopStatsData["products"];
}

export async function fetchShopStatistics(shopId: string, period: StatsPeriod): Promise<ShopStatsData> {
  const row = await callRpc<StatsRow>("shop_order_statistics", { _shop_id: shopId, _period: period, _tz: timeZone() });
  return {
    period,
    count: num(row.count),
    revenue: num(row.revenue),
    awaitingTotal: num(row.awaiting_total),
    firstOrderAt: row.first_order_at,
    previousCount: num(row.previous_count),
    previousRevenue: num(row.previous_revenue),
    monthRevenue: num(row.month_revenue),
    days: (row.days ?? []).map((d) => ({ day: d.day, count: num(d.count), total: num(d.total) })),
    hours: (row.hours ?? []).map((h) => ({ hour: num(h.hour), count: num(h.count), total: num(h.total) })),
    countries: (row.countries ?? []).map((c) => ({ ...c, count: num(c.count), total: num(c.total) })),
    products: (row.products ?? []).map((p) => ({ ...p, quantity: num(p.quantity), revenue: num(p.revenue) })),
  };
}

export interface SalesPoint {
  date: string;
  commandes: number;
  ventes: number;
  panier_moyen: number;
}

const point = (date: string, commandes: number, ventes: number): SalesPoint => ({
  date, commandes, ventes, panier_moyen: commandes ? ventes / commandes : 0,
});

/**
 * Points de la courbe des ventes : par heure pour « Aujourd'hui » (un seul jour ne trace rien), sinon par jour, jours
 * sans vente compris. « Tout » commence à la première vente, entre 7 et 90 jours.
 */
export function salesChart(data: Pick<ShopStatsData, "period" | "days" | "hours" | "firstOrderAt">, now = new Date()): SalesPoint[] {
  if (data.period === "today") {
    const byHour = new Map(data.hours.map((h) => [h.hour, h]));
    return Array.from({ length: now.getHours() + 1 }, (_, h) => point(`${h}h`, byHour.get(h)?.count ?? 0, byHour.get(h)?.total ?? 0));
  }

  let dayCount = data.period === "7d" ? 7 : 30;
  if (data.period === "all" && data.firstOrderAt) {
    const first = new Date(data.firstOrderAt).getTime();
    dayCount = Math.min(Math.max(Math.ceil((now.getTime() - first) / 86400000) + 1, 7), 90);
  }

  const byDay = new Map(data.days.map((d) => [d.day, d]));
  return Array.from({ length: dayCount }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (dayCount - 1 - i));
    const sales = byDay.get(localDayKey(date));
    return point(date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }), sales?.count ?? 0, sales?.total ?? 0);
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Finances
// ---------------------------------------------------------------------------------------------------------------

export interface FinanceDay {
  day: string;
  /** Toutes les commandes du jour, quel que soit leur statut. */
  count: number;
  confirmedCount: number;
  deliveredCount: number;
  /** Chiffre d'affaires des commandes validées. */
  revenue: number;
  /** Commandes livrées, sauf paiement remboursé ou en échec. */
  cashIn: number;
}

interface FinanceRow {
  day: string;
  count: number;
  confirmed_count: number;
  delivered_count: number;
  revenue: number;
  cash_in: number;
}

export async function fetchShopFinanceDaily(shopId: string): Promise<FinanceDay[]> {
  const rows = await callRpc<FinanceRow[]>("shop_finance_daily", { _shop_id: shopId, _tz: timeZone() });
  return rows.map((r) => ({
    day: r.day,
    count: num(r.count),
    confirmedCount: num(r.confirmed_count),
    deliveredCount: num(r.delivered_count),
    revenue: num(r.revenue),
    cashIn: num(r.cash_in),
  }));
}

/** Cumul des jours à partir de `startKey` (AAAA-MM-JJ), ou de tout l'historique si null. */
export function financeTotals(days: FinanceDay[], startKey: string | null): Omit<FinanceDay, "day"> {
  return days.filter((d) => isInPeriod(d.day, startKey)).reduce(
    (acc, d) => ({
      count: acc.count + d.count,
      confirmedCount: acc.confirmedCount + d.confirmedCount,
      deliveredCount: acc.deliveredCount + d.deliveredCount,
      revenue: acc.revenue + d.revenue,
      cashIn: acc.cashIn + d.cashIn,
    }),
    { count: 0, confirmedCount: 0, deliveredCount: 0, revenue: 0, cashIn: 0 },
  );
}

export interface CashedOrder {
  id: string;
  order_number: string;
  total: number;
  created_at: string;
}

/** Toutes les commandes encaissées depuis `startKey` (fiche comptable), lues par lots de 1 000. */
export function fetchShopCashedOrders(shopId: string, startKey: string | null): Promise<CashedOrder[]> {
  return readAll<CashedOrder>((from, to) =>
    (supabase.rpc("shop_cashed_orders" as never, { _shop_id: shopId, _since: startKey, _tz: timeZone() } as never) as unknown as {
      order: (column: string) => { order: (column: string) => { range: (from: number, to: number) => PromiseLike<{ data: unknown; error: Failure }> } };
    }).order("created_at").order("id").range(from, to));
}
