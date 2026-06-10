import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Zap, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuthReady } from "@/hooks/useAuthReady";
import { openPaymentWindow, redirectToPaymentUrl } from "@/lib/paymentRedirect";

const PACKS = [
  { size: 10, price: 2000, label: "Starter" },
  { size: 15, price: 2500, label: "Pro", popular: true },
  { size: 20, price: 3000, label: "Studio" },
];

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export function AICreditsBadge() {
  const { user } = useAuthReady();
  const [credits, setCredits] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<number | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("purchased_credits")
      .eq("id", user.id)
      .maybeSingle();
    setCredits(data?.purchased_credits || 0);
  };

  useEffect(() => {
    void load();
    if (!user) return;
    const ch = supabase
      .channel(`profile-credits-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload: any) => {
          if (typeof payload?.new?.purchased_credits === "number") {
            setCredits(payload.new.purchased_credits);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const buy = async (pack: { size: number; price: number }) => {
    if (!user) {
      toast.error("Connectez-vous d'abord");
      return;
    }
    setLoading(pack.size);
    const win = openPaymentWindow();
    try {
      const { data, error } = await supabase.functions.invoke("process-payment", {
        body: {
          amount: pack.price,
          user_id: user.id,
          payment_type: "credits",
          credits_pack: { size: pack.size, price: pack.price },
        },
      });
      if (error || !data?.success) {
        toast.error(data?.error || error?.message || "Paiement non démarré");
        return;
      }
      const url = data.checkout_url || data.payment_url;
      if (url) redirectToPaymentUrl(url, win);
    } finally {
      setLoading(null);
    }
  };

  if (!user) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-9 gap-1.5 rounded-full border-primary/30 bg-primary/5 hover:bg-primary/10 px-3"
        title="Crédits IA - cliquez pour recharger"
      >
        <Zap className="h-4 w-4 text-primary" />
        <span className="font-semibold tabular-nums">{credits}</span>
        <span className="hidden sm:inline text-xs text-muted-foreground">crédits</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" /> Recharger vos crédits IA
            </DialogTitle>
            <DialogDescription>
              1 crédit = 1 génération (fiche produit ou image IA). Solde actuel :{" "}
              <b>{credits} crédits</b>.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 mt-2">
            {PACKS.map((p) => (
              <button
                key={p.size}
                onClick={() => buy(p)}
                disabled={loading !== null}
                className={`text-left rounded-xl border-2 p-4 transition-all hover:border-primary/60 hover:bg-primary/5 disabled:opacity-50 ${
                  p.popular ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">{p.size} crédits</span>
                      {p.popular && (
                        <span className="text-[10px] uppercase tracking-wide bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                          Populaire
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Pack {p.label} · {fmt(Math.round(p.price / p.size))} FCFA / crédit
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{fmt(p.price)} FCFA</div>
                    {loading === p.size ? (
                      <Loader2 className="h-4 w-4 animate-spin mt-1 ml-auto text-primary" />
                    ) : (
                      <span className="text-[11px] text-primary font-medium">Acheter →</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-3 text-[11px] text-muted-foreground flex items-start gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-px shrink-0" />
            <span>Paiement sécurisé Mobile Money via GeniusPay. Crédits ajoutés instantanément après confirmation.</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}