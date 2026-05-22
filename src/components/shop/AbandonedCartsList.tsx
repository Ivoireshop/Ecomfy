import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Phone, Mail, MapPin, Trash2, MessageCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface AbandonedCart {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_city: string | null;
  customer_address: string | null;
  items: any[];
  items_count: number;
  total: number;
  created_at: string;
  updated_at: string;
}

export function AbandonedCartsList({ shopId }: { shopId: string }) {
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("abandoned_carts" as any)
      .select("*")
      .eq("shop_id", shopId)
      .eq("converted", false)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      setCarts((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`abandoned-${shopId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "abandoned_carts", filter: `shop_id=eq.${shopId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  const remove = async (id: string) => {
    const { error } = await supabase.from("abandoned_carts" as any).delete().eq("id", id);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else setCarts(prev => prev.filter(c => c.id !== id));
  };

  const relance = (cart: AbandonedCart) => {
    if (!cart.customer_phone) return;
    const phone = cart.customer_phone.replace(/[^\d]/g, "");
    const msg = encodeURIComponent(`Bonjour ${cart.customer_name || ""}, vous avez laissé ${cart.items_count} article(s) dans votre panier. Souhaitez-vous finaliser votre commande ?`);
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" /> Paniers abandonnés
            <Badge className="bg-green-500 text-white">NEW</Badge>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Visiteurs ayant rempli leurs coordonnées sans valider leur commande.
          </p>
        </div>
        <Badge variant="outline">{carts.length} panier{carts.length > 1 ? "s" : ""}</Badge>
      </div>

      {carts.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Aucun panier abandonné pour l'instant.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {carts.map(cart => (
            <Card key={cart.id} className="p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px] space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{cart.customer_name || "Sans nom"}</span>
                    <Badge variant="secondary" className="text-xs">
                      {cart.items_count} produit{cart.items_count > 1 ? "s" : ""}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(cart.updated_at), { addSuffix: true, locale: fr })}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {cart.customer_phone && (
                      <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {cart.customer_phone}</div>
                    )}
                    {cart.customer_email && (
                      <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {cart.customer_email}</div>
                    )}
                    {(cart.customer_city || cart.customer_address) && (
                      <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {[cart.customer_address, cart.customer_city].filter(Boolean).join(", ")}</div>
                    )}
                  </div>
                  {cart.items?.length > 0 && (
                    <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
                      {cart.items.map((it: any, i: number) => (
                        <div key={i} className="flex justify-between">
                          <span>{it.name} × {it.quantity}</span>
                          <span>{Number(it.price * it.quantity).toLocaleString()} FCFA</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-lg font-bold">{Number(cart.total).toLocaleString()} FCFA</div>
                  <div className="flex gap-2">
                    {cart.customer_phone && (
                      <Button size="sm" variant="outline" onClick={() => relance(cart)} className="gap-1.5">
                        <MessageCircle className="h-3.5 w-3.5" /> Relancer
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => remove(cart.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}