import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Wallet, ShieldCheck, MessageCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { openPaymentWindow, redirectToPaymentUrl, closePaymentWindow } from "@/lib/paymentRedirect";

interface PayCommissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shopId: string;
  balanceDue: number;
  /** When true, only the full 100% payment is allowed (used when shop is locked). */
  fullOnly?: boolean;
}

const OPERATORS = [
  { id: "orange", label: "Orange Money", color: "bg-orange-500" },
  { id: "mtn", label: "MTN MoMo", color: "bg-yellow-500" },
  { id: "wave", label: "Wave", color: "bg-sky-500" },
  { id: "moov", label: "Moov Money", color: "bg-emerald-600" },
  { id: "card", label: "Carte Visa/MC", color: "bg-purple-600" },
];

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.max(0, Math.round(n)));

export function PayCommissionDialog({ open, onOpenChange, shopId, balanceDue, fullOnly = false }: PayCommissionDialogProps) {
  const { toast } = useToast();
  const effectiveBalance = Math.max(100, Number(balanceDue) || 12000);
  const [provider, setProvider] = useState("wave");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState<number>(effectiveBalance);
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount(effectiveBalance);
      setLastError(null);
    }
  }, [open, effectiveBalance]);

  const submit = async () => {
    const chargeAmount = fullOnly ? effectiveBalance : (amount || effectiveBalance);
    if (!chargeAmount || chargeAmount < 100) { toast({ title: "Montant invalide", description: "Minimum 100 FCFA", variant: "destructive" }); return; }

    setLoading(true);
    setLastError(null);
    const win = openPaymentWindow();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non connecté. Veuillez vous connecter.");
      const { data, error } = await supabase.functions.invoke("process-payment", {
        body: {
          amount: chargeAmount,
          payment_method: "mobile_money",
          user_id: session.user.id,
          provider,
          phone,
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
      throw new Error(data?.error || "Lien de paiement GeniusPay introuvable");
    } catch (err) {
      closePaymentWindow(win);
      const msg = err instanceof Error ? err.message : "Erreur lors de la redirection vers la page de paiement";
      setLastError(msg);
      toast({ title: "Erreur de paiement", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleManualPayment = async () => {
    const chargeAmount = fullOnly ? effectiveBalance : (amount || effectiveBalance);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non connecté. Veuillez vous connecter.");

      // Check if user is founder/co_founder
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .in("role", ["founder", "co_founder"]);

      const isFounder = !!roleData?.length;

      if (isFounder) {
        const confirmPay = window.confirm(`[ADMIN FONDATEUR]\nVoulez-vous valider manuellement ce règlement de ${fmt(chargeAmount)} FCFA et déverrouiller cette boutique immédiatement ?`);
        if (!confirmPay) return;

        setLoading(true);
        const { error } = await supabase.rpc("apply_commission_payment", {
          p_shop_id: shopId,
          p_amount: chargeAmount,
          p_transaction_reference: `MANUAL-DIRECT-${Date.now()}`,
          p_created_by: session.user.id,
          p_payment_method: "cash_direct",
          p_notes: "Validation manuelle directe par le fondateur",
        });

        if (error) throw error;
        toast({ title: "Paiement manuel validé !", description: "La boutique a été créditée et réactivée immédiatement." });
        onOpenChange(false);
        window.location.reload();
        return;
      }

      // For regular merchants: open WhatsApp support for direct payment confirmation
      const msg = encodeURIComponent(`Bonjour Support Ecomfy, je souhaite effectuer un règlement manuel / direct de ma commission de ${fmt(chargeAmount)} FCFA pour ma boutique (ID: ${shopId}).`);
      window.open(`https://wa.me/2250758152761?text=${msg}`, "_blank");
      toast({ title: "Contact Support WhatsApp", description: "Veuillez transmettre votre confirmation de dépôt direct à l'assistance Ecomfy." });
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Erreur lors du traitement manuel", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md top-[8%] translate-y-0 sm:top-[50%] sm:translate-y-[-50%] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-red-600" />Régler ma commission</DialogTitle>
          <DialogDescription>
            Solde à payer : <span className="font-bold text-red-600">{fmt(effectiveBalance)} FCFA</span>.
            {fullOnly
              ? " Votre boutique est verrouillée : seul le paiement complet est autorisé."
              : " Vous pouvez régler 25%, 50%, 75% ou 100% pendant les 3 premiers jours."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {lastError && (
            <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>Information réseau de paiement</span>
              </div>
              <p>{lastError}</p>
              <div className="pt-1 flex items-center gap-2">
                <a
                  href="https://wa.me/2250758152761?text=Bonjour%20Ecomfy,%20la%20passerelle%20en%20ligne%20est%20en%20maintenance.%20Je%20souhaite%20régler%20directement."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400 hover:underline text-xs"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Contacter le Support WhatsApp
                </a>
              </div>
            </div>
          )}

          <div>
            <Label className="text-sm font-semibold">Mode de paiement préféré</Label>
            <div className="grid grid-cols-2 gap-2 mt-2 sm:grid-cols-3">
              {OPERATORS.map((op) => (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => setProvider(op.id)}
                  className={`p-2.5 rounded-xl border-2 text-xs font-bold transition-all flex items-center justify-start gap-2 ${provider === op.id ? "border-primary bg-primary/10 shadow-sm" : "border-border hover:border-primary/40"}`}
                >
                  <div className={`h-2.5 w-2.5 rounded-full ${op.color} flex-shrink-0`} />
                  <span className="truncate">{op.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Numéro de téléphone</Label>
              <span className="text-[11px] text-muted-foreground">(Facultatif)</span>
            </div>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ex: 07 01 02 03 04 (ou saisir au paiement)" className="mt-1 text-sm" />
          </div>

          <div>
            <Label className="text-sm">Montant à payer (FCFA)</Label>
            {fullOnly ? (
              <div className="mt-2 rounded-xl border-2 border-red-600 bg-red-50 p-4 text-center">
                <p className="text-xs uppercase tracking-wide text-red-700 font-semibold">Paiement complet obligatoire</p>
                <p className="text-2xl font-bold text-red-700 mt-1">{fmt(effectiveBalance)} FCFA</p>
                <p className="text-xs text-red-700/80 mt-2">
                  Les paiements en tranche (25%, 50%, 75%) ne sont plus disponibles car votre boutique est verrouillée.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {[
                    { label: "25%", value: Math.max(100, Math.round(effectiveBalance * 0.25)) },
                    { label: "50%", value: Math.max(100, Math.round(effectiveBalance * 0.5)) },
                    { label: "75%", value: Math.max(100, Math.round(effectiveBalance * 0.75)) },
                    { label: "100%", value: Math.max(100, Math.round(effectiveBalance)) },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setAmount(preset.value)}
                      className={`py-2 rounded-lg border-2 text-xs font-semibold transition-all ${amount === preset.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <Input
                  type="number"
                  min={100}
                  max={Math.round(effectiveBalance)}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Payez en plusieurs fois si besoin. Minimum 100 FCFA · Maximum : {fmt(effectiveBalance)} FCFA
                </p>
              </>
            )}
          </div>

          <div className="space-y-2 pt-1">
            <Button onClick={submit} disabled={loading || !provider} className="w-full gap-2" size="lg">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              {loading ? "Redirection..." : `Payer ${fmt(fullOnly ? Math.round(effectiveBalance) : amount)} FCFA en ligne`}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleManualPayment}
              disabled={loading}
              className="w-full text-xs font-bold border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="h-4 w-4 text-amber-600" />
              <span>Paiement Manuel / Validation Directe Admin</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}