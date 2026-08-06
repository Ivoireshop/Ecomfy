import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Search, Truck, Star, CheckCircle2, Loader2, MapPin, X } from "lucide-react";
import { toast } from "sonner";

interface Provider {
  id: string;
  company_name: string;
  slug: string | null;
  city: string | null;
  coverage_areas: string[] | null;
  description: string | null;
  logo_url: string | null;
  base_price: number | null;
  is_recommended: boolean;
  is_verified: boolean;
}

interface Connection {
  id: string;
  delivery_provider_id: string;
  status: string;
  auto_transfer: boolean;
}

export function ShopDeliveryPartners({ shopId }: { shopId: string }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: prov }, { data: conn }] = await Promise.all([
      (supabase as any).from("delivery_providers_public").select("*")
        .order("is_recommended", { ascending: false })
        .order("company_name"),
      supabase.from("shop_delivery_connections").select("id,delivery_provider_id,status,auto_transfer").eq("shop_id", shopId),
    ]);
    setProviders((prov as Provider[]) || []);
    setConnections((conn as Connection[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [shopId]);

  const connect = async (providerId: string) => {
    setBusyId(providerId);
    const { error } = await supabase.from("shop_delivery_connections")
      .insert({ shop_id: shopId, delivery_provider_id: providerId, status: "active", auto_transfer: true });
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Livreur connecté ✓");
    load();
  };

  const disconnect = async (connectionId: string) => {
    setBusyId(connectionId);
    const { error } = await supabase.from("shop_delivery_connections").delete().eq("id", connectionId);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Connexion supprimée");
    load();
  };

  const toggleAuto = async (conn: Connection) => {
    const { error } = await supabase.from("shop_delivery_connections")
      .update({ auto_transfer: !conn.auto_transfer }).eq("id", conn.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const q = query.trim().toLowerCase();
  const filtered = providers.filter(p =>
    !q || p.company_name.toLowerCase().includes(q) || (p.city || "").toLowerCase().includes(q)
    || (p.coverage_areas || []).some(a => a.toLowerCase().includes(q))
  );

  const connectionByProvider = new Map(connections.map(c => [c.delivery_provider_id, c]));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2"><Truck className="h-5 w-5" /> Partenaires de livraison</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connectez votre boutique à un service de livraison. À la confirmation d'une commande, les coordonnées du client sont automatiquement transférées au livreur.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un service de livraison, une ville…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Aucun service de livraison ne correspond à votre recherche.
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(p => {
            const conn = connectionByProvider.get(p.id);
            return (
              <Card key={p.id} className="p-4 flex flex-col sm:flex-row gap-4 sm:items-center">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  {p.logo_url ? <img src={p.logo_url} alt="" className="h-full w-full object-cover rounded-lg" /> : <Truck className="h-6 w-6 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{p.company_name}</span>
                    {p.is_recommended && (
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 gap-1">
                        <Star className="h-3 w-3 fill-current" /> Recommandé
                      </Badge>
                    )}
                    {p.is_verified && (
                      <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Vérifié</Badge>
                    )}
                  </div>
                  {p.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                    {p.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {p.city}</span>}
                    {p.base_price ? <span>À partir de {p.base_price.toLocaleString("fr-FR")} FCFA</span> : null}
                  </div>
                  {conn && (
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      <Switch checked={conn.auto_transfer} onCheckedChange={() => toggleAuto(conn)} />
                      <span className="text-muted-foreground">Transfert automatique à la confirmation</span>
                    </div>
                  )}
                </div>
                <div className="shrink-0">
                  {conn ? (
                    <Button variant="outline" size="sm" disabled={busyId === conn.id} onClick={() => disconnect(conn.id)}>
                      {busyId === conn.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="h-4 w-4 mr-1" /> Déconnecter</>}
                    </Button>
                  ) : (
                    <Button size="sm" disabled={busyId === p.id} onClick={() => connect(p.id)}>
                      {busyId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connecter"}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="p-4 bg-muted/40 text-sm">
        <p className="font-medium mb-1">Vous êtes une structure de livraison ?</p>
        <p className="text-muted-foreground text-xs mb-3">
          Inscrivez votre entreprise et soyez visible auprès de toutes les boutiques Ecomfy.
        </p>
        <Button asChild variant="outline" size="sm">
          <a href="/delivery-signup" target="_blank" rel="noopener noreferrer">Créer un compte livreur</a>
        </Button>
      </Card>
    </div>
  );
}