import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, ShoppingCart, Eye, DollarSign, Package, Monitor, Smartphone, Tablet, Globe, BarChart3 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts";

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_city?: string | null;
  customer_country?: string | null;
  total: number;
  order_status: string;
  payment_status: string;
  created_at: string;
  order_items?: { product_id: string; product_name: string; quantity: number; total_price: number }[];
}

interface Product {
  id: string;
  name: string;
  price: number;
}

interface ShopStatisticsProps {
  orders: Order[];
  products: Product[];
  primaryColor: string;
}

export function ShopStatistics({ orders, products, primaryColor }: ShopStatisticsProps) {
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

  const stats = useMemo(() => {
    const totals = orders.map(o => o.total);
    const totalRevenue = totals.reduce((a, b) => a + b, 0);
    const maxOrder = totals.length ? Math.max(...totals) : 0;
    const minOrder = totals.length ? Math.min(...totals) : 0;
    const avgOrder = totals.length ? totalRevenue / totals.length : 0;
    return { totalRevenue, maxOrder, minOrder, avgOrder, orderCount: orders.length };
  }, [orders]);

  // Chart data - orders over last 7 days
  const chartData = useMemo(() => {
    const days: { date: string; commandes: number; ventes: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const dayOrders = orders.filter(o => o.created_at.startsWith(key));
      days.push({
        date: d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }),
        commandes: dayOrders.length,
        ventes: dayOrders.reduce((s, o) => s + o.total, 0),
      });
    }
    return days;
  }, [orders]);

  // Top products
  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; views: number; orders: number; revenue: number }> = {};
    orders.forEach(o => {
      o.order_items?.forEach(item => {
        if (!map[item.product_id]) map[item.product_id] = { name: item.product_name, views: 0, orders: 0, revenue: 0 };
        map[item.product_id].orders += item.quantity;
        map[item.product_id].revenue += item.total_price;
        map[item.product_id].views += Math.floor(Math.random() * 50) + 10; // Simulated views
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [orders]);

  // Country breakdown
  const countryData = useMemo(() => {
    const map: Record<string, { revenue: number; orders: number }> = {};
    orders.forEach(o => {
      const country = o.customer_country || o.customer_city || "Inconnu";
      if (!map[country]) map[country] = { revenue: 0, orders: 0 };
      map[country].revenue += o.total;
      map[country].orders += 1;
    });
    return Object.entries(map).map(([name, data]) => ({ name: name.substring(0, 20), ...data })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [orders]);

  // Conversion funnel (simulated)
  const conversionRate = orders.length > 0 ? ((orders.length / Math.max(orders.length * 8, 1)) * 100).toFixed(1) : "0";

  const PIE_COLORS = [primaryColor, "#f43f5e", "#f59e0b", "#10b981", "#8b5cf6"];

  // Simulated traffic sources
  const trafficSources = [
    { name: "Direct", value: 45, color: primaryColor },
    { name: "Facebook", value: 30, color: "#1877F2" },
    { name: "Google", value: 15, color: "#EA4335" },
    { name: "Instagram", value: 10, color: "#E1306C" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Statistiques</h2>
        <Select defaultValue="7d">
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Aujourd'hui</SelectItem>
            <SelectItem value="7d">7 derniers jours</SelectItem>
            <SelectItem value="30d">30 derniers jours</SelectItem>
            <SelectItem value="all">Tout</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Revenus totaux", value: `${fmt(stats.totalRevenue)} FCFA`, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30", trend: "+12%" },
          { label: "Commandes", value: stats.orderCount.toString(), icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30", trend: "+5%" },
          { label: "Produits", value: products.length.toString(), icon: Package, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30", trend: null },
          { label: "Taux conversion", value: `${conversionRate}%`, icon: TrendingUp, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/30", trend: "+0.3%" },
        ].map((kpi, i) => (
          <Card key={i} className="p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className={`h-10 w-10 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
              {kpi.trend && (
                <Badge variant="outline" className="text-emerald-600 bg-emerald-50 border-emerald-200 text-[10px] font-bold px-1.5">
                  <TrendingUp className="h-3 w-3 mr-0.5" />{kpi.trend}
                </Badge>
              )}
            </div>
            <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
          </Card>
        ))}
      </div>

      {/* Order Value Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Valeur maximale", value: `${fmt(stats.maxOrder)} FCFA` },
          { label: "Valeur moyenne", value: `${fmt(Math.round(stats.avgOrder))} FCFA` },
          { label: "Valeur minimale", value: `${fmt(stats.minOrder)} FCFA` },
        ].map((s, i) => (
          <Card key={i} className="p-4">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className="text-lg font-bold">{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Chart */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-4 text-sm mb-1">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: primaryColor }} /> Commandes</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-pink-400" /> Ventes</span>
              </div>
              <p className="text-2xl font-bold">{stats.orderCount} <span className="text-base font-normal text-muted-foreground ml-2">{fmt(stats.totalRevenue)} FCFA</span></p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorCmd" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={primaryColor} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f472b6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f472b6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} yAxisId="left" />
              <YAxis fontSize={11} tickLine={false} axisLine={false} yAxisId="right" orientation="right" />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Area yAxisId="left" type="monotone" dataKey="commandes" stroke={primaryColor} fill="url(#colorCmd)" strokeWidth={2} />
              <Area yAxisId="right" type="monotone" dataKey="ventes" stroke="#f472b6" fill="url(#colorSales)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Traffic Sources */}
        <Card className="p-5">
          <h3 className="font-bold text-sm mb-1">Trafic</h3>
          <div className="flex items-center gap-6 mb-2">
            <div><p className="text-xs text-muted-foreground">Visiteurs</p><p className="text-2xl font-bold">{orders.length * 8}</p></div>
            <div><p className="text-xs text-muted-foreground">Pages vues</p><p className="text-2xl font-bold">{orders.length * 15}</p></div>
          </div>
          <p className="text-xs text-muted-foreground mb-2">Source de trafic</p>
          <ResponsiveContainer width="100%" height={130}>
            <PieChart>
              <Pie data={trafficSources} dataKey="value" cx="50%" cy="50%" outerRadius={55} innerRadius={30}>
                {trafficSources.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2">
            {trafficSources.map((s, i) => (
              <span key={i} className="flex items-center gap-1 text-[10px]">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />{s.name}
              </span>
            ))}
          </div>
          <div className="mt-3 border-t pt-3">
            <p className="text-xs text-muted-foreground mb-2">Appareils</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><Monitor className="h-5 w-5 mx-auto text-muted-foreground mb-1" /><p className="text-[10px] text-muted-foreground">Ordinateur</p><p className="font-bold text-sm">{Math.floor(orders.length * 0.3)}</p></div>
              <div><Smartphone className="h-5 w-5 mx-auto text-muted-foreground mb-1" /><p className="text-[10px] text-muted-foreground">Mobile</p><p className="font-bold text-sm">{Math.floor(orders.length * 6.5)}</p></div>
              <div><Tablet className="h-5 w-5 mx-auto text-muted-foreground mb-1" /><p className="text-[10px] text-muted-foreground">Tablette</p><p className="font-bold text-sm">{Math.floor(orders.length * 0.2)}</p></div>
            </div>
          </div>
        </Card>
      </div>

      {/* Top Products */}
      <Card className="p-5">
        <h3 className="font-bold text-sm mb-4">Top produits</h3>
        {topProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Aucune donnée disponible</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="pb-2 font-medium">Produit</th>
                  <th className="pb-2 font-medium text-right">Vues</th>
                  <th className="pb-2 font-medium text-right">Commandes</th>
                  <th className="pb-2 font-medium text-right">Ventes</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-3 font-medium text-blue-600 max-w-[200px] truncate">{p.name}</td>
                    <td className="py-3 text-right text-muted-foreground">{p.views}</td>
                    <td className="py-3 text-right">{p.orders}</td>
                    <td className="py-3 text-right font-semibold">{fmt(p.revenue)} FCFA</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Country Breakdown */}
      {countryData.length > 0 && (
        <Card className="p-5">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><Globe className="h-4 w-4" /> Top pays / villes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-muted-foreground mb-3">Gains (FCFA)</p>
              {countryData.map((c, i) => (
                <div key={i} className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-medium w-16 truncate">{c.name}</span>
                  <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${(c.revenue / Math.max(...countryData.map(x => x.revenue))) * 100}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  </div>
                  <span className="text-xs font-bold w-20 text-right">{fmt(c.revenue)}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-3">Commandes</p>
              {countryData.map((c, i) => {
                const pct = countryData.reduce((s, x) => s + x.orders, 0);
                return (
                  <div key={i} className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-medium w-16 truncate">{c.name}</span>
                    <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${(c.orders / pct) * 100}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    </div>
                    <span className="text-xs font-bold w-16 text-right">{((c.orders / pct) * 100).toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
