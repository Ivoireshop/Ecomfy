import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Store, Eye, Settings, Package, TrendingUp, ShoppingBag, BarChart3, ArrowUpRight, Zap } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Shop {
  id: string;
  business_name: string;
  business_description: string | null;
  slug: string;
  logo_url: string | null;
  banner_url: string | null;
  is_activated: boolean;
  is_published: boolean;
  total_orders: number;
  total_sales: number;
  currency: string;
  primary_color: string | null;
  created_at: string;
}

const ShopManager = () => {
  const navigate = useNavigate();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchShops();
  }, []);

  const fetchShops = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from("shops")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erreur", description: "Impossible de charger vos boutiques", variant: "destructive" });
    } else {
      setShops((data as any[]) || []);
    }
    setLoading(false);
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat("fr-FR").format(amount) + " " + currency;
  };

  const totalRevenue = shops.reduce((sum, s) => sum + (s.total_sales || 0), 0);
  const totalOrders = shops.reduce((sum, s) => sum + (s.total_orders || 0), 0);
  const activeShops = shops.filter(s => s.is_activated).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Mes Boutiques</h1>
              <p className="text-muted-foreground mt-1">Gérez et développez votre empire e-commerce</p>
            </div>
            <Button onClick={() => navigate("/shop-builder")} size="lg" className="gap-2 shadow-lg">
              <Plus className="h-5 w-5" />
              Créer une boutique
            </Button>
          </div>

          {/* Stats Overview */}
          {shops.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              <Card className="p-4 bg-primary/5 border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Store className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{shops.length}</p>
                    <p className="text-xs text-muted-foreground">Boutiques</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 bg-green-500/5 border-green-500/20">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{activeShops}</p>
                    <p className="text-xs text-muted-foreground">Actives</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 bg-secondary/5 border-secondary/20">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                    <Package className="h-5 w-5 text-secondary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{totalOrders}</p>
                    <p className="text-xs text-muted-foreground">Commandes</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 bg-purple-500/5 border-purple-500/20">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-sm">{formatPrice(totalRevenue, "FCFA")}</p>
                    <p className="text-xs text-muted-foreground">Revenus</p>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden animate-pulse">
                <div className="h-40 bg-muted" />
                <div className="p-5">
                  <div className="h-5 bg-muted rounded w-3/4 mb-3" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </Card>
            ))}
          </div>
        ) : shops.length === 0 ? (
          <div className="max-w-lg mx-auto text-center py-20">
            <div className="h-24 w-24 mx-auto rounded-3xl bg-primary/10 flex items-center justify-center mb-6">
              <ShoppingBag className="h-12 w-12 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Lancez votre première boutique</h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Créez votre boutique en ligne en quelques minutes grâce à l'IA. 
              Vendez vos produits physiques et digitaux sans compétences techniques.
            </p>
            <Button onClick={() => navigate("/shop-builder")} size="lg" className="gap-2 shadow-lg">
              <Plus className="h-5 w-5" />
              Créer ma première boutique
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shops.map((shop) => {
              const color = shop.primary_color || "#2563eb";
              return (
                <Card key={shop.id} className="overflow-hidden group hover:shadow-xl transition-all duration-300 border-transparent hover:border-primary/20">
                  {/* Shop Banner / Visual */}
                  <div className="h-36 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}>
                    {shop.banner_url ? (
                      <img src={shop.banner_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Store className="h-16 w-16 text-primary-foreground/30" />
                      </div>
                    )}
                    {/* Status Badge */}
                    <div className="absolute top-3 right-3">
                      {shop.is_activated ? (
                        shop.is_published ? (
                          <Badge className="bg-green-500/90 text-primary-foreground shadow-sm">En ligne</Badge>
                        ) : (
                          <Badge className="bg-secondary/90 text-secondary-foreground shadow-sm">Hors ligne</Badge>
                        )
                      ) : (
                        <Badge variant="outline" className="bg-background/80 backdrop-blur-sm">Non activée</Badge>
                      )}
                    </div>
                    {/* Logo overlay */}
                    {shop.logo_url && (
                      <div className="absolute bottom-3 left-4">
                        <img src={shop.logo_url} alt="" className="h-12 w-12 rounded-xl object-cover border-2 border-background shadow-lg" />
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <h3 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">{shop.business_name}</h3>
                    <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      visualpro.app/shop/{shop.slug}
                    </p>

                    {/* Mini Stats */}
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <div className="bg-muted/50 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold">{shop.total_orders || 0}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Commandes</p>
                      </div>
                      <div className="bg-muted/50 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold">{formatPrice(shop.total_sales || 0, "")}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Revenus</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button 
                        className="flex-1 gap-2" 
                        onClick={() => navigate(`/shop-editor/${shop.id}`)}
                      >
                        <Settings className="h-4 w-4" />
                        Gérer
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => window.open(`/shop/${shop.slug}`, "_blank")}
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}

            {/* Add New Shop Card */}
            <Card 
              className="overflow-hidden border-dashed border-2 hover:border-primary/50 cursor-pointer transition-all duration-300 flex items-center justify-center min-h-[320px] group"
              onClick={() => navigate("/shop-builder")}
            >
              <div className="text-center p-8">
                <div className="h-16 w-16 mx-auto rounded-2xl bg-muted group-hover:bg-primary/10 flex items-center justify-center mb-4 transition-colors">
                  <Plus className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="font-semibold text-muted-foreground group-hover:text-foreground transition-colors">Nouvelle boutique</p>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShopManager;
