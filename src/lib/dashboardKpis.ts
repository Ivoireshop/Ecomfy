// Calculs du tableau de bord marchand. Fonctions pures, sans accès réseau : la page affiche ce qu'elles renvoient,
// et rien d'autre. Règle d'or : quand il n'y a rien à comparer, on renvoie null (jamais un pourcentage inventé).

export interface DashboardOrderItem {
  product_name?: string | null;
  total_price?: number | string | null;
  quantity?: number | string | null;
}

export interface DashboardOrder {
  id: string;
  total?: number | string | null;
  created_at: string;
  order_status?: string | null;
  shop_id?: string;
  order_items?: DashboardOrderItem[] | null;
}

export interface Trend {
  label: string;
  up: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const startOfLocalDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Les commandes annulées ou retournées ne sont pas des ventes (même règle que la page Statistiques). */
export function isSale(o: Pick<DashboardOrder, "order_status">): boolean {
  return o.order_status !== "cancelled" && o.order_status !== "returned";
}

/**
 * Variation entre deux valeurs. Null quand il n'y a rien à comparer (les deux à zéro) ;
 * « Nouveau » quand la période précédente était à zéro et qu'il y a eu de l'activité depuis.
 */
export function trendOf(current: number, previous: number): Trend | null {
  if (previous <= 0) return current > 0 ? { label: "Nouveau", up: true } : null;
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.5) return { label: "0%", up: true };
  return { label: `${pct > 0 ? "+" : "-"}${Math.abs(pct).toFixed(0)}%`, up: pct > 0 };
}

export interface TodayKpis {
  todayRevenue: number;
  todayCount: number;
  /** Null tant qu'aucune vente aujourd'hui : il n'y a pas de panier à moyenner. */
  avgCart: number | null;
  revenueTrend: Trend | null;
  countTrend: Trend | null;
  /** Ventes sur toute la fenêtre chargée (30 jours). */
  windowCount: number;
  windowRevenue: number;
}

/**
 * Chiffres du jour. La comparaison se fait avec hier JUSQU'À LA MÊME HEURE : comparer une journée en cours à une
 * journée entière afficherait une baisse artificielle chaque matin.
 */
export function computeTodayKpis(orders: DashboardOrder[], now: Date = new Date()): TodayKpis {
  const todayStart = startOfLocalDay(now).getTime();
  const yesterdayStart = todayStart - DAY_MS;
  const yesterdayCutoff = now.getTime() - DAY_MS;

  let todayRevenue = 0;
  let todayCount = 0;
  let yesterdayRevenue = 0;
  let yesterdayCount = 0;
  let windowRevenue = 0;
  let windowCount = 0;

  for (const o of orders) {
    if (!isSale(o)) continue;
    const t = new Date(o.created_at).getTime();
    if (Number.isNaN(t)) continue;
    const total = num(o.total);
    windowCount++;
    windowRevenue += total;
    if (t >= todayStart && t <= now.getTime()) {
      todayRevenue += total;
      todayCount++;
    } else if (t >= yesterdayStart && t <= yesterdayCutoff) {
      yesterdayRevenue += total;
      yesterdayCount++;
    }
  }

  return {
    todayRevenue,
    todayCount,
    avgCart: todayCount > 0 ? todayRevenue / todayCount : null,
    revenueTrend: trendOf(todayRevenue, yesterdayRevenue),
    countTrend: trendOf(todayCount, yesterdayCount),
    windowCount,
    windowRevenue,
  };
}

/** Chiffre d'affaires par jour sur les `days` derniers jours (aujourd'hui inclus), du plus ancien au plus récent. */
export function dailyRevenue(
  orders: DashboardOrder[],
  days: number,
  now: Date = new Date()
): { day: Date; total: number }[] {
  const todayStart = startOfLocalDay(now);
  const buckets = Array.from({ length: days }, (_, i) => ({
    day: new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() - (days - 1 - i)),
    total: 0,
  }));
  for (const o of orders) {
    if (!isSale(o)) continue;
    const created = new Date(o.created_at);
    if (Number.isNaN(created.getTime())) continue;
    const key = startOfLocalDay(created).getTime();
    const bucket = buckets.find(b => b.day.getTime() === key);
    if (bucket) bucket.total += num(o.total);
  }
  return buckets;
}

export interface StatusSlice {
  status: string;
  count: number;
}

/** Répartition des commandes par statut, toutes commandes confondues (les annulées y figurent : c'est le but). */
export function statusBreakdown(orders: DashboardOrder[]): StatusSlice[] {
  const counts = new Map<string, number>();
  for (const o of orders) {
    const status = o.order_status || "new";
    counts.set(status, (counts.get(status) || 0) + 1);
  }
  return [...counts.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count);
}

export interface TopProduct {
  name: string;
  revenue: number;
  qty: number;
}

/** Meilleurs produits par chiffre d'affaires, ventes seulement. */
export function topProducts(orders: DashboardOrder[], limit = 5): TopProduct[] {
  const stats = new Map<string, TopProduct>();
  for (const o of orders) {
    if (!isSale(o) || !Array.isArray(o.order_items)) continue;
    for (const item of o.order_items) {
      const name = item.product_name || "Produit supprimé";
      let entry = stats.get(name);
      if (!entry) {
        entry = { name, revenue: 0, qty: 0 };
        stats.set(name, entry);
      }
      entry.revenue += num(item.total_price);
      entry.qty += item.quantity == null ? 1 : num(item.quantity);
    }
  }
  return [...stats.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}
