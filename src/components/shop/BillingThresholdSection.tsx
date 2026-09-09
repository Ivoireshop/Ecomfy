import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Receipt, 
  CreditCard, 
  Clock, 
  Lock, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  ShieldCheck, 
  FileText, 
  ArrowUpRight,
  TrendingUp
} from "lucide-react";
import { PayCommissionDialog } from "./PayCommissionDialog";

interface BillingThresholdSectionProps {
  shopId: string | null | undefined;
}

export const BillingThresholdSection: React.FC<BillingThresholdSectionProps> = ({ shopId }) => {
  const { billingInfo, invoices, loading, formattedCountdown } = useBillingSystem(shopId);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  if (!shopId) return null;

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Chargement du statut de facturation…</span>
        </div>
      </Card>
    );
  }

  const { isRestricted, isGracePeriod, ordersCount, threshold, amountDue, activeInvoice, invoiceNumber } = billingInfo || {
    isRestricted: false,
    isGracePeriod: false,
    ordersCount: 0,
    threshold: 240,
    amountDue: 0,
    activeInvoice: null,
    invoiceNumber: null,
  };

  const progressPercent = Math.min(100, Math.round((ordersCount / threshold) * 100));

  const executePayment = async () => {
    setSubmittingPayment(true);
    try {
      const ref = `PAY-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
      const res = await handleConfirmPayment(ref, selectedProvider);
      
      if (res.success) {
        toast.success("Paiement confirmé ! 🎉", {
          description: "Votre règlement de 12 000 FCFA a été confirmé. Votre boutique est maintenant entièrement réactivée.",
          duration: 6000,
        });
        setPaymentModalOpen(false);
      } else {
        toast.error("Échec du paiement", {
          description: res.message || "Impossible de confirmer le paiement. Veuillez réessayer.",
        });
      }
    } catch (e: any) {
      toast.error("Erreur de paiement", { description: e.message });
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. SEUIL DE FACTURATION & PROGRESSION */}
      <Card className="overflow-hidden border-2 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#C9A84C]" />
                <CardTitle className="text-xl font-bold text-white">Seuil de Facturation Ecomfy</CardTitle>
              </div>
              <CardDescription className="text-slate-300 text-xs">
                Seuil automatique fixé à {threshold} commandes cumulées pour 12 000 FCFA.
              </CardDescription>
            </div>

            <Badge 
              variant={isRestricted ? "destructive" : isGracePeriod ? "default" : "outline"}
              className="text-xs font-bold uppercase tracking-wider px-3 py-1"
            >
              {isRestricted ? "🔒 STORE RESTRICTED" : isGracePeriod ? "⚠️ DÉLAI 3 JOURS" : "STORE ACTIVE"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          
          {/* Progress Indicator */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-bold">
              <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-500" /> Commandes comptabilisées
              </span>
              <span className="font-mono text-base">
                {ordersCount} / {threshold} commandes ({progressPercent}%)
              </span>
            </div>
            
            <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${
                  ordersCount >= threshold 
                    ? "bg-gradient-to-r from-amber-500 to-red-500 animate-pulse" 
                    : "bg-gradient-to-r from-emerald-500 to-teal-500"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Active Billing Status Card */}
          {ordersCount >= threshold && (
            <div className={`rounded-2xl p-5 border-2 space-y-4 ${
              isRestricted 
                ? "bg-red-950/20 border-red-500/60" 
                : "bg-amber-950/20 border-amber-500/60"
            }`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {isRestricted ? (
                      <Lock className="w-5 h-5 text-red-500 animate-pulse" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    )}
                    <h4 className="font-black text-base text-foreground">
                      {isRestricted ? "Facture impayée — Accès restreint" : "Facture disponible — Seuil atteint"}
                    </h4>
                  </div>

                  <p className="text-xs text-muted-foreground leading-snug">
                    {isRestricted 
                      ? "Le délai de 3 jours est écoulé. Réglez 12 000 FCFA pour déverrouiller l'accès aux données clients et la gestion."
                      : "Vous disposez de 3 jours pour régler votre facture de 12 000 FCFA et conserver un accès ininterrompu."}
                  </p>

                  {isGracePeriod && (
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 pt-1">
                      <Clock className="w-4 h-4" />
                      <span>Temps restant : {formattedCountdown}</span>
                    </div>
                  )}
                </div>

                <div className="text-right w-full sm:w-auto">
                  <div className="text-2xl font-black text-primary font-mono">
                    12 000 FCFA
                  </div>
                  {invoiceNumber && (
                    <span className="text-[11px] text-muted-foreground font-mono block">
                      {invoiceNumber}
                    </span>
                  )}
                  <Button
                    onClick={() => setPaymentModalOpen(true)}
                    className="mt-2 w-full sm:w-auto font-black px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg"
                  >
                    <CreditCard className="w-4 h-4 mr-2" /> PAYER 12 000 FCFA
                  </Button>
                </div>
              </div>
            </div>
          )}

        </CardContent>
      </Card>

      {/* 2. HISTORIQUE DES FACTURES ECOMFY */}
      <Card className="border shadow-md">
        <CardHeader className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg font-bold">Historique de Facturation</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {invoices.length} facture(s) enregistrée(s)
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          {invoices.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm space-y-1">
              <Receipt className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
              <p>Aucune facture enregistrée pour le moment.</p>
              <p className="text-xs text-muted-foreground/70">
                La première facture apparaîtra automatiquement à l'atteinte des 240 commandes.
              </p>
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b text-muted-foreground font-bold uppercase tracking-wider">
                  <th className="p-3.5">N° Facture</th>
                  <th className="p-3.5">Seuil</th>
                  <th className="p-3.5">Montant</th>
                  <th className="p-3.5">Échéance</th>
                  <th className="p-3.5">Statut</th>
                  <th className="p-3.5">Paiement</th>
                  <th className="p-3.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((inv) => {
                  const isPaid = inv.status === "PAYMENT_CONFIRMED";
                  const isOverdue = inv.status === "STORE_RESTRICTED" || inv.status === "PAYMENT_OVERDUE";

                  return (
                    <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 font-bold font-mono text-foreground">{inv.invoice_number}</td>
                      <td className="p-3.5 font-medium">{inv.orders_threshold} commandes</td>
                      <td className="p-3.5 font-black text-sm font-mono">{inv.amount.toLocaleString()} FCFA</td>
                      <td className="p-3.5 text-muted-foreground">
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td className="p-3.5">
                        <Badge 
                          variant={isPaid ? "default" : isOverdue ? "destructive" : "secondary"}
                          className="text-[10px] font-extrabold uppercase"
                        >
                          {isPaid ? "PAYÉ" : isOverdue ? "IMPAYÉ / RESTREINT" : "PAYEMENT ATTENDU"}
                        </Badge>
                      </td>
                      <td className="p-3.5 font-mono text-[11px] text-muted-foreground">
                        {inv.paid_at ? (
                          <div>
                            <span className="text-emerald-600 font-bold block">✓ {new Date(inv.paid_at).toLocaleDateString("fr-FR")}</span>
                            <span className="text-[10px]">{inv.payment_reference || "Réf. certifiée"}</span>
                          </div>
                        ) : (
                          <span className="italic">Non réglé</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {!isPaid && (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-500"
                            onClick={() => setPaymentModalOpen(true)}
                          >
                            Payer 12 000 FCFA
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* 3. MODAL DE PAIEMENT MULTI-RÉSEAUX */}
      <PayCommissionDialog
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        shopId={shopId}
        balanceDue={amountDue > 0 ? amountDue : 12000}
        fullOnly={isRestricted}
      />

    </div>
  );
};
