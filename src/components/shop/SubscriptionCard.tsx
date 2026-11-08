import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, Sparkle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useBillingSettings, useMyShopCoverage, useSubscriptionPlans } from "@/hooks/useSubscriptionPlans";
import { formatFcfa, planChargeAmount, publicPlans, shopsIncludedLabel, type SubscriptionPlan } from "@/lib/subscriptionPlans";

interface Props {
  shopId: string;
  shop: any;
}

export function SubscriptionCard({ shopId, shop }: Props) {
  const [loadingCode, setLoadingCode] = useState<string | null>(null);
  const { plans: allPlans } = useSubscriptionPlans();
  const { settings } = useBillingSettings();
  const { coverage } = useMyShopCoverage();
  const plans = publicPlans(allPlans);
  const plan = (shop?.subscription_plan as string) || "free";
  const planName = allPlans.find((p) => p.code === plan)?.name ?? plan;
  const activeUntilRaw = shop?.subscription_active_until;
  const activeUntil = activeUntilRaw ? new Date(activeUntilRaw) : null;
  const isActive = !!activeUntil && activeUntil.getTime() > Date.now();
  // Abonnement du compte actif mais cette boutique n'est pas parmi celles incluses
  const thisShop = coverage?.shops?.find((s) => s.id === shopId);
  const outsidePlan = !isActive && !!coverage?.subscription_active && thisShop?.within_plan === false;
  const commission = `${formatFcfa(settings.commission_per_order)} FCFA`;

  const subscribe = async (target: SubscriptionPlan) => {
    setLoadingCode(target.code);
    try {
      const { data: sess } = await supabase.auth.getUser();
      const userId = sess?.user?.id;
      if (!userId) {
        toast({ title: "Connectez-vous d'abord", variant: "destructive" });
        return;
      }
      const amount = planChargeAmount(target, false);
      const { data, error } = await supabase.functions.invoke("process-payment", {
        body: {
          amount,
          user_id: userId,
          payment_type: "shop_subscription",
          plan: target.code,
          shop_id: shopId,
          billing_cycle: "monthly",
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
      setLoadingCode(null);
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
            Évitez la commission de {commission} par commande grâce à un forfait mensuel fixe.
          </p>
        </div>
        <Badge variant={isActive ? "default" : "secondary"} className={isActive ? "bg-emerald-600 font-bold tracking-wide" : "capitalize"}>
          {isActive ? `✓ PLAN ACTUEL (${planName})` : "Plan Free"}
        </Badge>
      </div>

      {isActive && activeUntil && (
        <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-sm text-emerald-800 dark:text-emerald-300 font-medium shadow-sm">
          <div className="font-bold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 mb-1">
            <ShieldCheck className="h-4 w-4" />
            [ ✓ PLAN ACTUEL ] — Pass Zéro Commission Activé
          </div>
          Votre abonnement <b>{planName}</b> est actif jusqu'au{" "}
          <b>{activeUntil.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</b>.
          Aucune commission de {commission} n'est prélevée sur les commandes de cette boutique.
        </div>
      )}

      {outsidePlan && (
        <div className="mb-4 rounded-xl border border-amber-400/60 bg-amber-50 p-3.5 text-sm text-amber-900">
          Le plan <b>{coverage?.plan_name}</b> de votre compte inclut {coverage?.max_shops} boutique{(coverage?.max_shops ?? 0) > 1 ? "s" : ""}.
          Cette boutique n'en fait pas partie : elle paie la commission de {commission} par commande.
        </div>
      )}

      <div className={`grid gap-3 ${plans.length >= 3 ? "sm:grid-cols-3" : plans.length === 2 ? "sm:grid-cols-2" : ""}`}>
        {plans.map((p, index) => {
          const included = shopsIncludedLabel(p.max_shops);
          const current = isActive && plan === p.code;
          return (
            <div key={p.code} className={`rounded-lg border p-4 flex flex-col ${index === 0 ? "border-2 border-primary/40" : ""}`}>
              <div className={`text-xs uppercase tracking-wide font-semibold ${index === 0 ? "text-primary" : "text-muted-foreground"}`}>{p.name}</div>
              <div className="mt-1 text-2xl font-bold">
                {formatFcfa(p.price_monthly)} <span className="text-sm font-normal text-muted-foreground">FCFA/mois</span>
              </div>
              <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground flex-1">
                <li>✓ Aucune commission par commande</li>
                {included && <li>✓ {included}</li>}
                {p.features.slice(0, 4).map((f) => <li key={f}>✓ {f}</li>)}
                <li>✓ Renouvellement manuel chaque mois</li>
              </ul>
              <Button className="mt-4 font-bold" onClick={() => subscribe(p)} disabled={loadingCode !== null}>
                {loadingCode === p.code ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkle className="h-4 w-4 mr-1" />}
                {current ? `Prolonger 1 mois (${formatFcfa(p.price_monthly)} FCFA)` : `Activer ${p.name} (${formatFcfa(p.price_monthly)} FCFA)`}
              </Button>
              <div className="mt-2 text-[10px] text-center text-muted-foreground">
                🟠 Orange Money · 🟡 MTN MoMo · 🔵 Wave · 🟢 Moov · 💳 Carte
              </div>
            </div>
          );
        })}
      </div>

      {!isActive && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Sans abonnement, votre boutique reste en plan Free : {commission} par commande, à régler dès que la commission atteint {formatFcfa(settings.commission_threshold)} FCFA.
        </p>
      )}
    </Card>
  );
}
