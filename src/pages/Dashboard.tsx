import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Bell, ArrowUpRight, ArrowDownRight, ShoppingBag, ShoppingCart, TrendingUp, DollarSign, Store, Image, Video } from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

const dataEvolution = [
  { name: '12 Mai', total: 1000000 },
  { name: '13 Mai', total: 2000000 },
  { name: '14 Mai', total: 3500000 },
  { name: '15 Mai', total: 5500000 },
  { name: '16 Mai', total: 7500000 },
  { name: '17 Mai', total: 9000000 },
  { name: '18 Mai', total: 11000000 },
  { name: '19 Mai', total: 12500000 },
];

const dataPie = [
  { name: 'Boutique en ligne', value: 55, color: '#F7C04A' },
  { name: 'Réseaux Sociaux', value: 35, color: '#0E7C66' },
  { name: 'Autres', value: 10, color: '#94a3b8' },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { session, isReady } = useAuthReady();
  const [profile, setProfile] = useState<{ full_name?: string | null; avatar_url?: string | null } | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!isReady) return;
    if (!session) {
      navigate("/auth", { replace: true });
      return;
    }
    void supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data ?? null));
  }, [isReady, session, navigate]);

  const rawFullName = profile?.full_name || session?.user?.user_metadata?.full_name;
  const firstName = rawFullName?.split(" ")[0] || "Utilisateur";
  const initials = firstName.substring(0, 2).toUpperCase();
  const currentDate = format(new Date(), "dd MMM yyyy", { locale: fr });

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      {/* Topbar for Dashboard */}
      <header className="h-[70px] flex items-center justify-end px-4 md:px-8 bg-white border-b border-slate-200 sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-4 md:gap-6">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-100">
            <span>📅 {currentDate}</span>
          </div>
          <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
          </button>
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
        {/* Greeting */}
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

        {/* 4 KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <p className="text-sm font-medium text-slate-500">Chiffre du jour</p>
            </div>
            <div className="mb-4">
              <h3 className="text-2xl font-bold text-slate-900">12,5M FCFA</h3>
            </div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-[#F7C04A]/20 flex items-center justify-center text-[#d99f2b]">
                <DollarSign className="w-5 h-5" />
              </div>
              <div className="flex items-center text-sm font-medium text-[#0E7C66]">
                <ArrowUpRight className="w-4 h-4 mr-1" />
                +16% <span className="text-slate-400 font-normal ml-1 text-xs">vs. hier</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <p className="text-sm font-medium text-slate-500">Commandes</p>
            </div>
            <div className="mb-4">
              <h3 className="text-2xl font-bold text-slate-900">247</h3>
            </div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-[#E85C3A]/10 flex items-center justify-center text-[#E85C3A]">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className="flex items-center text-sm font-medium text-[#0E7C66]">
                <ArrowUpRight className="w-4 h-4 mr-1" />
                +12% <span className="text-slate-400 font-normal ml-1 text-xs">vs. hier</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <p className="text-sm font-medium text-slate-500">Panier moyen</p>
            </div>
            <div className="mb-4">
              <h3 className="text-2xl font-bold text-slate-900">50 608 FCFA</h3>
            </div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div className="flex items-center text-sm font-medium text-[#0E7C66]">
                <ArrowUpRight className="w-4 h-4 mr-1" />
                +7% <span className="text-slate-400 font-normal ml-1 text-xs">vs. hier</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <p className="text-sm font-medium text-slate-500">Taux de conversion</p>
            </div>
            <div className="mb-4">
              <h3 className="text-2xl font-bold text-slate-900">3,25%</h3>
            </div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="flex items-center text-sm font-medium text-[#0E7C66]">
                <ArrowUpRight className="w-4 h-4 mr-1" />
                +5% <span className="text-slate-400 font-normal ml-1 text-xs">vs. hier</span>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Section: Chart & Top Seller */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800">Évolution du chiffre d'affaires</h3>
              <select className="bg-slate-50 border border-slate-200 text-slate-600 text-xs rounded-md px-3 py-1.5 outline-none">
                <option>7 derniers jours</option>
                <option>30 derniers jours</option>
                <option>Cette année</option>
              </select>
            </div>
            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dataEvolution} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                    tickFormatter={(value) => `${value / 1000000}M`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`${(value / 1000000).toFixed(1)}M FCFA`, "Chiffre d'affaires"]}
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

          <div className="flex flex-col gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex-1">
              <h3 className="font-bold text-slate-800 mb-6">Top vendeur du mois</h3>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm">
                  <img src="https://i.pravatar.cc/150?u=a042581f4e29026704d" alt="Chris T." className="w-full h-full object-cover" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">Chris T.</h4>
                  <p className="text-[#E85C3A] font-extrabold text-lg">12,4M FCFA</p>
                </div>
                <div className="ml-auto bg-green-50 text-[#0E7C66] text-xs font-bold px-2.5 py-1 rounded-full">
                  +22%
                </div>
              </div>
              <button className="w-full py-2.5 text-sm font-semibold text-[#E85C3A] bg-[#E85C3A]/5 border border-[#E85C3A]/20 rounded-xl hover:bg-[#E85C3A]/10 transition-colors">
                Voir le classement
              </button>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex-1">
              <h3 className="font-bold text-slate-800 mb-6">Top 3 vendeurs</h3>
              <div className="flex items-end justify-center gap-4 h-[120px] mt-4">
                {/* 2nd */}
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full overflow-hidden mb-1 border-2 border-slate-100">
                    <img src="https://i.pravatar.cc/150?u=a04258a2462d826712d" alt="Amina N." className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[10px] font-medium text-slate-600 mb-1">Amina N.</span>
                  <div className="w-14 h-20 bg-slate-200 rounded-t-lg flex items-center justify-center text-slate-500 font-bold text-xl">2</div>
                </div>
                {/* 1st */}
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full overflow-hidden mb-1 border-2 border-[#F7C04A]">
                    <img src="https://i.pravatar.cc/150?u=a042581f4e29026704d" alt="Chris T." className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[10px] font-medium text-slate-600 mb-1">Chris T.</span>
                  <div className="w-16 h-28 bg-[#F7C04A] rounded-t-lg flex items-center justify-center text-white font-bold text-2xl shadow-lg">1</div>
                </div>
                {/* 3rd */}
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full overflow-hidden mb-1 border-2 border-slate-100">
                    <img src="https://i.pravatar.cc/150?u=a048581f4e29026701d" alt="Brice O." className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[10px] font-medium text-slate-600 mb-1">Brice O.</span>
                  <div className="w-14 h-16 bg-[#E85C3A] rounded-t-lg flex items-center justify-center text-white font-bold text-xl opacity-90">3</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Pie Chart & List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
            <h3 className="font-bold text-slate-800 mb-2">Ventes par canal</h3>
            <div className="flex-1 flex items-center justify-center relative min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dataPie}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {dataPie.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-slate-800">100%</span>
                <span className="text-xs text-slate-400">Total</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              {dataPie.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                    <span className="text-slate-600">{item.name}</span>
                  </div>
                  <span className="font-medium text-slate-800">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-6">Produits les plus vendus</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[#6366f1] text-white flex items-center justify-center">
                    <Store className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm">Pack Visuel Premium</h4>
                    <p className="text-xs text-slate-400">Services IA</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-800 text-sm">2,5M FCFA</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[#f43f5e] text-white flex items-center justify-center">
                    <Image className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm">Visuel Template Pro</h4>
                    <p className="text-xs text-slate-400">Templates</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-800 text-sm">1,6M FCFA</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[#f59e0b] text-white flex items-center justify-center">
                    <Video className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm">Formation Montage Avancé</h4>
                    <p className="text-xs text-slate-400">Formations</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-800 text-sm">1,2M FCFA</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;