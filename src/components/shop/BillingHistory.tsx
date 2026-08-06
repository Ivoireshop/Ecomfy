import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Receipt, Wallet, AlertTriangle, CheckCircle2, Printer } from "lucide-react";
import { InstallAppCard } from "./InstallAppCard";
import { PayCommissionDialog } from "./PayCommissionDialog";

interface BillingHistoryProps {
  shopId: string;
  shop: any;
  orderCount: number;
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Number(n) || 0);
const SUPPORT_PHONE = "+225 07 58 15 27 61";

export function BillingHistory({ shopId, shop, orderCount }: BillingHistoryProps) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("commission_payments" as any)
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });
      setPayments((data as any[]) || []);
      setLoading(false);
    })();
  }, [shopId]);

  const perOrder = Number(shop?.commission_per_order) || 50;
  const threshold = Number(shop?.commission_threshold) || 12000;
  const balanceDue = Number(shop?.commission_balance_due) || 0;
  const totalPaid = payments.filter(p => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);
  const totalBilled = orderCount * perOrder;

  const openInvoice = (p: any) => {
    const date = new Date(p.created_at).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
    const isActivation = (p.notes || "").toLowerCase().includes("activation");
    const label = isActivation ? "Activation de la boutique" : "Paiement de commission Ecomfy";
    const invoiceNum = `FAC-${(p.id || "").slice(0, 8).toUpperCase()}`;
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"/>
<title>${invoiceNum} — ${shop?.business_name || "Boutique"}</title>
<style>
 body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#111;max-width:780px;margin:40px auto;padding:24px;}
 h1{font-size:24px;margin:0 0 4px}
 .muted{color:#666;font-size:13px}
 .box{border:1px solid #e5e7eb;border-radius:10px;padding:18px;margin-top:18px}
 table{width:100%;border-collapse:collapse;margin-top:16px}
 th,td{padding:10px;border-bottom:1px solid #eee;text-align:left;font-size:14px}
 th{background:#f9fafb}
 .total{font-size:20px;font-weight:700;text-align:right;margin-top:14px}
 .pill{display:inline-block;background:#dcfce7;color:#166534;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600}
 .row{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;flex-wrap:wrap}
 .btn{position:fixed;top:16px;right:16px;background:#111;color:#fff;padding:10px 16px;border:0;border-radius:8px;cursor:pointer}
 @media print{.btn{display:none}}
</style></head><body>
<button class="btn" onclick="window.print()">Imprimer / Télécharger PDF</button>
<div class="row">
  <div>
    <h1>Facture</h1>
    <div class="muted">N° ${invoiceNum}</div>
    <div class="muted">Date : ${date}</div>
  </div>
  <div style="text-align:right">
    <div style="font-weight:700">Ecomfy</div>
    <div class="muted">ecomfy.cloud</div>
    <div class="muted">+225 07 58 15 27 61</div>
  </div>
</div>
<div class="box">
  <div class="muted" style="font-size:12px;text-transform:uppercase;letter-spacing:.04em">Facturé à</div>
  <div style="font-weight:600;margin-top:4px">${shop?.business_name || "Boutique"}</div>
  ${shop?.slug ? `<div class="muted">${shop.slug}.ecomfy.cloud</div>` : ""}
</div>
<table>
  <thead><tr><th>Description</th><th style="text-align:right">Montant</th></tr></thead>
  <tbody>
    <tr><td>${label}</td><td style="text-align:right">${fmt(p.amount)} FCFA</td></tr>
  </tbody>
</table>
<div class="total">Total payé : ${fmt(p.amount)} FCFA</div>
<div style="margin-top:8px;text-align:right"><span class="pill">Payé</span></div>
<div class="muted" style="margin-top:24px">
  Méthode : ${p.payment_method || "—"}<br/>
  Référence : ${p.transaction_reference || "—"}
</div>
<div class="muted" style="margin-top:32px;font-size:12px;text-align:center">
  Merci pour votre confiance — Ecomfy · ecomfy.cloud
</div>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Receipt className="h-6 w-6" />
          Historique de facturation
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Suivez vos commissions Ecomfy : {fmt(perOrder)} FCFA prélevés par commande reçue.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Total facturé</div>
          <div className="text-2xl font-bold">{fmt(totalBilled)} <span className="text-sm font-normal text-muted-foreground">FCFA</span></div>
          <div className="text-xs text-muted-foreground mt-1">{orderCount} commande{orderCount > 1 ? "s" : ""}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-600" />Total payé</div>
          <div className="text-2xl font-bold text-green-600">{fmt(totalPaid)} <span className="text-sm font-normal text-muted-foreground">FCFA</span></div>
          <div className="text-xs text-muted-foreground mt-1">{payments.filter(p => p.status === "paid").length} règlement{payments.length > 1 ? "s" : ""}</div>
        </Card>
        <Card className={`p-4 ${balanceDue > 0 ? "border-red-500/60 bg-red-50 dark:bg-red-950/20" : ""}`}>
          <div className={`text-xs mb-1 flex items-center gap-1 ${balanceDue > 0 ? "text-red-700 dark:text-red-400 font-semibold" : "text-muted-foreground"}`}>
            <Wallet className="h-3 w-3" />Solde à payer
          </div>
          <div className={`text-2xl font-bold ${balanceDue > 0 ? "text-red-600" : ""}`}>{fmt(balanceDue)} <span className="text-sm font-normal text-muted-foreground">FCFA</span></div>
          <div className="text-xs text-muted-foreground mt-1">Seuil de blocage : {fmt(threshold)} FCFA</div>
          {balanceDue > 0 && (
            <Button size="sm" className="mt-3 w-full gap-2" variant="destructive" onClick={() => setPayOpen(true)}>
              <Wallet className="h-4 w-4" /> Payer maintenant
            </Button>
          )}
        </Card>
      </div>

      {balanceDue >= threshold && (
        <Card className="p-4 border-red-500/60 bg-red-50 dark:bg-red-950/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 dark:text-red-300">Facture à régler</h3>
              <p className="text-sm text-red-800/80 dark:text-red-300/80 mt-1">
                Votre solde a atteint le seuil de facturation. Réglez via Wave, Orange Money, MTN ou Moov pour éviter la suspension automatique de votre boutique.
              </p>
              <Button size="sm" className="mt-3 gap-2" variant="destructive" onClick={() => setPayOpen(true)}>
                <Wallet className="h-4 w-4" />
                Payer maintenant
              </Button>
            </div>
          </div>
        </Card>
      )}

      <PayCommissionDialog open={payOpen} onOpenChange={setPayOpen} shopId={shopId} balanceDue={balanceDue} />

      {/* Install app card */}
      <InstallAppCard shopId={shopId} />

      {/* Payments table */}
      <Card className="p-5">
        <h3 className="font-semibold mb-4">Mes paiements</h3>
        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : payments.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Aucun paiement enregistré pour le moment.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Méthode</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead className="text-right">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">{new Date(p.created_at).toLocaleDateString("fr-FR")}</TableCell>
                  <TableCell className="font-semibold">
                    {fmt(p.amount)} FCFA
                    {(p.notes || "").toLowerCase().includes("activation") && (
                      <div className="text-[10px] font-normal text-muted-foreground">Activation boutique</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{p.payment_method || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{p.transaction_reference || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {p.status === "paid" ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">Payé</Badge>
                      ) : p.status === "pending" ? (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100">En attente</Badge>
                      ) : (
                        <Badge variant="outline">{p.status}</Badge>
                      )}
                      {p.status === "paid" && (
                        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => openInvoice(p)}>
                          <Printer className="h-3.5 w-3.5" /> Facture
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}