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
}

const OPERATORS = [
  { id: "wave", label: "Wave" },
  { id: "orange", label: "Orange Money" },
  { id: "mtn", label: "MTN Mobile Money" },
  { id: "moov", label: "Moov Money" },
];

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.max(0, Math.round(n)));

export function PayCommissionDialog({ open, onOpenChange, shopId, balanceDue }: PayCommissionDialogProps) {
  const { toast } = useToast();
  const [provider, setProvider] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState<number>(Math.max(100, Math.round(balanceDue)));
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!provider) { toast({ title: "Choisissez un opérateur", variant: "destructive" }); return; }
    if (provider !== "wave" && !phone) { toast({ title: "Entrez votre numéro", variant: "destructive" }); return; }
    if (!amount || amount < 100) { toast({ title: "Montant invalide", description: "Minimum 100 FCFA", variant: "destructive" }); return; }
    if (amount > balanceDue) { toast({ title: "Montant trop élevé", description: `Solde dû : ${fmt(balanceDue)} FCFA`, variant: "destructive" }); return; }

    setLoading(true);
    const win = openPaymentWindow();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non connecté");
      const { data, error } = await supabase.functions.invoke("process-payment", {
        body: {
          amount,
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
            Solde à payer : <span className="font-bold text-red-600">{fmt(balanceDue)} FCFA</span>. Vous pouvez régler tout ou partie immédiatement.
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
            <Input
              type="number"
              min={100}
              max={Math.round(balanceDue)}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">Maximum : {fmt(balanceDue)} FCFA</p>
          </div>

          <Button onClick={submit} disabled={loading || !provider} className="w-full gap-2" size="lg">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            {loading ? "Redirection..." : `Payer ${fmt(amount)} FCFA`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}