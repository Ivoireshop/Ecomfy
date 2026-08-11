import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Bell, ArrowUpRight, ArrowDownRight, ShoppingBag, ShoppingCart, TrendingUp, DollarSign } from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

const Dashboard = () => {
  const navigate = useNavigate();
  const { session, isReady } = useAuthReady();
  const [profile, setProfile] = useState<{ full_name?: string | null; avatar_url?: string | null } | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!isReady) return;
    if (!session) {
      navigate("/auth", { replace: true });
      return;
    }
    
    // Fetch profile
    void supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data ?? null));

    // Fetch dashboard data
    const fetchDashboardData = async () => {
      setLoading(true);
      // 1. Get user shops (owned + collaborated)
      const { data: ownedShops } = await supabase.from("shops").select("id").eq("user_id", session.user.id);
      
      const { data: collabs } = await supabase
        .from("shop_collaborators")
        .select("shop_id")
        .eq("user_id", session.user.id)
        .eq("status", "active");
        
      const shopIds = [
        ...(ownedShops?.map(s => s.id) || []),
        ...(collabs?.map(c => c.shop_id) || [])
      ];
      
      if (shopIds.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }
      
      // 2. Get last 30 days orders
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: recentOrders, error } = await supabase
        .from("orders")
        .select("id, total, created_at, order_status, shop_id, order_items(product_name, total_price, quantity)")
        .in("shop_id", shopIds)
        .gte("created_at", thirtyDaysAgo.toISOString());
        
      if (error) {
        console.error("Dashboard fetch orders error:", error);
      } else {
        console.log("Dashboard fetched orders:", recentOrders);
      }
        
      setOrders(recentOrders || []);
      setLoading(false);
      
      // 3. Realtime subscription for these shops
      const channel = supabase.channel(`dashboard-orders-${session.user.id}`)
        .on(
          "postgres_changes", 
          { event: "INSERT", schema: "public", table: "orders" }, 
          (payload) => {
            if (shopIds.includes(payload.new.shop_id)) {
              console.log("New order received in realtime:", payload.new);
              setOrders(prev => [payload.new, ...prev]);
            }
          }
        )
        .on(
          "postgres_changes", 
          { event: "UPDATE", schema: "public", table: "orders" }, 
          (payload) => {
            if (shopIds.includes(payload.new.shop_id)) {
              setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o));
            }
          }
        )
        .subscribe();
        
      return () => {
        supabase.removeChannel(channel);
      };
    };
    
    const cleanup = fetchDashboardData();
    return () => {
      cleanup.then(unsub => { if (unsub) unsub() });
    };

  }, [isReady, session, navigate]);

  const rawFullName = profile?.full_name || session?.user?.user_metadata?.full_name;
  const firstName = rawFullName?.split(" ")[0] || "Utilisateur";
  const initials = firstName.substring(0, 2).toUpperCase();
  const currentDate = format(new Date(), "dd MMM yyyy", { locale: fr });
  
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

  const kpis = useMemo(() => {
    const todayStart = startOfDay(new Date()).getTime();
    const todayEnd = endOfDay(new Date()).getTime();
    
    const yesterdayStart = startOfDay(subDays(new Date(), 1)).getTime();
    const yesterdayEnd = endOfDay(subDays(new Date(), 1)).getTime();
    
    let todayRevenue = 0;
    let todayCount = 0;
    let yesterdayRevenue = 0;
    let yesterdayCount = 0;
    
    orders.forEach(o => {
      const t = new Date(o.created_at).getTime();
      const total = Number(o.total || 0);
      if (t >= todayStart && t <= todayEnd) {
        todayRevenue += total;
        todayCount++;
      } else if (t >= yesterdayStart && t <= yesterdayEnd) {
        yesterdayRevenue += total;
        yesterdayCount++;
      }
    });
    
    const avgCart = todayCount > 0 ? todayRevenue / todayCount : 0;
    const revChange = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : (todayRevenue > 0 ? 100 : 0);
    const countChange = yesterdayCount > 0 ? ((todayCount - yesterdayCount) / yesterdayCount) * 100 : (todayCount > 0 ? 100 : 0);
    
    return {
      todayRevenue,
      todayCount,
      avgCart,
      revChange,
      countChange
    };
  }, [orders]);
  
  const chartData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const start = startOfDay(date).getTime();
      const end = endOfDay(date).getTime();
      
      const dayTotal = orders.filter(o => {
        const t = new Date(o.created_at).getTime();
        return t >= start && t <= end;
      }).reduce((sum, o) => sum + Number(o.total || 0), 0);
      
      data.push({
        name: format(date, "dd MMM", { locale: fr }),
        total: dayTotal
      });
    }
    return data;
  }, [orders]);
  
  const pieData = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    orders.forEach(o => {
      const status = o.order_status || 'new';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    const STATUS_MAP: Record<string, { label: string; color: string }> = {
      new: { label: "Nouveau", color: "#3b82f6" },
      confirmed: { label: "Confirmé", color: "#0E7C66" },
      processing: { label: "En traitement", color: "#F7C04A" },
      shipped: { label: "Expédié", color: "#a855f7" },
      delivered: { label: "Livré", color: "#10b981" },
      cancelled: { label: "Annulé", color: "#ef4444" },
    };
    
    const data = Object.keys(statusCounts).map(status => ({
      name: STATUS_MAP[status]?.label || status,
      value: statusCounts[status],
      color: STATUS_MAP[status]?.color || "#94a3b8"
    }));
    
    return data.length > 0 ? data : [{ name: 'Aucune', value: 1, color: '#e2e8f0' }];
  }, [orders]);
  
  const topProducts = useMemo(() => {
    const productStats: Record<string, { revenue: number, qty: number }> = {};
    orders.forEach(o => {
      if (o.order_items && Array.isArray(o.order_items)) {
        o.order_items.forEach((item: any) => {
          const name = item.product_name || 'Produit inconnu';
          if (!productStats[name]) productStats[name] = { revenue: 0, qty: 0 };
          productStats[name].revenue += Number(item.total_price || 0);
          productStats[name].qty += Number(item.quantity || 1);
        });
      }
    });
    
    return Object.entries(productStats)
      .map(([name, stats]) => ({ name, revenue: stats.revenue, qty: stats.qty }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [orders]);

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      <header className="h-[70px] flex items-center justify-end px-4 md:px-8 bg-white border-b border-slate-200 sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-4 md:gap-6">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-100">
            <span>📅 {currentDate}</span>
          </div>
          <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
            <div className="text-right hidden md:block">
              <p className="text-sm font-bold text-slate-800">{rawFullName || "Utilisateur"}</p>
              <p className="text-xs text-slate-500">Admin</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#0E7C66] text-white flex items-center justify-center font-bold text-sm overflow-hidden border-2 border-white shadow-sm">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        <div className="mb-8">
          <div className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground mb-3">
            Espace de travail
          </div>
          <h1 className="font-space font-bold text-3xl tracking-tight text-slate-900 mb-2">
            Bonjour, {firstName} 👋
          </h1>
          <p className="text-slate-500 text-sm">
            Voici un aperçu de votre activité aujourd'hui.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <p className="text-sm font-medium text-slate-500">Chiffre du jour</p>
            </div>
            <div className="mb-4">
              <h3 className="text-2xl font-bold text-slate-900">{fmt(kpis.todayRevenue)} FCFA</h3>
            </div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-[#F7C04A]/20 flex items-center justify-center text-[#d99f2b]">
                <DollarSign className="w-5 h-5" />
              </div>
              <div className={`flex items-center text-sm font-medium ${kpis.revChange >= 0 ? 'text-[#0E7C66]' : 'text-red-500'}`}>
                {kpis.revChange >= 0 ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
                {kpis.revChange > 0 ? '+' : ''}{kpis.revChange.toFixed(0)}% <span className="text-slate-400 font-normal ml-1 text-xs">vs. hier</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <p className="text-sm font-medium text-slate-500">Commandes</p>
            </div>
            <div className="mb-4">
              <h3 className="text-2xl font-bold text-slate-900">{fmt(kpis.todayCount)}</h3>
            </div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-[#E85C3A]/10 flex items-center justify-center text-[#E85C3A]">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className={`flex items-center text-sm font-medium ${kpis.countChange >= 0 ? 'text-[#0E7C66]' : 'text-red-500'}`}>
                {kpis.countChange >= 0 ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
                {kpis.countChange > 0 ? '+' : ''}{kpis.countChange.toFixed(0)}% <span className="text-slate-400 font-normal ml-1 text-xs">vs. hier</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <p className="text-sm font-medium text-slate-500">Panier moyen</p>
            </div>
            <div className="mb-4">
              <h3 className="text-2xl font-bold text-slate-900">{fmt(kpis.avgCart)} FCFA</h3>
            </div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                <ShoppingCart className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <p className="text-sm font-medium text-slate-500">Total 30 jours</p>
            </div>
            <div className="mb-4">
              <h3 className="text-2xl font-bold text-slate-900">{fmt(orders.length)}</h3>
            </div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800">Évolution du chiffre d'affaires (7 jours)</h3>
            </div>
            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F7C04A" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#F7C04A" stopOpacity={0}/>
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
                    tickFormatter={(value) => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`${fmt(value)} FCFA`, "Chiffre d'affaires"]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#F7C04A" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorTotal)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
            <h3 className="font-bold text-slate-800 mb-2">Commandes par statut</h3>
            <div className="flex-1 flex items-center justify-center relative min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-slate-800">{orders.length}</span>
                <span className="text-xs text-slate-400">Total</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              {pieData.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                    <span className="text-slate-600">{item.name}</span>
                  </div>
                  <span className="font-medium text-slate-800">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-6">Top produits (30 derniers jours)</h3>
          {loading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-200"></div>
                    <div className="space-y-2">
                      <div className="h-4 w-32 bg-slate-200 rounded"></div>
                      <div className="h-3 w-16 bg-slate-200 rounded"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : topProducts.length === 0 ? (
            <p className="text-slate-500 text-sm italic">Aucune donnée disponible pour le moment.</p>
          ) : (
            <div className="space-y-4">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
                      {i + 1}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-800 text-sm">{p.name}</h4>
                      <p className="text-xs text-slate-400">{p.qty} vendu(s)</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#0E7C66] text-sm">{fmt(p.revenue)} FCFA</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;