import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Package, Bell, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { ShopResources } from "./ShopResources";

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  total: number;
  order_status: string;
  is_read: boolean;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  new: { label: "Nouveau", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  confirmed: { label: "Confirmé", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  processing: { label: "En traitement", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  shipped: { label: "Expédié", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  delivered: { label: "Livré", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  cancelled: { label: "Annulé", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

interface ShopOverviewProps {
  orders: Order[];
  productCount: number;
  totalRevenue: number;
  newOrders: number;
  onViewAllOrders: () => void;
}

export function ShopOverview({ orders, productCount, totalRevenue, newOrders, onViewAllOrders }: ShopOverviewProps) {
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

  const periods = useMemo(() => {
    const now = new Date();
    const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
    const today = startOfDay(now);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const endYesterday = new Date(today);
    const dow = (today.getDay() + 6) % 7; // Monday=0
    const startWeek = new Date(today); startWeek.setDate(startWeek.getDate() - dow);
    const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const sum = (from: Date, to?: Date) => {
      const list = orders.filter(o => {
        const t = new Date(o.created_at).getTime();
        return t >= from.getTime() && (!to || t < to.getTime());
      });
      return { count: list.length, total: list.reduce((s, o) => s + Number(o.total || 0), 0) };
    };

    return {
      today: sum(today),
      yesterday: sum(yesterday, endYesterday),
      week: sum(startWeek),
      month: sum(startMonth),
    };
  }, [orders]);

  const PeriodCard = ({ label, count, total, accent }: { label: string; count: number; total: number; accent: string }) => (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <span className={`h-2 w-2 rounded-full ${accent}`} />
      </div>
      <p className="text-2xl font-bold leading-tight">{count}</p>
      <p className="text-[11px] text-muted-foreground mb-2">commande{count > 1 ? "s" : ""}</p>
      <p className="text-sm font-semibold text-primary">{fmt(total)} FCFA</p>
    </Card>
  );

  const QuickStat = ({ icon: Icon, value, label, color }: { icon: any; value: string | number; label: string; color: string }) => (
    <div className="flex items-center gap-3">
      <div className={`h-9 w-9 rounded-lg ${color} flex items-center justify-center`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div>
        <p className="text-lg font-bold leading-tight">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Tableau de bord</h2>

      {/* Total card + quick stats row on desktop */}
      <div className="space-y-4">
        <Card className="p-5 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total depuis l'ouverture</p>
              <div className="mt-2 flex items-end gap-6">
                <div>
                  <p className="text-3xl font-bold">{orders.length}</p>
                  <p className="text-xs text-muted-foreground">commandes totales</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-primary">{fmt(totalRevenue)}</p>
                  <p className="text-xs text-muted-foreground">FCFA générés</p>
                </div>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-6 pr-4">
              <QuickStat icon={Package} value={productCount} label="Produits" color="bg-green-500" />
              <QuickStat icon={Bell} value={newOrders} label="Nouvelles" color="bg-orange-500" />
            </div>
          </div>
        </Card>

        {/* Period cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <PeriodCard label="Aujourd'hui" count={periods.today.count} total={periods.today.total} accent="bg-primary" />
          <PeriodCard label="Hier" count={periods.yesterday.count} total={periods.yesterday.total} accent="bg-blue-500" />
          <PeriodCard label="Cette semaine" count={periods.week.count} total={periods.week.total} accent="bg-green-500" />
          <PeriodCard label="Ce mois" count={periods.month.count} total={periods.month.total} accent="bg-orange-500" />
        </div>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Commandes récentes</h3>
          <Button variant="ghost" size="sm" onClick={onViewAllOrders}>Tout voir</Button>
        </div>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucune commande pour le moment</p>
        ) : (
          <div className="space-y-3">
            {orders.slice(0, 5).map(order => (
              <div key={order.id} className={`flex items-center justify-between p-3 rounded-xl ${!order.is_read ? 'bg-primary/5' : 'bg-muted/30'}`}>
                <div className="flex items-center gap-3">
                  {!order.is_read && <div className="h-2 w-2 rounded-full bg-primary" />}
                  <div>
                    <p className="text-sm font-medium">{order.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{order.order_number}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{fmt(order.total)} FCFA</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_MAP[order.order_status]?.color || ''}`}>
                    {STATUS_MAP[order.order_status]?.label || order.order_status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ShopResources />
    </div>
  );
}
