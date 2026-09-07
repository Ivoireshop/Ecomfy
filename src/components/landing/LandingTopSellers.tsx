import React, { useEffect, useState } from "react";
import { Crown, Trophy, TrendingUp, Award, ShieldCheck, CheckCircle2, Flame, BarChart3, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TopSellerItem {
  shop_id: string;
  full_name: string | null;
  shop_name: string | null;
  slug: string | null;
  avatar_url: string | null;
  logo_url: string | null;
  total_sales: number;
  total_orders: number;
}

const formatFcfa = (amount: number): string => {
  return new Intl.NumberFormat("fr-FR").format(Math.round(amount || 0)) + " FCFA";
};

const getInitials = (name: string | null): string => {
  if (!name || !name.trim()) return "EC";
  const clean = name.trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return clean.substring(0, Math.min(2, clean.length)).toUpperCase();
};

const getDisplayName = (seller: TopSellerItem): string => {
  if (seller.full_name && seller.full_name.trim()) return seller.full_name.trim();
  if (seller.shop_name && seller.shop_name.trim()) return seller.shop_name.trim();
  return "Entrepreneur Ecomfy";
};

export const LandingTopSellers: React.FC = () => {
  const [sellers, setSellers] = useState<TopSellerItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchTopSellers = async () => {
      setLoading(true);
      try {
        // 1. Primary RPC call
        const { data: rpcData, error: rpcError } = await supabase.rpc("get_top_sellers", { p_limit: 5 });

        let processed: TopSellerItem[] = [];

        if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
          const shopIds = (rpcData as any[]).map((s: any) => s.shop_id).filter(Boolean);

          let shopDetailsMap: Record<string, { logo_url?: string; business_name?: string }> = {};
          if (shopIds.length > 0) {
            const { data: shopsData } = await supabase
              .from("shops")
              .select("id, logo_url, business_name")
              .in("id", shopIds);

            if (shopsData) {
              (shopsData as any[]).forEach((s) => {
                shopDetailsMap[s.id] = { logo_url: s.logo_url || undefined, business_name: s.business_name || undefined };
              });
            }
          }

          processed = (rpcData as any[]).map((item: any) => {
            const shopExtra = shopDetailsMap[item.shop_id] || {};
            return {
              shop_id: item.shop_id,
              full_name: item.full_name || null,
              shop_name: shopExtra.business_name || null,
              slug: item.slug || null,
              avatar_url: item.avatar_url || null,
              logo_url: shopExtra.logo_url || null,
              total_sales: Number(item.total_sales || 0),
              total_orders: Number(item.total_orders || 0),
            };
          });
        } else {
          // 2. Direct Supabase Query Fallback
          const { data: directShops } = await supabase
            .from("shops")
            .select("id, business_name, slug, logo_url, total_sales, total_orders, user_id, is_published, is_activated, is_suspended")
            .eq("is_published", true)
            .eq("is_activated", true)
            .eq("is_suspended", false)
            .gt("total_sales", 0)
            .order("total_sales", { ascending: false })
            .limit(5);

          if (directShops && directShops.length > 0) {
            const userIds = (directShops as any[]).map((s) => s.user_id).filter(Boolean);
            let profileMap: Record<string, { full_name?: string; avatar_url?: string }> = {};

            if (userIds.length > 0) {
              const { data: profiles } = await supabase
                .from("profiles")
                .select("id, full_name, avatar_url")
                .in("id", userIds);

              if (profiles) {
                (profiles as any[]).forEach((p) => {
                  profileMap[p.id] = { full_name: p.full_name || undefined, avatar_url: p.avatar_url || undefined };
                });
              }
            }

            processed = (directShops as any[]).map((s) => {
              const prof = profileMap[s.user_id] || {};
              return {
                shop_id: s.id,
                full_name: prof.full_name || null,
                shop_name: s.business_name || null,
                slug: s.slug || null,
                avatar_url: prof.avatar_url || null,
                logo_url: s.logo_url || null,
                total_sales: Number(s.total_sales || 0),
                total_orders: Number(s.total_orders || 0),
              };
            });
          }
        }

        // Sort descending by total_sales and take top 5
        processed.sort((a, b) => b.total_sales - a.total_sales);
        setSellers(processed.slice(0, 5));
      } catch (err) {
        console.error("Error fetching top sellers:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTopSellers();
  }, []);

  if (loading || sellers.length === 0) {
    return null;
  }

  const top1 = sellers[0];
  const runnersUp = sellers.slice(1);
  const totalCombinedSales = sellers.reduce((acc, curr) => acc + curr.total_sales, 0);

  return (
    <section className="relative py-24 bg-[#0A0F1D] text-white overflow-hidden font-['Inter',sans-serif]">
      
      {/* Premium Background Atmosphere Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-[#0E7C66]/25 via-[#C9A84C]/10 to-transparent blur-[140px] rounded-full" />
        <div className="absolute bottom-0 right-10 w-[400px] h-[400px] bg-emerald-500/10 blur-[120px] rounded-full" />
        <div className="absolute top-1/3 left-10 w-[350px] h-[350px] bg-amber-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header with Pure Business / Trophy Icon (No AI Sparkles) */}
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#0E7C66]/20 via-slate-800 to-[#C9A84C]/20 border border-[#0E7C66]/40 text-[#E8D18C] text-xs font-bold uppercase tracking-widest backdrop-blur-xl shadow-lg shadow-[#0E7C66]/10">
            <Trophy className="w-4 h-4 text-[#C9A84C] shrink-0" />
            <span>HALL OF FAME · PREUVE SOCIALE</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
            LES MEILLEURS VENDEURS SUR <span className="bg-gradient-to-r from-[#0E7C66] via-emerald-400 to-[#C9A84C] bg-clip-text text-transparent">ECOMFY</span>
          </h2>

          <p className="text-slate-300 text-base sm:text-lg font-medium leading-relaxed">
            Découvrez les entrepreneurs qui génèrent les plus gros chiffres d'affaires grâce à leurs ventes sur Ecomfy.
          </p>

          <div className="inline-flex items-center gap-2 text-xs sm:text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-4 py-1.5 rounded-full font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Des entrepreneurs développent déjà leur activité et réalisent des ventes avec Ecomfy. Qui sera le prochain ?</span>
          </div>
        </div>

        {/* TOP 1 SUPER-HERO SPOTLIGHT CARD */}
        {top1 && (
          <div className="max-w-4xl mx-auto mb-16">
            <div className="relative rounded-3xl bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-[#0A0F1D] border-2 border-[#C9A84C]/60 p-6 sm:p-10 shadow-[0_0_60px_rgba(201,168,76,0.2)] hover:shadow-[0_0_80px_rgba(201,168,76,0.3)] transition-all duration-300 backdrop-blur-2xl group">
              
              {/* TOP 1 BADGE HEADER */}
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full bg-gradient-to-r from-[#C9A84C] via-[#F3E5AB] to-[#C9A84C] text-slate-950 font-black text-xs tracking-widest uppercase shadow-xl shadow-[#C9A84C]/40 flex items-center gap-2 border border-yellow-200">
                <Crown className="w-4 h-4 text-slate-950 fill-slate-950" />
                <span>🥇 TOP 1 VENDEUR ECOMFY</span>
              </div>

              <div className="flex flex-col lg:flex-row items-center justify-between gap-8 pt-4">
                
                {/* Avatar & Owner Identity */}
                <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                  <div className="relative">
                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden ring-4 ring-[#C9A84C] ring-offset-4 ring-offset-slate-950 shadow-2xl bg-slate-950 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                      {top1.avatar_url || top1.logo_url ? (
                        <img
                          src={top1.avatar_url || top1.logo_url || ""}
                          alt={getDisplayName(top1)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0E7C66] via-slate-800 to-[#C9A84C]/50 text-white font-black text-3xl">
                          {getInitials(getDisplayName(top1))}
                        </div>
                      )}
                    </div>

                    <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-[#C9A84C] to-amber-500 text-slate-950 p-2 rounded-full shadow-lg border border-yellow-200">
                      <Trophy className="w-5 h-5 fill-slate-950" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Compte Vendeur Officiel & Vérifié
                    </div>

                    <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                      {getDisplayName(top1)}
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-400 font-medium">
                      Leader du classement général des ventes Ecomfy
                    </p>
                  </div>
                </div>

                {/* CA Amount Highlight Box */}
                <div className="w-full lg:w-auto text-center lg:text-right p-6 rounded-2xl bg-slate-950/90 border border-[#C9A84C]/40 shadow-inner space-y-1">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    Chiffre d'affaires généré sur Ecomfy
                  </span>
                  <div className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-white via-[#F3E5AB] to-[#C9A84C] bg-clip-text text-transparent font-mono tracking-tight">
                    {formatFcfa(top1.total_sales)}
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold pt-1">
                    <TrendingUp className="w-3.5 h-3.5" /> Ventes réelles certifiées
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RUNNERS-UP GRID (TOP 2 TO TOP 5) */}
        {runnersUp.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {runnersUp.map((seller, index) => {
              const rank = index + 2; // Rank 2, 3, 4, 5
              const isRank2 = rank === 2;
              const isRank3 = rank === 3;

              let rankLabel = `${rank}e`;
              let badgeBg = "bg-slate-800/80 text-slate-300 border-slate-700";
              let ringColor = "ring-slate-700";
              let cardBorder = "border-slate-800 hover:border-slate-700";

              if (isRank2) {
                rankLabel = "🥈 2e VENDEUR";
                badgeBg = "bg-slate-200 text-slate-950 font-black border-white shadow-md shadow-slate-200/20";
                ringColor = "ring-slate-300";
                cardBorder = "border-slate-700 hover:border-slate-500 shadow-slate-900/80";
              } else if (isRank3) {
                rankLabel = "🥉 3e VENDEUR";
                badgeBg = "bg-gradient-to-r from-amber-700 to-amber-600 text-amber-100 font-black border-amber-500 shadow-md";
                ringColor = "ring-amber-600";
                cardBorder = "border-amber-900/50 hover:border-amber-700/60";
              }

              return (
                <div
                  key={seller.shop_id}
                  className={`relative rounded-2xl bg-slate-900/90 border ${cardBorder} p-6 flex flex-col justify-between hover:-translate-y-2 transition-all duration-300 backdrop-blur-xl shadow-xl group`}
                >
                  {/* Rank Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs border tracking-wider ${badgeBg}`}>
                      {rankLabel}
                    </span>
                    <BarChart3 className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors" />
                  </div>

                  {/* Seller Avatar & Name */}
                  <div className="flex flex-col items-center text-center space-y-3 my-2">
                    <div className={`w-20 h-20 rounded-full overflow-hidden ring-3 ${ringColor} ring-offset-2 ring-offset-slate-900 bg-slate-950 flex items-center justify-center group-hover:scale-105 transition-transform duration-300`}>
                      {seller.avatar_url || seller.logo_url ? (
                        <img
                          src={seller.avatar_url || seller.logo_url || ""}
                          alt={getDisplayName(seller)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0E7C66]/40 via-slate-800 to-slate-900 text-white font-extrabold text-xl">
                          {getInitials(getDisplayName(seller))}
                        </div>
                      )}
                    </div>

                    <div className="w-full">
                      <h4 className="font-extrabold text-white text-base truncate group-hover:text-emerald-300 transition-colors">
                        {getDisplayName(seller)}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                        Entrepreneur Ecomfy
                      </p>
                    </div>
                  </div>

                  {/* CA Amount */}
                  <div className="mt-4 pt-4 border-t border-slate-800 text-center bg-slate-950/60 p-3 rounded-xl">
                    <div className="text-xl font-black text-emerald-400 font-mono tracking-tight">
                      {formatFcfa(seller.total_sales)}
                    </div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mt-1">
                      Ventes générées via Ecomfy
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Live Transparency & Security Guarantee Banner */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-3 text-xs sm:text-sm text-slate-300 bg-slate-900/80 border border-slate-800 px-6 py-3 rounded-full backdrop-blur-xl shadow-lg">
            <Award className="w-5 h-5 text-[#C9A84C] shrink-0" />
            <span>Classement calculé en temps réel selon les ventes officielles et commandes certifiées enregistrées sur Ecomfy.</span>
          </div>
        </div>

      </div>
    </section>
  );
};
