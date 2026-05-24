import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, Sparkle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  shopId: string;
  shop: any;
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));

export function SubscriptionCard({ shopId, shop }: Props) {
  const [loading, setLoading] = useState(false);
  const plan = (shop?.subscription_plan as string) || "free";
  const activeUntilRaw = shop?.subscription_active_until;
  const activeUntil = activeUntilRaw ? new Date(activeUntilRaw) : null;
  const isActive = !!activeUntil && activeUntil.getTime() > Date.now();

  const subscribe = async () => {
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getUser();
      const userId = sess?.user?.id;
      if (!userId) {
        toast({ title: "Connectez-vous d'abord", variant: "destructive" });
        return;
      }
      const { data, error } = await supabase.functions.invoke("process-payment", {
        body: {
          amount: 12000,
          user_id: userId,
          payment_type: "shop_subscription",
          plan: "starter",
          shop_id: shopId,
        },
      });
      if (error || !data?.success) {
        toast({
          title: "Paiement non démarré",
          description: data?.error || error?.message || "Réessayez dans un instant.",
          variant: "destructive",
        });
        return;
      }
      const url = data.checkout_url || data.payment_url;
      if (url) window.location.href = url;
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-5 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Abonnement boutique
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Évitez la commission de 50 FCFA par commande grâce à un forfait mensuel fixe.
          </p>
        </div>
        <Badge variant={isActive ? "default" : "secondary"} className="capitalize">
          {isActive ? `${plan} actif` : "Plan Free"}
        </Badge>
      </div>

      {isActive && activeUntil && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          ✓ Abonnement <b className="capitalize">{plan}</b> actif jusqu'au{" "}
          <b>{activeUntil.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</b>.
          Aucune commission n'est appliquée sur vos commandes pendant cette période.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {/* Starter */}
        <div className="rounded-lg border-2 border-primary/40 p-4 flex flex-col">
          <div className="text-xs uppercase tracking-wide text-primary font-semibold">Starter</div>
          <div className="mt-1 text-2xl font-bold">{fmt(12000)} <span className="text-sm font-normal text-muted-foreground">FCFA/mois</span></div>
          <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground flex-1">
            <li>✓ Aucune commission par commande</li>
            <li>✓ Commandes illimitées</li>
            <li>✓ Toutes les fonctionnalités actuelles</li>
            <li>✓ Renouvellement manuel chaque mois</li>
          </ul>
          <Button className="mt-4" onClick={subscribe} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkle className="h-4 w-4 mr-1" />}
            {isActive ? "Prolonger 1 mois" : "Activer Starter"}
          </Button>
        </div>

        {/* Business */}
        <div className="rounded-lg border p-4 flex flex-col opacity-60">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Business</div>
          <div className="mt-1 text-2xl font-bold">{fmt(24000)} <span className="text-sm font-normal text-muted-foreground">FCFA/mois</span></div>
          <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground flex-1">
            <li>• Tout Starter</li>
            <li>• Outils marketing avancés</li>
            <li>• Support prioritaire</li>
          </ul>
          <Button className="mt-4" variant="outline" disabled>Bientôt disponible</Button>
        </div>

        {/* Premium */}
        <div className="rounded-lg border p-4 flex flex-col opacity-60">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Premium</div>
          <div className="mt-1 text-2xl font-bold">{fmt(60000)} <span className="text-sm font-normal text-muted-foreground">FCFA/mois</span></div>
          <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground flex-1">
            <li>• Tout Business</li>
            <li>• Accompagnement personnalisé</li>
            <li>• Volume entreprise</li>
          </ul>
          <Button className="mt-4" variant="outline" disabled>Bientôt disponible</Button>
        </div>
      </div>

      {!isActive && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Sans abonnement, votre boutique reste en plan Free : 50 FCFA par commande, à régler dès que la commission atteint 12 000 FCFA.
        </p>
      )}
    </Card>
  );
}