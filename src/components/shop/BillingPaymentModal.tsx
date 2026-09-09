import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, Loader2, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useBillingSystem } from "@/hooks/useBillingSystem";
import { supabase } from "@/integrations/supabase/client";
import { openPaymentWindow, redirectToPaymentUrl, closePaymentWindow } from "@/lib/paymentRedirect";
import { toast } from "sonner";

interface BillingPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shopId: string | null | undefined;
}

export const BillingPaymentModal: React.FC<BillingPaymentModalProps> = ({ open, onOpenChange, shopId }) => {
  const { billingInfo, processingPayment, refreshBilling } = useBillingSystem(shopId);

  const [selectedProvider, setSelectedProvider] = useState<string>("wave");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  if (!shopId) return null;

  const invoiceNumber = billingInfo?.invoiceNumber || "BILL-ECOMFY-000001";
  const amountDue = Math.max(12000, billingInfo?.amountDue || 12000);

  const executePayment = async () => {
    setSubmittingPayment(true);
    const win = openPaymentWindow();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non connecté. Veuillez vous connecter.");

      const { data, error } = await supabase.functions.invoke("process-payment", {
        body: {
          amount: amountDue,
          payment_method: "mobile_money",
          user_id: session.user.id,
          provider: selectedProvider,
          phone: phoneNumber,
          payment_type: "commission_payment",
          shop_id: shopId,
        },
      });

      if (error) throw error;
      const url = data?.payment_url || data?.checkout_url;
      if (data?.success === false) throw new Error(data?.error || "Erreur de paiement");
      if (url) {
        redirectToPaymentUrl(url, win);
        onOpenChange(false);
        return;
      }
      throw new Error("Lien de paiement introuvable");
    } catch (e: any) {
      closePaymentWindow(win);
      toast.error("Erreur de paiement", { description: e?.message || "Une erreur est survenue lors de la redirection vers le paiement." });
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-900 border-2 border-emerald-500/50 text-white shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-white">
            <CreditCard className="w-5 h-5 text-emerald-400" /> Règlement Facture 12 000 FCFA
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-300">
            Réglez votre facture de seuil Ecomfy (240 commandes) pour déverrouiller et réactiver automatiquement l'accès complet à votre boutique.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Amount Summary */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 text-white flex items-center justify-between shadow-inner">
            <div>
              <span className="text-xs text-slate-400 block font-bold uppercase tracking-wider">Obligation de paiement</span>
              <span className="text-xs text-slate-300 font-mono">{invoiceNumber}</span>
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {amountDue.toLocaleString("fr-FR")} FCFA
            </div>
          </div>

          {/* Provider Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Mode de paiement préféré</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                { id: "orange", label: "Orange Money", color: "bg-orange-500" },
                { id: "mtn", label: "MTN MoMo", color: "bg-yellow-500" },
                { id: "wave", label: "Wave", color: "bg-sky-500" },
                { id: "moov", label: "Moov Money", color: "bg-emerald-600" },
                { id: "card", label: "Carte Visa/MC", color: "bg-purple-600" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProvider(p.id)}
                  className={`p-2.5 rounded-xl border-2 text-xs font-bold transition-all flex items-center justify-start gap-2 ${
                    selectedProvider === p.id 
                      ? "border-emerald-500 bg-emerald-500/20 text-white shadow-md ring-1 ring-emerald-500/40" 
                      : "border-slate-800 bg-slate-950/50 hover:border-emerald-500/40 text-slate-300"
                  }`}
                >
                  <div className={`h-2.5 w-2.5 rounded-full ${p.color} shrink-0`} />
                  <span className="truncate">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Phone number input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-medium text-slate-300">Numéro de téléphone mobile</Label>
              <span className="text-[11px] text-slate-400">(Facultatif)</span>
            </div>
            <Input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Ex: 07 01 02 03 04"
              className="text-sm font-mono bg-slate-950 border-slate-800 text-white placeholder:text-slate-600"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto text-xs border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            Annuler
          </Button>

          <Button
            onClick={executePayment}
            disabled={submittingPayment || processingPayment}
            className="w-full sm:w-auto font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm py-5 shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2"
          >
            {submittingPayment || processingPayment ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Confirmation en cours…</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>CONFIRMER LE PAIEMENT (12 000 FCFA)</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
