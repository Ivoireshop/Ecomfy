import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Receipt, Wallet, AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { InstallAppCard } from "./InstallAppCard";

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Receipt className="h-6 w-6" />
          Historique de facturation
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Suivez vos commissions VisualPro : {fmt(perOrder)} FCFA prélevés par commande reçue.
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
        <Card className={`p-4 ${balanceDue >= threshold ? "border-red-500/50 bg-red-50 dark:bg-red-950/20" : ""}`}>
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Wallet className="h-3 w-3" />Solde à payer</div>
          <div className={`text-2xl font-bold ${balanceDue >= threshold ? "text-red-600" : ""}`}>{fmt(balanceDue)} <span className="text-sm font-normal text-muted-foreground">FCFA</span></div>
          <div className="text-xs text-muted-foreground mt-1">Seuil : {fmt(threshold)} FCFA</div>
        </Card>
      </div>

      {balanceDue >= threshold && (
        <Card className="p-4 border-red-500/50 bg-red-50 dark:bg-red-950/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 dark:text-red-300">Facture à régler</h3>
              <p className="text-sm text-red-800/80 dark:text-red-300/80 mt-1">
                Votre solde a atteint le seuil de facturation. Contactez le support VisualPro pour régler votre facture, sinon votre boutique sera automatiquement suspendue.
              </p>
              <Button asChild size="sm" className="mt-3 gap-2" variant="destructive">
                <a href={`https://wa.me/${SUPPORT_PHONE.replace(/[^0-9]/g, "")}?text=Bonjour,%20je%20souhaite%20régler%20ma%20facture%20VisualPro%20pour%20la%20boutique%20${encodeURIComponent(shop?.business_name || "")}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Payer via WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Install app card */}
      <InstallAppCard />

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
                  <TableCell className="font-semibold">{fmt(p.amount)} FCFA</TableCell>
                  <TableCell className="text-sm">{p.payment_method || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{p.transaction_reference || "—"}</TableCell>
                  <TableCell className="text-right">
                    {p.status === "paid" ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">Payé</Badge>
                    ) : p.status === "pending" ? (
                      <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100">En attente</Badge>
                    ) : (
                      <Badge variant="outline">{p.status}</Badge>
                    )}
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