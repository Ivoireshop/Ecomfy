import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { recordManualCommissionPayment } from "@/lib/founderBilling";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, RefreshCw, ShieldCheck, Lock, AlertOctagon, Clock, Search, CalendarClock, type LucideIcon } from "lucide-react";
import { formatRemaining, computeShopPaymentInfo } from "@/lib/shopPaymentStatus";
import { useBillingSettings } from "@/hooks/useSubscriptionPlans";
import { ListPagination } from "@/components/ListPagination";
import { usePagedList } from "@/hooks/usePagedList";
import { readPage, searchFilter } from "@/lib/pagination";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.max(0, Math.round(n)));

const STATUS_META: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  active: { label: "Active", icon: ShieldCheck, className: "bg-green-100 text-green-800 border-green-300" },
  payment_pending: { label: "Paiement en attente", icon: Clock, className: "bg-amber-100 text-amber-800 border-amber-300" },
  locked: { label: "Verrouillée", icon: Lock, className: "bg-red-100 text-red-800 border-red-300" },
  final_suspension: { label: "Fermeture définitive", icon: AlertOctagon, className: "bg-red-600 text-white border-red-700" },
};

const TAB_STATUS = { pending: "payment_pending", locked: "locked", final: "final_suspension" } as const;
type Tab = "all" | keyof typeof TAB_STATUS;

const COLUMNS = "id, business_name, user_id, commission_balance_due, commission_threshold, shop_payment_status, threshold_reached_at, first_deadline_at, locked_at, second_deadline_at, final_suspension_at, is_suspended, updated_at, extra_deadline_active, extra_deadline_started_at, extra_deadline_ends_at";

interface ControlledShop {
  id: string;
  business_name: string;
  commission_balance_due: number | null;
  [column: string]: unknown;
}

export default function ShopPaymentControl() {
  const navigate = useNavigate();
  const { settings: billingSettings } = useBillingSettings();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  const list = usePagedList<ControlledShop>({
    search: q,
    filterKey: tab,
    fetchPage: ({ page, pageSize, search }) =>
      readPage<ControlledShop>(page, pageSize, (from, to) => {
        let query = supabase
          .from("shops")
          .select(COLUMNS, { count: "exact" })
          .gt("commission_balance_due", 0)
          .order("updated_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to);
        if (tab !== "all") query = query.eq("shop_payment_status", TAB_STATUS[tab]);
        const filter = searchFilter(["business_name"], search);
        return filter ? query.or(filter) : query;
      }),
  });

  // Nombre de boutiques par onglet (indépendant de la recherche).
  const [counts, setCounts] = useState<Record<Tab, number | null>>({ all: null, pending: null, locked: null, final: null });
  const loadCounts = useCallback(async () => {
    const count = async (status?: string) => {
      let query = supabase.from("shops").select("id", { count: "exact", head: true }).gt("commission_balance_due", 0);
      if (status) query = query.eq("shop_payment_status", status);
      const result = await query;
      return result.error ? null : result.count;
    };
    const [all, pending, locked, final] = await Promise.all([
      count(), count(TAB_STATUS.pending), count(TAB_STATUS.locked), count(TAB_STATUS.final),
    ]);
    setCounts({ all, pending, locked, final });
  }, []);
  useEffect(() => { void loadCounts(); }, [loadCounts]);

  const load = () => {
    list.reload();
    void loadCounts();
  };

  const reset = async (shopId: string) => {
    setBusyId(shopId);
    const { error } = await supabase.rpc("founder_reset_shop_payment", { _shop_id: shopId, _reason: "Admin reset" });
    setBusyId(null);
    if (error) return toast({ title: "Erreur", description: error.message, variant: "destructive" });
    toast({ title: "Boutique réactivée" });
    load();
  };

  const grantExtra = async (shopId: string) => {
    const raw = window.prompt("Nombre de jours de délai supplémentaire ?", "2");
    if (!raw) return;
    const days = Math.max(1, Math.min(30, parseInt(raw, 10) || 2));
    setBusyId(shopId);
    // @ts-ignore RPC created via migration
    const { data, error } = await supabase.rpc("founder_grant_extra_deadline", { _shop_id: shopId, _days: days });
    setBusyId(null);
    if (error) return toast({ title: "Erreur", description: error.message, variant: "destructive" });
    if ((data as { success?: boolean } | null)?.success === false) {
      return toast({ title: "Refusé", description: (data as { error?: string } | null)?.error || "Action refusée", variant: "destructive" });
    }
    toast({ title: `Délai supplémentaire de ${days} jour(s) accordé` });
    load();
  };

  const manualPayment = async (shop: ControlledShop) => {
    const defaultAmount = Math.round(Number(shop.commission_balance_due) || 12000);
    const raw = window.prompt(`Saisir le montant encaissé manuellement pour "${shop.business_name}" (FCFA) :`, String(defaultAmount));
    if (!raw) return;
    const amount = Math.max(1, parseInt(raw, 10) || defaultAmount);
    setBusyId(shop.id);
    try {
      await recordManualCommissionPayment({
        shopId: shop.id,
        amount,
        transactionReference: `MANUAL-${Date.now()}`,
        paymentMethod: "cash_direct",
        notes: "Règlement manuel admin enregistré par le fondateur (Secours GeniusPay)",
      });
    } catch (e) {
      setBusyId(null);
      return toast({ title: "Erreur", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    }
    setBusyId(null);
    toast({ title: `Paiement manuel de ${fmt(amount)} FCFA enregistré !` });
    load();
  };

  return (
    <div className="container max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/founder")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Contrôle de paiement des boutiques</h1>
          <p className="text-sm text-muted-foreground">Boutiques ayant atteint le seuil de {fmt(billingSettings.commission_threshold)} FCFA</p>
        </div>
        <Button variant="outline" onClick={load} disabled={list.loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${list.loading ? "animate-spin" : ""}`} /> Actualiser
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "pending", "locked", "final"] as const).map((k) => (
          <Button key={k} size="sm" variant={tab === k ? "default" : "outline"} onClick={() => setTab(k)}>
            {k === "all" ? "Toutes" : k === "pending" ? "En attente" : k === "locked" ? "Verrouillées" : "Fermées"} ({counts[k] ?? "…"})
          </Button>
        ))}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher une boutique…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Résultats{list.loading || list.error ? "" : ` (${list.total})`}</CardTitle></CardHeader>
        <CardContent>
          {list.loading ? (
            <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : list.error ? (
            <div role="alert" className="py-8 text-center text-sm text-destructive space-y-3">
              <p>Erreur de chargement : {list.error.message}</p>
              <Button size="sm" variant="outline" onClick={load}>Réessayer</Button>
            </div>
          ) : list.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Aucune boutique correspondante.</p>
          ) : (
            <div className="space-y-3">
              {list.rows.map((shop) => {
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
                        {info.extraDeadlineActive && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">
                            <CalendarClock className="h-3 w-3 mr-1" /> Délai suppl. actif
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">ID: {shop.id}</p>
                    </div>
                    <div className="text-sm">
                      <p><span className="text-muted-foreground">Dû :</span> <span className="font-bold text-red-600">{fmt(info.amountDue)} FCFA</span></p>
                      {info.deadline && (
                        <p className="text-xs text-muted-foreground">Échéance : {formatRemaining(info.remainingMs)}</p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/shop-editor/${shop.id}`)}>Voir</Button>
                      <Button size="sm" variant="outline" onClick={() => grantExtra(shop.id)} disabled={busyId === shop.id}>
                        <CalendarClock className="h-4 w-4 mr-1" /> Délai +
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => manualPayment(shop)} disabled={busyId === shop.id}>
                        Paiement Manuel
                      </Button>
                      <Button size="sm" onClick={() => reset(shop.id)} disabled={busyId === shop.id}>
                        {busyId === shop.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Réactiver"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <ListPagination page={list.page} pageSize={list.pageSize} total={list.total} onPageChange={list.setPage} disabled={list.loading} />
        </CardContent>
      </Card>
    </div>
  );
}