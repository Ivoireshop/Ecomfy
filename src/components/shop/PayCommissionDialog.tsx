import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Wallet } from "lucide-react";
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
  { id: "wave", label: "Wave" },
  { id: "orange", label: "Orange Money" },
  { id: "mtn", label: "MTN Mobile Money" },
  { id: "moov", label: "Moov Money" },
];

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.max(0, Math.round(n)));

export function PayCommissionDialog({ open, onOpenChange, shopId, balanceDue, fullOnly = false }: PayCommissionDialogProps) {
  const { toast } = useToast();
  const [provider, setProvider] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState<number>(Math.max(100, Math.round(balanceDue)));
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!provider) { toast({ title: "Choisissez un opérateur", variant: "destructive" }); return; }
    if (provider !== "wave" && !phone) { toast({ title: "Entrez votre numéro", variant: "destructive" }); return; }
    const chargeAmount = fullOnly ? Math.round(balanceDue) : amount;
    if (!chargeAmount || chargeAmount < 100) { toast({ title: "Montant invalide", description: "Minimum 100 FCFA", variant: "destructive" }); return; }
    if (chargeAmount > balanceDue) { toast({ title: "Montant trop élevé", description: `Solde dû : ${fmt(balanceDue)} FCFA`, variant: "destructive" }); return; }

    setLoading(true);
    const win = openPaymentWindow();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non connecté");
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
      if (url) { redirectToPaymentUrl(url, win); return; }
      throw new Error("Lien de paiement introuvable");
    } catch (err) {
      closePaymentWindow(win);
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Erreur de paiement", variant: "destructive" });
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
            Solde à payer : <span className="font-bold text-red-600">{fmt(balanceDue)} FCFA</span>.
            {fullOnly
              ? " Votre boutique est verrouillée : seul le paiement complet est autorisé."
              : " Vous pouvez régler 25%, 50%, 75% ou 100% pendant les 3 premiers jours."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm">Opérateur Mobile Money</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {OPERATORS.map((op) => (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => setProvider(op.id)}
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${provider === op.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                >
                  {op.label}
                </button>
              ))}
            </div>
          </div>

          {provider && provider !== "wave" && (
            <div>
              <Label className="text-sm">Numéro de téléphone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07 XX XX XX XX" className="mt-1" />
            </div>
          )}

          <div>
            <Label className="text-sm">Montant à payer (FCFA)</Label>
            {fullOnly ? (
              <div className="mt-2 rounded-xl border-2 border-red-600 bg-red-50 p-4 text-center">
                <p className="text-xs uppercase tracking-wide text-red-700 font-semibold">Paiement complet obligatoire</p>
                <p className="text-2xl font-bold text-red-700 mt-1">{fmt(balanceDue)} FCFA</p>
                <p className="text-xs text-red-700/80 mt-2">
                  Les paiements en tranche (25%, 50%, 75%) ne sont plus disponibles car votre boutique est verrouillée.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {[
                    { label: "25%", value: Math.max(100, Math.round(balanceDue * 0.25)) },
                    { label: "50%", value: Math.max(100, Math.round(balanceDue * 0.5)) },
                    { label: "75%", value: Math.max(100, Math.round(balanceDue * 0.75)) },
                    { label: "100%", value: Math.max(100, Math.round(balanceDue)) },
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
                  max={Math.round(balanceDue)}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Payez en plusieurs fois si besoin. Minimum 100 FCFA · Maximum : {fmt(balanceDue)} FCFA
                </p>
              </>
            )}
          </div>

          <Button onClick={submit} disabled={loading || !provider} className="w-full gap-2" size="lg">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            {loading ? "Redirection..." : `Payer ${fmt(fullOnly ? Math.round(balanceDue) : amount)} FCFA`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}