import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Trophy, Store } from "lucide-react";

interface Seller {
  shop_id: string;
  business_name: string | null;
  slug: string | null;
  logo_url: string | null;
  first_name: string | null;
  total_sales: number;
  total_orders: number;
}

const formatFcfa = (n: number) =>
  new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";

const rankStyles = [
  { ring: "ring-yellow-400", bg: "from-yellow-400/20 to-amber-500/10", badge: "bg-yellow-400 text-black" },
  { ring: "ring-slate-300", bg: "from-slate-300/20 to-slate-400/10", badge: "bg-slate-300 text-black" },
  { ring: "ring-amber-700", bg: "from-amber-700/20 to-orange-600/10", badge: "bg-amber-700 text-white" },
  { ring: "ring-primary/40", bg: "from-primary/10 to-secondary/10", badge: "bg-primary text-primary-foreground" },
  { ring: "ring-primary/40", bg: "from-primary/10 to-secondary/10", badge: "bg-primary text-primary-foreground" },
];

const Avatar = ({ seller, size }: { seller: Seller; size: number }) => {
  const label = (seller.first_name || seller.business_name || "?").charAt(0).toUpperCase();
  if (seller.logo_url) {
    return (
      <img
        src={seller.logo_url}
        alt={seller.business_name || seller.first_name || "Vendeur"}
        loading="lazy"
        className="w-full h-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/30 to-secondary/30 text-foreground font-bold"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {label === "?" ? <Store className="w-1/2 h-1/2 opacity-70" /> : label}
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

  const [first, ...rest] = sellers;

  return (
    <section className="py-12 md:py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3">
            <Trophy className="w-3.5 h-3.5" />
            Top vendeurs VisuelPro
          </div>
          <h2 className="text-2xl md:text-4xl font-bold">
            Ils ont déjà <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">vendu avec nous</span>
          </h2>
          <p className="text-sm md:text-base text-muted-foreground mt-2 max-w-xl mx-auto">
            Rejoignez les entrepreneurs qui font du chiffre sur VisuelPro
          </p>
        </div>

        {/* #1 podium */}
        <div className="flex justify-center mb-8">
          <Card className={`relative p-6 md:p-8 text-center bg-gradient-to-br ${rankStyles[0].bg} border-2 border-yellow-400/40 shadow-xl max-w-sm w-full`}>
            <div className={`absolute -top-3 left-1/2 -translate-x-1/2 ${rankStyles[0].badge} rounded-full px-3 py-1 text-xs font-bold flex items-center gap-1 shadow-lg`}>
              <Trophy className="w-3.5 h-3.5" /> #1
            </div>
            <div className={`mx-auto rounded-full overflow-hidden ring-4 ${rankStyles[0].ring} ring-offset-2 ring-offset-background mb-4`} style={{ width: 112, height: 112 }}>
              <Avatar seller={first} size={112} />
            </div>
            <div className="font-bold text-lg truncate">
              {first.first_name || first.business_name || "Vendeur"}
            </div>
            {first.business_name && first.first_name && (
              <div className="text-xs text-muted-foreground truncate">{first.business_name}</div>
            )}
            <div className="mt-3 text-xl md:text-2xl font-extrabold bg-gradient-to-r from-yellow-500 to-amber-600 bg-clip-text text-transparent">
              {formatFcfa(first.total_sales)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">{first.total_orders} commande{first.total_orders > 1 ? "s" : ""}</div>
          </Card>
        </div>

        {/* Others */}
        {rest.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-4xl mx-auto">
            {rest.map((s, i) => {
              const rank = i + 2;
              const style = rankStyles[i + 1] || rankStyles[3];
              return (
                <Card key={s.shop_id} className={`relative p-4 text-center bg-gradient-to-br ${style.bg} hover:shadow-lg transition-all`}>
                  <div className={`absolute -top-2 left-1/2 -translate-x-1/2 ${style.badge} rounded-full w-7 h-7 text-xs font-bold flex items-center justify-center shadow`}>
                    {rank}
                  </div>
                  <div className={`mx-auto rounded-full overflow-hidden ring-2 ${style.ring} mb-2 mt-1`} style={{ width: 64, height: 64 }}>
                    <Avatar seller={s} size={64} />
                  </div>
                  <div className="font-semibold text-sm truncate">
                    {s.first_name || s.business_name || "Vendeur"}
                  </div>
                  <div className="text-sm font-bold text-primary mt-1 truncate">
                    {formatFcfa(s.total_sales)}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default TopSellersLeaderboard;