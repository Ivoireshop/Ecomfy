import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Package, Bell, TrendingUp, ArrowUpRight, DollarSign, ExternalLink } from "lucide-react";
import { useMemo } from "react";
import { ShopResources } from "./ShopResources";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from "recharts";

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
  new: { label: "Nouveau", color: "bg-blue-50 text-blue-600 border border-blue-200" },
  confirmed: { label: "Confirmé", color: "bg-[#0E7C66]/10 text-[#0E7C66] border border-[#0E7C66]/20" },
  processing: { label: "En traitement", color: "bg-[#F7C04A]/10 text-[#d99f2b] border border-[#F7C04A]/20" },
  shipped: { label: "Expédié", color: "bg-purple-50 text-purple-600 border border-purple-200" },
  delivered: { label: "Livré", color: "bg-emerald-50 text-emerald-600 border border-emerald-200" },
  cancelled: { label: "Annulé", color: "bg-red-50 text-red-600 border border-red-200" },
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

  // Generate chart data for the last 7 days
  const chartData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const start = new Date(date); start.setHours(0,0,0,0);
      const end = new Date(date); end.setHours(23,59,59,999);
      
      const dayOrders = orders.filter(o => {
        const t = new Date(o.created_at).getTime();
        return t >= start.getTime() && t <= end.getTime();
      });
      
      data.push({
        name: format(date, "dd MMM", { locale: fr }),
        total: dayOrders.reduce((s, o) => s + Number(o.total || 0), 0)
      });
    }
    return data;
  }, [orders]);

  const PeriodCard = ({ label, count, total, accentClass, bgIconClass, Icon }: { label: string; count: number; total: number; accentClass: string; bgIconClass: string; Icon: any }) => (
    <Card className="p-5 bg-white border border-slate-100 shadow-sm rounded-2xl hover:shadow-md transition-shadow relative overflow-hidden group">
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-20 -mr-10 -mt-10 transition-opacity group-hover:opacity-40 ${bgIconClass}`} />
      
      <div className="flex justify-between items-start mb-4 relative z-10">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${bgIconClass}`}>
          <Icon className={`w-4 h-4 ${accentClass}`} />
        </div>
      </div>
      
      <div className="relative z-10">
        <h3 className="text-2xl font-bold text-slate-900 mb-1">{count} <span className="text-sm font-medium text-slate-400">cmd</span></h3>
        <p className={`text-sm font-semibold ${accentClass}`}>{fmt(total)} FCFA</p>
      </div>
    </Card>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header section with total revenue and greeting */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-space font-bold text-slate-900 tracking-tight">Tableau de bord</h2>
          <p className="text-slate-500 text-sm mt-1">Gérez vos commandes et analysez vos performances.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#0E7C66]/10 flex items-center justify-center text-[#0E7C66]">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Produits</p>
              <p className="font-bold text-slate-900 leading-none">{productCount}</p>
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Nouvelles</p>
              <p className="font-bold text-slate-900 leading-none">{newOrders}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <PeriodCard label="Aujourd'hui" count={periods.today.count} total={periods.today.total} accentClass="text-[#0E7C66]" bgIconClass="bg-[#0E7C66]/10" Icon={TrendingUp} />
        <PeriodCard label="Hier" count={periods.yesterday.count} total={periods.yesterday.total} accentClass="text-blue-600" bgIconClass="bg-blue-100" Icon={ShoppingCart} />
        <PeriodCard label="Cette semaine" count={periods.week.count} total={periods.week.total} accentClass="text-[#F7C04A]" bgIconClass="bg-[#F7C04A]/20" Icon={DollarSign} />
        <PeriodCard label="Ce mois" count={periods.month.count} total={periods.month.total} accentClass="text-orange-500" bgIconClass="bg-orange-100" Icon={ShoppingCart} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Revenus (7 derniers jours)</h3>
                <p className="text-sm text-slate-500">Aperçu de vos ventes récentes</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase font-semibold">Total Généré</p>
                <p className="text-xl font-bold text-[#0E7C66]">{fmt(totalRevenue)} FCFA</p>
              </div>
            </div>
            
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0E7C66" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0E7C66" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    width={80}
                  />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`${fmt(value)} FCFA`, "Revenus"]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#0E7C66" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
          
          <ShopResources />
        </div>

        {/* Recent Orders Section */}
        <div className="space-y-6">
          <Card className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-slate-800 text-lg">Commandes récentes</h3>
              <Button variant="ghost" size="sm" onClick={onViewAllOrders} className="text-[#0E7C66] hover:text-[#0E7C66] hover:bg-[#0E7C66]/10 h-8 text-xs">
                Voir tout <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </div>
            
            {orders.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm">
                  <ShoppingCart className="w-5 h-5 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-600">Aucune commande</p>
                <p className="text-xs text-slate-400 mt-1">Vos dernières commandes apparaîtront ici.</p>
              </div>
            ) : (
              <div className="space-y-3 flex-1">
                {orders.slice(0, 6).map(order => (
                  <div key={order.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-colors group cursor-default">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${!order.is_read ? 'bg-[#0E7C66]/10 text-[#0E7C66]' : 'bg-slate-100 text-slate-400'}`}>
                        <ShoppingCart className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate pr-2">
                          {order.customer_name}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-[11px] font-mono text-slate-500">{order.order_number}</p>
                          {!order.is_read && <span className="w-1.5 h-1.5 rounded-full bg-[#0E7C66]" />}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-900 mb-1">{fmt(order.total)} FCFA</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_MAP[order.order_status]?.color || 'bg-slate-100 text-slate-600'}`}>
                        {STATUS_MAP[order.order_status]?.label || order.order_status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
        
      </div>
    </div>
  );
}
