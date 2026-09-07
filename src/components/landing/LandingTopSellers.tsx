import React, { useEffect, useState } from "react";
import { Crown, Trophy, TrendingUp, Sparkles, Award, ShieldCheck, CheckCircle2 } from "lucide-react";
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
          // Fetch additional shop details (like logo_url and business_name) for shop level fallback
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
          // 2. Direct Supabase Query Fallback if RPC returns no data
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

  // If loading or no eligible sellers with real sales, don't display fake data
  if (loading || sellers.length === 0) {
    return null;
  }

  const top1 = sellers[0];
  const runnersUp = sellers.slice(1);

  return (
    <section className="relative py-20 bg-slate-950 text-white overflow-hidden font-['Inter',sans-serif]">
      {/* Background Decorative Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-[#0E7C66]/20 via-[#C9A84C]/15 to-transparent blur-[120px] rounded-full" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#C9A84C]/20 to-[#0E7C66]/20 border border-[#C9A84C]/30 text-[#E8D18C] text-xs font-semibold uppercase tracking-widest backdrop-blur-md shadow-lg shadow-[#C9A84C]/5">
            <Sparkles className="w-3.5 h-3.5 text-[#C9A84C] animate-pulse" />
            <span>Hall of Fame · Preuve Sociale</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            LES MEILLEURS VENDEURS SUR <span className="bg-gradient-to-r from-[#0E7C66] via-emerald-400 to-[#C9A84C] bg-clip-text text-transparent">ECOMFY</span>
          </h2>

          <p className="text-slate-300 text-base sm:text-lg font-normal">
            Découvrez les entrepreneurs qui génèrent les plus gros chiffres d'affaires grâce à leurs ventes sur Ecomfy.
          </p>

          <p className="text-xs sm:text-sm text-slate-400 flex items-center justify-center gap-2 pt-1 font-medium">
            <ShieldCheck className="w-4 h-4 text-[#0E7C66]" />
            <span>Des entrepreneurs développent déjà leur activité et réalisent des ventes avec Ecomfy. Qui sera le prochain ?</span>
          </p>
        </div>

        {/* Top 1 Highlight Featured Card */}
        {top1 && (
          <div className="max-w-4xl mx-auto mb-12">
            <div className="relative rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border-2 border-[#C9A84C]/50 p-6 sm:p-8 shadow-[0_0_50px_rgba(201,168,76,0.15)] hover:shadow-[0_0_60px_rgba(201,168,76,0.25)] transition-all duration-300 backdrop-blur-xl">
              
              {/* Top 1 Badge Overlay */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full bg-gradient-to-r from-[#C9A84C] via-[#E8D18C] to-[#C9A84C] text-slate-950 font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-[#C9A84C]/30 flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-slate-950 fill-slate-950" />
                <span>🥇 TOP 1 VENDEUR ECOMFY</span>
              </div>

              <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-3">
                {/* Avatar & Name */}
                <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
                  <div className="relative">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden ring-4 ring-[#C9A84C] ring-offset-4 ring-offset-slate-950 shadow-xl bg-slate-900 flex items-center justify-center">
                      {top1.avatar_url || top1.logo_url ? (
                        <img
                          src={top1.avatar_url || top1.logo_url || ""}
                          alt={getDisplayName(top1)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0E7C66] via-slate-800 to-[#C9A84C]/40 text-white font-extrabold text-2xl">
                          {getInitials(getDisplayName(top1))}
                        </div>
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-[#C9A84C] text-slate-950 p-1.5 rounded-full shadow-md">
                      <Trophy className="w-4 h-4 fill-slate-950" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> Vendeur Vérifié & Actif
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                      {getDisplayName(top1)}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Performance commerciale exceptionnelle sur la plateforme
                    </p>
                  </div>
                </div>

                {/* Sales Amount */}
                <div className="text-center md:text-right p-4 rounded-2xl bg-slate-950/80 border border-[#C9A84C]/30 min-w-[240px]">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Chiffre d'affaires généré sur Ecomfy
                  </span>
                  <div className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-white via-[#E8D18C] to-[#C9A84C] bg-clip-text text-transparent font-mono">
                    {formatFcfa(top1.total_sales)}
                  </div>
                  <span className="text-[10px] text-emerald-400 flex items-center justify-center md:justify-end gap-1 mt-1">
                    <TrendingUp className="w-3 h-3" /> Ventes réelles confirmées
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Runners-Up Grid (Top 2 to Top 5) */}
        {runnersUp.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {runnersUp.map((seller, index) => {
              const rank = index + 2; // Rank 2, 3, 4, 5
              const isRank2 = rank === 2;
              const isRank3 = rank === 3;

              let rankBadge = `${rank}e`;
              let badgeStyle = "bg-slate-800 text-slate-300 border-slate-700";
              let ringStyle = "ring-slate-700";
              let cardBorder = "border-slate-800 hover:border-slate-700";

              if (isRank2) {
                rankBadge = "🥈 2e";
                badgeStyle = "bg-slate-300 text-slate-950 font-bold border-slate-200";
                ringStyle = "ring-slate-300";
                cardBorder = "border-slate-700 hover:border-slate-500 shadow-slate-900/50";
              } else if (isRank3) {
                rankBadge = "🥉 3e";
                badgeStyle = "bg-amber-700/80 text-amber-100 font-bold border-amber-600";
                ringStyle = "ring-amber-600";
                cardBorder = "border-amber-900/40 hover:border-amber-700/60";
              }

              return (
                <div
                  key={seller.shop_id}
                  className={`relative rounded-2xl bg-slate-900/90 border ${cardBorder} p-5 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300 backdrop-blur-md shadow-xl`}
                >
                  {/* Rank Chip */}
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs border ${badgeStyle}`}>
                      {rankBadge}
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                      Top {rank} Vendeur
                    </span>
                  </div>

                  {/* Seller Info */}
                  <div className="flex flex-col items-center text-center space-y-3 my-2">
                    <div className={`w-16 h-16 rounded-full overflow-hidden ring-2 ${ringStyle} ring-offset-2 ring-offset-slate-900 bg-slate-950 flex items-center justify-center`}>
                      {seller.avatar_url || seller.logo_url ? (
                        <img
                          src={seller.avatar_url || seller.logo_url || ""}
                          alt={getDisplayName(seller)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-[#0E7C66]/40 text-white font-bold text-lg">
                          {getInitials(getDisplayName(seller))}
                        </div>
                      )}
                    </div>

                    <div className="w-full">
                      <h4 className="font-bold text-white text-base truncate">
                        {getDisplayName(seller)}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        Entrepreneur Ecomfy
                      </p>
                    </div>
                  </div>

                  {/* CA Amount */}
                  <div className="mt-4 pt-3 border-t border-slate-800 text-center">
                    <div className="text-lg font-black text-emerald-400 font-mono">
                      {formatFcfa(seller.total_sales)}
                    </div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block mt-0.5">
                      Ventes générées via Ecomfy
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Proof Badge */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 text-xs text-slate-400 bg-slate-900/60 border border-slate-800/80 px-4 py-2 rounded-full backdrop-blur-md">
            <Award className="w-4 h-4 text-[#C9A84C]" />
            <span>Classement calculé en temps réel selon les ventes certifiées enregistrées sur Ecomfy</span>
          </div>
        </div>

      </div>
    </section>
  );
};
