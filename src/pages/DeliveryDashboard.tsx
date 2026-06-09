import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Truck, Phone, MessageCircle, MapPin, Package, Settings, Store } from "lucide-react";
import { toast } from "sonner";

const STATUS_MAP: Record<string, string> = {
  confirmed: "Confirmé",
  processing: "En traitement",
  shipped: "Expédié",
  delivered: "Livré",
  cancelled: "Annulé",
};

export default function DeliveryDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [shops, setShops] = useState<Record<string, any>>({});

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth?redirect=/delivery-dashboard"); return; }
    const { data: prov } = await supabase.from("delivery_providers").select("*").eq("user_id", user.id).maybeSingle();
    if (!prov) { navigate("/delivery-signup"); return; }
    setProvider(prov);

    const { data: ords } = await supabase
      .from("orders")
      .select("*, order_items(id, product_name, quantity, unit_price, total_price)")
      .eq("delivery_provider_id", prov.id)
      .order("delivery_transferred_at", { ascending: false })
      .limit(200);
    setOrders(ords || []);

    const shopIds = [...new Set((ords || []).map(o => o.shop_id))];
    if (shopIds.length) {
      const { data: sh } = await supabase.from("shops").select("id, business_name, whatsapp_number, phone_number, slug").in("id", shopIds);
      const map: Record<string, any> = {};
      (sh || []).forEach(s => { map[s.id] = s; });
      setShops(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.from("orders").update({ order_status: status }).eq("id", orderId);
    if (error) { toast.error(error.message); return; }
    toast.success("Statut mis à jour");
    load();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const stats = {
    total: orders.length,
    pending: orders.filter(o => ["confirmed","processing"].includes(o.order_status)).length,
    shipped: orders.filter(o => o.order_status === "shipped").length,
    delivered: orders.filter(o => o.order_status === "delivered").length,
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Truck className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold">{provider.company_name}</h1>
            <p className="text-sm text-muted-foreground">Tableau de bord livreur</p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/delivery-signup"><Settings className="h-4 w-4 mr-1" /> Modifier ma fiche</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Total commandes</div><div className="text-2xl font-bold">{stats.total}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">À traiter</div><div className="text-2xl font-bold text-blue-600">{stats.pending}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Expédiées</div><div className="text-2xl font-bold text-purple-600">{stats.shipped}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Livrées</div><div className="text-2xl font-bold text-emerald-600">{stats.delivered}</div></Card>
      </div>

      <h2 className="text-lg font-semibold flex items-center gap-2"><Package className="h-5 w-5" /> Commandes transférées</h2>

      {orders.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Aucune commande pour l'instant. Demandez aux boutiques de vous connecter dans <strong>Paramètres → Livraison</strong>.
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map(o => {
            const shop = shops[o.shop_id];
            const phone = (o.customer_phone || "").replace(/[^0-9+]/g, "");
            return (
              <Card key={o.id} className="p-4">
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="font-semibold">{o.order_number}</span>
                      <Badge>{STATUS_MAP[o.order_status] || o.order_status}</Badge>
                      <Badge variant="outline">{o.payment_method === "mobile_money" ? "Mobile Money" : "À la livraison"}</Badge>
                      {shop && <Badge variant="secondary" className="gap-1"><Store className="h-3 w-3" /> {shop.business_name}</Badge>}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Client : </span><strong>{o.customer_name}</strong></div>
                      <div><span className="text-muted-foreground">Téléphone : </span>{o.customer_phone}</div>
                      {o.customer_address && <div className="sm:col-span-2 flex gap-1"><MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /> <span>{o.customer_address}{o.customer_city ? `, ${o.customer_city}` : ""}</span></div>}
                      <div><span className="text-muted-foreground">Total : </span><strong>{Number(o.total).toLocaleString("fr-FR")} FCFA</strong></div>
                      {o.delivery_transferred_at && <div className="text-xs text-muted-foreground">Reçue le {new Date(o.delivery_transferred_at).toLocaleString("fr-FR")}</div>}
                    </div>
                    {o.order_items?.length ? (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {o.order_items.map((it: any) => `${it.quantity}× ${it.product_name}`).join(" · ")}
                      </div>
                    ) : null}
                    {o.notes && <div className="mt-2 text-xs bg-muted/50 rounded p-2">📝 {o.notes}</div>}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Select value={o.order_status} onValueChange={(v) => updateStatus(o.id, v)}>
                      <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {phone && (
                      <div className="flex gap-2">
                        <Button asChild size="sm" variant="outline" className="h-9 flex-1"><a href={`tel:${phone}`}><Phone className="h-4 w-4 mr-1" /> Appeler</a></Button>
                        <Button asChild size="sm" className="h-9 flex-1 bg-green-600 hover:bg-green-700 text-white">
                          <a href={`https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent(`Bonjour ${o.customer_name}, votre commande ${o.order_number} est en cours de livraison.`)}`} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}