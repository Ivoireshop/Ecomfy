import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Crown, Medal, Sparkles } from "lucide-react";

interface Seller {
  shop_id: string;
  full_name: string | null;
  slug: string | null;
  avatar_url: string | null;
  total_sales: number;
  total_orders: number;
}

const formatFcfa = (n: number) =>
  new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";

const getInitials = (name: string | null) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0]?.charAt(0).toUpperCase() || "?";
};

const firstName = (name: string | null) => {
  if (!name) return "Vendeur";
  return name.trim().split(/\s+/)[0] || "Vendeur";
};

const rankAccent = (rank: number) => {
  if (rank === 1) return { ring: "ring-[#c9a84c]", glow: "shadow-[0_0_30px_rgba(201,168,76,0.45)]", chip: "bg-[#c9a84c] text-[#0f1b3d]", label: "OR" };
  if (rank === 2) return { ring: "ring-[#d8d8e0]", glow: "shadow-[0_0_22px_rgba(216,216,224,0.35)]", chip: "bg-[#d8d8e0] text-[#0f1b3d]", label: "ARGENT" };
  if (rank === 3) return { ring: "ring-[#c98a4c]", glow: "shadow-[0_0_22px_rgba(201,138,76,0.35)]", chip: "bg-[#c98a4c] text-[#0f1b3d]", label: "BRONZE" };
  return { ring: "ring-white/15", glow: "", chip: "bg-white/10 text-white", label: `#${rank}` };
};

const SellerCard = ({ seller, rank }: { seller: Seller; rank: number }) => {
  const a = rankAccent(rank);
  return (
    <div className="shrink-0 w-[220px] md:w-[260px] mx-3">
      <div className={`relative rounded-2xl bg-gradient-to-b from-[#1e3a5f]/90 to-[#0f1b3d] border border-white/10 p-5 ${a.glow} hover:-translate-y-1 transition-transform duration-300`}>
        <div className={`absolute -top-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${a.chip}`}>
          {a.label}
        </div>
        {rank === 1 && (
          <Crown className="absolute -top-3 right-3 w-5 h-5 text-[#c9a84c] drop-shadow-[0_0_8px_rgba(201,168,76,0.8)]" />
        )}
        <div className="flex flex-col items-center text-center pt-2">
          <div className={`rounded-full overflow-hidden ring-2 ring-offset-2 ring-offset-[#0f1b3d] ${a.ring}`} style={{ width: 84, height: 84 }}>
            {seller.avatar_url ? (
              <img src={seller.avatar_url} alt={firstName(seller.full_name)} loading="lazy" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1e3a5f] to-[#0f1b3d] text-[#e8edf3] font-bold text-2xl">
                {getInitials(seller.full_name)}
              </div>
            )}
          </div>
          <div className="mt-3 font-semibold text-[#e8edf3] truncate w-full">{firstName(seller.full_name)}</div>
          <div className="mt-1 text-lg font-extrabold text-[#c9a84c] tabular-nums">{formatFcfa(seller.total_sales)}</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/50 mt-1">Encaissé</div>
        </div>
      </div>
    </div>
  );
};

export const TopSellersLeaderboard = () => {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_top_sellers", { p_limit: 5 });
      setSellers((data as Seller[]) || []);
      setLoading(false);
    })();
  }, []);

  if (loading || sellers.length === 0) return null;

  // Duplicate for seamless marquee loop
  const loop = [...sellers, ...sellers];

  return (
    <section className="relative py-14 md:py-20 overflow-hidden bg-[#0f1b3d]">
      {/* Subtle grain / spotlight */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,168,76,0.18),transparent_60%)] pointer-events-none" />
      <div className="absolute inset-y-0 left-0 w-24 md:w-40 bg-gradient-to-r from-[#0f1b3d] to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-24 md:w-40 bg-gradient-to-l from-[#0f1b3d] to-transparent z-10 pointer-events-none" />

      <div className="relative container mx-auto px-4 text-center mb-8 md:mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#c9a84c]/15 border border-[#c9a84c]/40 text-[#c9a84c] text-[11px] font-semibold tracking-wider uppercase mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          Hall of Fame · Top 5 vendeurs
        </div>
        <h2 className="text-3xl md:text-5xl font-bold text-[#e8edf3] tracking-tight">
          Ils encaissent.{" "}
          <span className="bg-gradient-to-r from-[#c9a84c] to-[#f0d78c] bg-clip-text text-transparent">
            Et vous ?
          </span>
        </h2>
        <p className="text-sm md:text-base text-[#e8edf3]/70 mt-3 max-w-xl mx-auto">
          Ces entrepreneurs construisent leur empire sur VisuelPro. Votre nom peut briller ici dès ce mois-ci.
        </p>
      </div>

      <div className="relative flex overflow-hidden group">
        <div className="flex animate-marquee group-hover:[animation-play-state:paused] py-4">
          {loop.map((s, i) => (
            <SellerCard key={`${s.shop_id}-${i}`} seller={s} rank={(i % sellers.length) + 1} />
          ))}
        </div>
      </div>

      <div className="relative container mx-auto px-4 mt-8 text-center">
        <div className="inline-flex items-center gap-2 text-[#e8edf3]/60 text-xs">
          <Medal className="w-4 h-4 text-[#c9a84c]" />
          Classement mis à jour en temps réel
        </div>
      </div>
    </section>
  );
};

export default TopSellersLeaderboard;
