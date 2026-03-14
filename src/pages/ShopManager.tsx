import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Store, Eye, Settings, ShoppingBag, Package } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Shop {
  id: string;
  business_name: string;
  slug: string;
  logo_url: string | null;
  is_activated: boolean;
  is_published: boolean;
  total_orders: number;
  total_sales: number;
  currency: string;
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

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Mes Boutiques</h1>
            <p className="text-muted-foreground mt-1">Gérez vos boutiques e-commerce</p>
          </div>
          <Button onClick={() => navigate("/shop-builder")} className="gap-2">
            <Plus className="h-4 w-4" />
            Créer une boutique
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6 animate-pulse">
                <div className="h-12 w-12 bg-muted rounded-lg mb-4" />
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </Card>
            ))}
          </div>
        ) : shops.length === 0 ? (
          <Card className="p-12 text-center">
            <Store className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Aucune boutique</h2>
            <p className="text-muted-foreground mb-6">
              Créez votre première boutique e-commerce et commencez à vendre vos produits en ligne.
            </p>
            <Button onClick={() => navigate("/shop-builder")} className="gap-2">
              <Plus className="h-4 w-4" />
              Créer ma première boutique
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shops.map((shop) => (
              <Card key={shop.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {shop.logo_url ? (
                      <img src={shop.logo_url} alt={shop.business_name} className="h-12 w-12 rounded-lg object-cover" />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Store className="h-6 w-6 text-primary" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold">{shop.business_name}</h3>
                      <p className="text-xs text-muted-foreground">/{shop.slug}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {shop.is_activated ? (
                      <Badge variant="default" className="text-xs">Activée</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Non activée</Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <Package className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm font-medium">{shop.total_orders}</p>
                    <p className="text-xs text-muted-foreground">Commandes</p>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <ShoppingBag className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm font-medium">{formatPrice(shop.total_sales || 0, shop.currency)}</p>
                    <p className="text-xs text-muted-foreground">Ventes</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => navigate(`/shop-editor/${shop.id}`)}>
                    <Settings className="h-3 w-3" />
                    Gérer
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => window.open(`/shop/${shop.slug}`, "_blank")}>
                    <Eye className="h-3 w-3" />
                    Voir
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShopManager;
