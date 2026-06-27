import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Zap, Loader2, CheckCircle2, Tag, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuthReady } from "@/hooks/useAuthReady";
import { openPaymentWindow, redirectToPaymentUrl } from "@/lib/paymentRedirect";

const PACKS = [
  { size: 20, price: 2000, label: "Starter" },
  { size: 30, price: 2500, label: "Pro", popular: true },
  { size: 40, price: 3000, label: "Studio" },
];

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export function AICreditsBadge() {
  const { user } = useAuthReady();
  const [credits, setCredits] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<number | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promoChecking, setPromoChecking] = useState(false);
  const [promo, setPromo] = useState<{ code: string; discount: number } | null>(null);

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
    const openHandler = () => setOpen(true);
    window.addEventListener("open-credits-dialog", openHandler);
    if (!user) return;
    const ch = supabase
      .channel(`profile-credits-${user.id}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload: any) => {
          if (payload?.new?.purchased_credits !== undefined && payload?.new?.purchased_credits !== null) {
            setCredits(payload.new.purchased_credits);
          }
        },
      )
      .subscribe();
    return () => {
      window.removeEventListener("open-credits-dialog", openHandler);
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
          promo_code: promo?.code,
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

  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoChecking(true);
    try {
      const { data, error } = await supabase.rpc("validate_promo_code", { promo_code: code });
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row?.is_valid) {
        toast.error(row?.message || "Code promo invalide");
        setPromo(null);
        return;
      }
      setPromo({ code, discount: row.discount_percentage });
      toast.success(`Code appliqué : -${row.discount_percentage}%`);
    } finally {
      setPromoChecking(false);
    }
  };

  const clearPromo = () => {
    setPromo(null);
    setPromoInput("");
  };

  const priceFor = (price: number) =>
    promo ? Math.round(price * (1 - promo.discount / 100)) : price;

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
              1,5 crédit par fiche produit · 2 crédits par message vocal. Solde
              actuel : <b>{credits} crédits</b>.
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
                      Pack {p.label} · {fmt(Math.round(priceFor(p.price) / p.size))} FCFA / crédit
                    </div>
                  </div>
                  <div className="text-right">
                    {promo ? (
                      <div className="flex flex-col items-end">
                        <span className="text-xs line-through text-muted-foreground">{fmt(p.price)} FCFA</span>
                        <span className="font-bold text-primary">{fmt(priceFor(p.price))} FCFA</span>
                      </div>
                    ) : (
                      <div className="font-bold">{fmt(p.price)} FCFA</div>
                    )}
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

          <div className="mt-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold">Code promo</span>
              {promo && (
                <span className="ml-auto text-[10px] uppercase tracking-wide bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                  -{promo.discount}%
                </span>
              )}
            </div>
            {promo ? (
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-mono font-semibold">{promo.code}</span>
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={clearPromo}>
                  <X className="h-3.5 w-3.5 mr-1" /> Retirer
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  placeholder="Entrez votre code"
                  className="h-9 text-sm uppercase"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void applyPromo();
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void applyPromo()}
                  disabled={promoChecking || !promoInput.trim()}
                  className="h-9"
                >
                  {promoChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Appliquer"}
                </Button>
              </div>
            )}
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