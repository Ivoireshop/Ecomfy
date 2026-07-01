import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, RefreshCw, ShieldCheck, Lock, AlertOctagon, Clock, Search } from "lucide-react";
import { formatRemaining, computeShopPaymentInfo } from "@/lib/shopPaymentStatus";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.max(0, Math.round(n)));

const STATUS_META: Record<string, { label: string; icon: any; className: string }> = {
  active: { label: "Active", icon: ShieldCheck, className: "bg-green-100 text-green-800 border-green-300" },
  payment_pending: { label: "Paiement en attente", icon: Clock, className: "bg-amber-100 text-amber-800 border-amber-300" },
  locked: { label: "Verrouillée", icon: Lock, className: "bg-red-100 text-red-800 border-red-300" },
  final_suspension: { label: "Fermeture définitive", icon: AlertOctagon, className: "bg-red-600 text-white border-red-700" },
};

export default function ShopPaymentControl() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "pending" | "locked" | "final">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("shops")
      .select("id, business_name, user_id, commission_balance_due, commission_threshold, shop_payment_status, threshold_reached_at, first_deadline_at, locked_at, second_deadline_at, final_suspension_at, is_suspended, updated_at")
      .gt("commission_balance_due", 0)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) toast({ title: "Erreur de chargement", description: error.message, variant: "destructive" });
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const reset = async (shopId: string) => {
    setBusyId(shopId);
    const { error } = await supabase.rpc("founder_reset_shop_payment", { p_shop_id: shopId });
    setBusyId(null);
    if (error) return toast({ title: "Erreur", description: error.message, variant: "destructive" });
    toast({ title: "Boutique réactivée" });
    void load();
  };

  const filtered = rows.filter((r) => {
    const info = computeShopPaymentInfo(r);
    if (tab === "pending" && info.status !== "payment_pending") return false;
    if (tab === "locked" && info.status !== "locked") return false;
    if (tab === "final" && info.status !== "final_suspension") return false;
    if (q && !String(r.business_name || "").toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const counts = {
    all: rows.length,
    pending: rows.filter((r) => r.shop_payment_status === "payment_pending").length,
    locked: rows.filter((r) => r.shop_payment_status === "locked").length,
    final: rows.filter((r) => r.shop_payment_status === "final_suspension").length,
  };

  return (
    <div className="container max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/founder")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Contrôle de paiement des boutiques</h1>
          <p className="text-sm text-muted-foreground">Boutiques ayant atteint le seuil de 12 000 FCFA</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "pending", "locked", "final"] as const).map((k) => (
          <Button key={k} size="sm" variant={tab === k ? "default" : "outline"} onClick={() => setTab(k)}>
            {k === "all" ? "Toutes" : k === "pending" ? "En attente" : k === "locked" ? "Verrouillées" : "Fermées"} ({counts[k]})
          </Button>
        ))}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher une boutique…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Résultats ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Aucune boutique correspondante.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((shop) => {
                const info = computeShopPaymentInfo(shop);
                const meta = STATUS_META[info.status] || STATUS_META.active;
                const Icon = meta.icon;
                return (
                  <div key={shop.id} className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{shop.business_name}</p>
                        <Badge variant="outline" className={meta.className}>
                          <Icon className="h-3 w-3 mr-1" /> {meta.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">ID: {shop.id}</p>
                    </div>
                    <div className="text-sm">
                      <p><span className="text-muted-foreground">Dû :</span> <span className="font-bold text-red-600">{fmt(info.amountDue)} FCFA</span></p>
                      {info.deadline && (
                        <p className="text-xs text-muted-foreground">Échéance : {formatRemaining(info.remainingMs)}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/shop-editor/${shop.id}`)}>Voir</Button>
                      <Button size="sm" onClick={() => reset(shop.id)} disabled={busyId === shop.id}>
                        {busyId === shop.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Réactiver"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}