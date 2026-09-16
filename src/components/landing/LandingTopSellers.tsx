import React, { useEffect, useState } from "react";
import { Crown, Trophy, TrendingUp, Award, ShieldCheck, CheckCircle2, BarChart3, Medal, Star } from "lucide-react";
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
        // 1. Fetch all active published shops
        const { data: directShops } = await supabase
          .from("shops")
          .select("id, business_name, slug, logo_url, total_sales, total_orders, user_id, is_published, is_activated, is_suspended")
          .eq("is_published", true)
          .eq("is_activated", true)
          .eq("is_suspended", false);

        if (!directShops || directShops.length === 0) {
          setSellers([]);
          setLoading(false);
          return;
        }

        const shopIds = directShops.map((s) => s.id);

        // 2. Fetch all valid orders for these shops to compute real-time product revenue sums
        const { data: ordersData } = await supabase
          .from("orders")
          .select("id, shop_id, total, status")
          .in("shop_id", shopIds)
          .neq("status", "cancelled");

        // Map shop_id to user_id and shop details
        const shopMap: Record<string, any> = {};
        directShops.forEach((s) => {
          shopMap[s.id] = s;
        });

        // Group & Aggregate by Seller (user_id) across ALL products & shops
        const sellerMap: Record<
          string,
          {
            userId: string;
            shops: any[];
            orderSales: number;
            orderCount: number;
            shopSales: number;
            shopOrders: number;
          }
        > = {};

        directShops.forEach((s) => {
          const uid = s.user_id;
          if (!uid) return;
          if (!sellerMap[uid]) {
            sellerMap[uid] = {
              userId: uid,
              shops: [],
              orderSales: 0,
              orderCount: 0,
              shopSales: 0,
              shopOrders: 0,
            };
          }
          sellerMap[uid].shops.push(s);
          sellerMap[uid].shopSales += Number(s.total_sales || 0);
          sellerMap[uid].shopOrders += Number(s.total_orders || 0);
        });

        if (ordersData && ordersData.length > 0) {
          ordersData.forEach((order) => {
            const shop = shopMap[order.shop_id];
            if (!shop || !shop.user_id) return;
            const uid = shop.user_id;
            if (sellerMap[uid]) {
              sellerMap[uid].orderSales += Number(order.total || 0);
              sellerMap[uid].orderCount += 1;
            }
          });
        }

        // Fetch seller profile names & avatars for user_ids
        const userIds = Object.keys(sellerMap);
        let profileMap: Record<string, { full_name?: string; avatar_url?: string }> = {};

        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .in("id", userIds);

          if (profiles) {
            profiles.forEach((p) => {
              profileMap[p.id] = { full_name: p.full_name || undefined, avatar_url: p.avatar_url || undefined };
            });
          }
        }

        // Build list of aggregated sellers with combined revenue from all products & shops
        const processed: TopSellerItem[] = userIds.map((userId) => {
          const data = sellerMap[userId];
          const prof = profileMap[userId] || {};
          const primaryShop = data.shops[0] || {};
          const shopNames = data.shops.map((s) => s.business_name).filter(Boolean).join(" & ");

          // Take the highest reliable total (orders table sum vs accumulated shop total_sales)
          const totalSales = Math.max(data.orderSales, data.shopSales);
          const totalOrders = Math.max(data.orderCount, data.shopOrders);

          return {
            shop_id: primaryShop.id || userId,
            full_name: prof.full_name || null,
            shop_name: shopNames || primaryShop.business_name || null,
            slug: primaryShop.slug || null,
            avatar_url: prof.avatar_url || null,
            logo_url: primaryShop.logo_url || null,
            total_sales: totalSales,
            total_orders: totalOrders,
          };
        });

        // Sort descending by combined total_sales and take top 5
        const finalTop = processed
          .filter((s) => s.total_sales > 0)
          .sort((a, b) => b.total_sales - a.total_sales);

        setSellers(finalTop.slice(0, 5));
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

  return (
    <section className="relative py-24 bg-[#0A0F1D] text-white overflow-hidden font-['Inter',sans-serif]">
      
      {/* Premium Background Atmosphere Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-[#0E7C66]/25 via-[#C9A84C]/10 to-transparent blur-[140px] rounded-full" />
        <div className="absolute bottom-0 right-10 w-[400px] h-[400px] bg-emerald-500/10 blur-[120px] rounded-full" />
        <div className="absolute top-1/3 left-10 w-[350px] h-[350px] bg-amber-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
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
                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden ring-4 ring-[#C9A84C] ring-offset-4 ring-offset-slate-950 shadow-[0_0_25px_rgba(201,168,76,0.5)] bg-slate-950 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
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

                    <p className="text-xs sm:text-sm text-slate-300 font-medium">
                      Leader du classement général des ventes Ecomfy
                    </p>
                  </div>
                </div>

                {/* CA Amount Highlight Box */}
                <div className="w-full lg:w-auto text-center lg:text-right p-6 rounded-2xl bg-slate-950/90 border border-[#C9A84C]/40 shadow-inner space-y-1">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    Chiffre d'affaires généré sur Ecomfy
                  </span>
                  <div className="text-2xl sm:text-3xl lg:text-4xl font-black bg-gradient-to-r from-white via-[#F3E5AB] to-[#C9A84C] bg-clip-text text-transparent font-mono tracking-tight break-words">
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

              let rankLabel = "";
              let badgeBg = "";
              let ringStyle = "";
              let cardBgBorder = "";
              let rankIcon = null;

              if (rank === 2) {
                rankLabel = "🥈 2e VENDEUR";
                badgeBg = "bg-gradient-to-r from-slate-200 via-slate-100 to-gray-300 text-slate-950 font-black border-white shadow-md shadow-slate-200/20";
                ringStyle = "ring-3 ring-slate-300 ring-offset-2 ring-offset-slate-950 shadow-[0_0_15px_rgba(203,213,225,0.4)]";
                cardBgBorder = "bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950 border-slate-700/80 hover:border-slate-400/80 shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:shadow-[0_8px_30px_rgba(203,213,225,0.2)]";
                rankIcon = <Medal className="w-3.5 h-3.5 text-slate-900" />;
              } else if (rank === 3) {
                rankLabel = "🥉 3e VENDEUR";
                badgeBg = "bg-gradient-to-r from-amber-700 via-amber-600 to-amber-800 text-amber-50 font-black border-amber-400/50 shadow-md shadow-amber-900/30";
                ringStyle = "ring-3 ring-amber-600 ring-offset-2 ring-offset-slate-950 shadow-[0_0_15px_rgba(217,119,6,0.3)]";
                cardBgBorder = "bg-gradient-to-b from-slate-900/95 via-[#18120c]/90 to-slate-950 border-amber-900/60 hover:border-amber-500/70 shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:shadow-[0_8px_30px_rgba(217,119,6,0.2)]";
                rankIcon = <Medal className="w-3.5 h-3.5 text-amber-100" />;
              } else if (rank === 4) {
                rankLabel = "🎖️ 4e VENDEUR";
                badgeBg = "bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 text-slate-200 font-bold border-slate-600/70 shadow-sm";
                ringStyle = "ring-3 ring-emerald-500/60 ring-offset-2 ring-offset-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.25)]";
                cardBgBorder = "bg-gradient-to-b from-slate-900/95 via-[#0c1815]/90 to-slate-950 border-slate-800 hover:border-emerald-500/60 shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:shadow-[0_8px_30px_rgba(16,185,129,0.18)]";
                rankIcon = <Star className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />;
              } else {
                rankLabel = "🏅 5e VENDEUR";
                badgeBg = "bg-gradient-to-r from-zinc-800 via-slate-700 to-zinc-800 text-slate-200 font-bold border-zinc-600/70 shadow-sm";
                ringStyle = "ring-3 ring-cyan-500/60 ring-offset-2 ring-offset-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.25)]";
                cardBgBorder = "bg-gradient-to-b from-slate-900/95 via-[#0c1424]/90 to-slate-950 border-slate-800 hover:border-cyan-500/60 shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:shadow-[0_8px_30px_rgba(6,182,212,0.18)]";
                rankIcon = <Star className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400" />;
              }

              return (
                <div
                  key={seller.shop_id}
                  className={`relative rounded-2xl border ${cardBgBorder} p-5 sm:p-6 flex flex-col justify-between hover:-translate-y-2 transition-all duration-300 backdrop-blur-xl group`}
                >
                  {/* Rank Badge Header & Chart Tooltip */}
                  <div className="flex items-center justify-between mb-4 gap-2">
                    <span className={`px-3 py-1 rounded-full text-[11px] sm:text-xs border tracking-wider font-extrabold flex items-center gap-1.5 ${badgeBg}`}>
                      {rankLabel}
                    </span>

                    <div
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold shadow-sm transition-colors group-hover:border-emerald-400/60"
                      title="Statistiques de ventes certifiées par Ecomfy"
                    >
                      <BarChart3 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="hidden sm:inline">Certifié</span>
                    </div>
                  </div>

                  {/* Seller Avatar & Name */}
                  <div className="flex flex-col items-center text-center space-y-3 my-2">
                    <div className={`w-20 h-20 sm:w-22 sm:h-22 rounded-full overflow-hidden ${ringStyle} bg-slate-950 flex items-center justify-center group-hover:scale-105 transition-transform duration-300`}>
                      {seller.avatar_url || seller.logo_url ? (
                        <img
                          src={seller.avatar_url || seller.logo_url || ""}
                          alt={getDisplayName(seller)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0E7C66] via-slate-800 to-slate-950 text-white font-black text-xl tracking-wider">
                          {getInitials(getDisplayName(seller))}
                        </div>
                      )}
                    </div>

                    <div className="w-full space-y-0.5">
                      <h4 className="font-extrabold text-white text-base truncate group-hover:text-emerald-300 transition-colors tracking-tight">
                        {getDisplayName(seller)}
                      </h4>
                      <p className="text-xs text-slate-300 font-medium truncate flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 inline shrink-0" />
                        <span>Entrepreneur Ecomfy</span>
                      </p>
                    </div>
                  </div>

                  {/* CA Amount Box (Anti-Truncation Fix) */}
                  <div className="mt-4 pt-3.5 pb-3 px-3 border-t border-slate-800/80 bg-slate-950/80 rounded-xl text-center flex flex-col justify-center items-center w-full">
                    <div className="text-base sm:text-lg lg:text-xl font-black text-emerald-400 font-mono tracking-tight whitespace-nowrap overflow-hidden text-ellipsis w-full">
                      {formatFcfa(seller.total_sales)}
                    </div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mt-0.5">
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
