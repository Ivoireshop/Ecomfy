import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowUpRight, ArrowDownRight, ShoppingBag, ShoppingCart, TrendingUp, DollarSign, AlertTriangle } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import { InstallPwaBanner } from "@/components/InstallPwaBanner";
import { WebPushBanner } from "@/components/WebPushBanner";
import { DashboardVideoBanner } from "@/components/dashboard/DashboardVideoBanner";
import { affiliateService } from "@/services/affiliateService";
import {
  computeTodayKpis, dailyRevenue, statusBreakdown, topProducts as computeTopProducts,
  type DashboardOrder, type Trend,
} from "@/lib/dashboardKpis";

const ORDER_COLUMNS = "id, total, created_at, order_status, shop_id, order_items(product_name, total_price, quantity)";
const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  new: { label: "Nouveau", color: "#3b82f6" },
  confirmed: { label: "Confirmé", color: "#0E7C66" },
  processing: { label: "En traitement", color: "#F7C04A" },
  shipped: { label: "Expédié", color: "#a855f7" },
  delivered: { label: "Livré", color: "#10b981" },
  cancelled: { label: "Annulé", color: "#ef4444" },
  returned: { label: "Retourné", color: "#f97316" },
};

/** Variation affichée seulement quand elle existe : pas de comparaison possible = rien à montrer. */
const TrendBadge = ({ trend, suffix }: { trend: Trend | null; suffix: string }) => {
  if (!trend) return <span className="text-xs text-slate-400">{suffix}</span>;
  return (
    <div className={`flex items-center text-sm font-medium ${trend.up ? "text-[#0E7C66]" : "text-red-500"}`}>
      {trend.up ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
      {trend.label} <span className="text-slate-400 font-normal ml-1 text-xs">{suffix}</span>
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { session, isReady } = useAuthReady();
  const [profile, setProfile] = useState<{ full_name?: string | null; avatar_url?: string | null } | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [role, setRole] = useState<"owner" | "collaborator" | null>(null);

  useEffect(() => {
    if (!isReady) return;
    if (!session) {
      navigate("/auth", { replace: true });
      return;
    }

    // Automatically generate / pre-warm affiliate profile & link for merchant
    void affiliateService.getOrCreateProfile(session.user.id);
    void affiliateService.checkAndRecordPendingReferral(session.user.id, session.user.email);

    // Fetch profile
    void supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data ?? null));

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    // Commandes des 30 derniers jours, page par page : une requête simple s'arrête à 1000 lignes sans prévenir.
    const loadOrders = async (shopIds: string[]) => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const all: DashboardOrder[] = [];
      let complete = false;
      for (let page = 0; page < MAX_PAGES; page++) {
        const { data, error } = await supabase
          .from("orders")
          .select(ORDER_COLUMNS)
          .in("shop_id", shopIds)
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: false })
          .order("id")
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (error) throw error;
        all.push(...((data as DashboardOrder[] | null) ?? []));
        if (!data || data.length < PAGE_SIZE) { complete = true; break; }
      }
      return { rows: all, complete };
    };

    const run = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        // 1. Boutiques de l'utilisateur (propriétaire ou collaborateur actif)
        const [owned, collabs] = await Promise.all([
          supabase.from("shops").select("id").eq("user_id", session.user.id),
          supabase.from("shop_collaborators").select("shop_id").eq("user_id", session.user.id).eq("status", "active"),
        ]);
        if (owned.error) throw owned.error;
        if (collabs.error) throw collabs.error;
        if (cancelled) return;

        const ownedIds = (owned.data ?? []).map(s => s.id);
        const shopIds = [...new Set([...ownedIds, ...(collabs.data ?? []).map(c => c.shop_id)])];
        setRole(ownedIds.length > 0 ? "owner" : shopIds.length > 0 ? "collaborator" : null);

        if (shopIds.length === 0) {
          setOrders([]);
          setLoading(false);
          return;
        }

        // 2. Commandes
        const first = await loadOrders(shopIds);
        if (cancelled) return;
        setOrders(first.rows);
        setTruncated(!first.complete);
        setLoading(false);

        // 3. Temps réel : au moindre changement sur ces boutiques on recharge, car l'événement ne porte pas les
        //    lignes de commande (le top produits serait faux) et peut arriver en doublon.
        const scheduleRefresh = () => {
          clearTimeout(refreshTimer);
          refreshTimer = setTimeout(async () => {
            try {
              const next = await loadOrders(shopIds);
              if (cancelled) return;
              setOrders(next.rows);
              setTruncated(!next.complete);
            } catch (e) {
              console.error("Dashboard refresh error:", e);
            }
          }, 800);
        };
        const onChange = (payload: { new: Record<string, unknown> }) => {
          if (shopIds.includes(String(payload.new?.shop_id))) scheduleRefresh();
        };
        channel = supabase
          .channel(`dashboard-orders-${session.user.id}_${Math.random().toString(36).substring(2, 8)}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, onChange)
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, onChange)
          .subscribe();
      } catch (e) {
        console.error("Dashboard fetch error:", e);
        if (!cancelled) {
          setLoadError(true);
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      clearTimeout(refreshTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [isReady, session, navigate]);

  const rawFullName = profile?.full_name || session?.user?.user_metadata?.full_name;
  const firstName = rawFullName?.split(" ")[0] || "Utilisateur";
  const initials = firstName.substring(0, 2).toUpperCase();
  const currentDate = format(new Date(), "dd MMM yyyy", { locale: fr });

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

  const kpis = useMemo(() => computeTodayKpis(orders), [orders]);

  const chartData = useMemo(
    () => dailyRevenue(orders, 7).map(d => ({ name: format(d.day, "dd MMM", { locale: fr }), total: d.total })),
    [orders]
  );

  const pieData = useMemo(
    () => statusBreakdown(orders).map(s => ({
      name: STATUS_MAP[s.status]?.label || s.status,
      value: s.count,
      color: STATUS_MAP[s.status]?.color || "#94a3b8",
    })),
    [orders]
  );

  const topProducts = useMemo(() => computeTopProducts(orders), [orders]);

  // Pendant le chargement ou en cas d'erreur, on n'affiche pas « 0 » : ce serait un chiffre inventé.
  const ready = !loading && !loadError;
  const show = (value: string) => (ready ? value : "—");

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
              {role && (
                <p className="text-xs text-slate-500">{role === "owner" ? "Propriétaire" : "Collaborateur"}</p>
              )}
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

        {/* Video Presentation & Seller Perks Banner */}
        <DashboardVideoBanner firstName={firstName} />

        <InstallPwaBanner />
        <WebPushBanner />

        {loadError && (
          <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Impossible de charger vos chiffres.</p>
              <p>Vos données n'ont pas pu être lues, les indicateurs ci-dessous sont donc masqués. Rechargez la page ou réessayez dans un instant.</p>
            </div>
          </div>
        )}
        {ready && truncated && (
          <div role="status" className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>Vous avez un très grand nombre de commandes : seules les plus récentes sont prises en compte ici. Consultez la page Statistiques d'une boutique pour le détail.</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <p className="text-sm font-medium text-slate-500">Chiffre du jour</p>
            </div>
            <div className="mb-4">
              <h3 className="text-2xl font-bold text-slate-900">{show(`${fmt(kpis.todayRevenue)} FCFA`)}</h3>
            </div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-[#F7C04A]/20 flex items-center justify-center text-[#d99f2b]">
                <DollarSign className="w-5 h-5" />
              </div>
              {ready && <TrendBadge trend={kpis.revenueTrend} suffix="vs. hier à cette heure" />}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <p className="text-sm font-medium text-slate-500">Commandes du jour</p>
            </div>
            <div className="mb-4">
              <h3 className="text-2xl font-bold text-slate-900">{show(fmt(kpis.todayCount))}</h3>
            </div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-[#E85C3A]/10 flex items-center justify-center text-[#E85C3A]">
                <ShoppingBag className="w-5 h-5" />
              </div>
              {ready && <TrendBadge trend={kpis.countTrend} suffix="vs. hier à cette heure" />}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <p className="text-sm font-medium text-slate-500">Panier moyen du jour</p>
            </div>
            <div className="mb-4">
              <h3 className="text-2xl font-bold text-slate-900">
                {show(kpis.avgCart === null ? "—" : `${fmt(kpis.avgCart)} FCFA`)}
              </h3>
            </div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                <ShoppingCart className="w-5 h-5" />
              </div>
              {ready && kpis.avgCart === null && <span className="text-xs text-slate-400">Aucune vente aujourd'hui</span>}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <p className="text-sm font-medium text-slate-500">Commandes sur 30 jours</p>
            </div>
            <div className="mb-4">
              <h3 className="text-2xl font-bold text-slate-900">{show(fmt(kpis.windowCount))}</h3>
            </div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                <TrendingUp className="w-5 h-5" />
              </div>
              {ready && <span className="text-xs text-slate-400">{fmt(kpis.windowRevenue)} FCFA</span>}
            </div>
          </div>
        </div>

        <p className="-mt-5 mb-8 text-xs text-slate-400">
          Les commandes annulées ou retournées ne sont pas comptées dans les ventes.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800">Évolution du chiffre d'affaires (7 jours)</h3>
            </div>
            <div className="flex-1 min-h-[300px]">
              {!ready ? (
                <div className="h-full min-h-[300px] flex items-center justify-center text-sm text-slate-400">
                  {loading ? "Chargement…" : "Données indisponibles"}
                </div>
              ) : (
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
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
            <h3 className="font-bold text-slate-800 mb-2">Commandes par statut (30 jours)</h3>
            {!ready || pieData.length === 0 ? (
              <div className="flex-1 flex items-center justify-center min-h-[200px] text-sm text-slate-400 text-center">
                {loading ? "Chargement…" : loadError ? "Données indisponibles" : "Aucune commande sur les 30 derniers jours."}
              </div>
            ) : (
              <>
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
              </>
            )}
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
          ) : loadError ? (
            <p className="text-slate-500 text-sm italic">Données indisponibles.</p>
          ) : topProducts.length === 0 ? (
            <p className="text-slate-500 text-sm italic">Aucune vente sur les 30 derniers jours.</p>
          ) : (
            <div className="space-y-4">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors">
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
