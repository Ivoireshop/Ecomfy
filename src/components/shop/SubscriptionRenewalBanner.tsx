import { useState } from "react";
import { AlertTriangle, CalendarClock, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { SUBSCRIPTION_REMINDER_DAYS, startShopSubscriptionPayment, type ShopSubscriptionState } from "@/lib/shopSubscription";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.max(0, Math.round(n)));
const fmtDate = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

interface Props {
  shopId: string;
  subscription: ShopSubscriptionState;
}

/**
 * Rappel de renouvellement : dans les derniers jours de l'abonnement, puis pendant le délai de grâce qui suit l'échéance.
 * Passé ce délai, l'espace est fermé par ShopPaymentGate.
 */
export function SubscriptionRenewalBanner({ shopId, subscription }: Props) {
  const [loading, setLoading] = useState(false);
  const { hasSubscribed, isActive, inGrace, daysLeft, activeUntil, graceEndsAt, renewalAmount, plan } = subscription;

  const showReminder = hasSubscribed && isActive && daysLeft !== null && daysLeft <= SUBSCRIPTION_REMINDER_DAYS;
  if (!showReminder && !inGrace) return null;

  const renew = async () => {
    setLoading(true);
    try {
      window.location.href = await startShopSubscriptionPayment(shopId, plan);
    } catch (e: any) {
      toast({ title: "Paiement non démarré", description: e?.message || "Réessayez dans un instant.", variant: "destructive" });
      setLoading(false);
    }
  };

  const urgent = inGrace || (daysLeft !== null && daysLeft <= 1);
  const title = inGrace
    ? "Abonnement expiré : renouvelez-le pour garder votre boutique ouverte"
    : daysLeft === 0
      ? "Votre abonnement se termine aujourd'hui"
      : `Votre abonnement se termine dans ${daysLeft} jour${daysLeft! > 1 ? "s" : ""}`;
  const detail = inGrace
    ? `Sans renouvellement avant le ${graceEndsAt ? fmtDate(graceEndsAt) : "délai prévu"}, l'espace de gestion de votre boutique sera fermé.`
    : `Fin le ${activeUntil ? fmtDate(activeUntil) : "—"}. Renouvelez maintenant : les jours restants sont conservés et ajoutés au nouveau mois.`;

  return (
    <div className={`${urgent ? "bg-red-600" : "bg-amber-500"} text-white px-4 md:px-6 py-3`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          {urgent ? <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" /> : <CalendarClock className="h-5 w-5 shrink-0 mt-0.5" />}
          <div>
            <p className="font-bold text-sm sm:text-base">{title}</p>
            <p className="text-xs sm:text-sm opacity-95">{detail}</p>
          </div>
        </div>
        {renewalAmount ? (
          <Button size="sm" variant="secondary" className="font-semibold shrink-0 gap-1.5" onClick={renew} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Renouveler ({fmt(renewalAmount)} FCFA)
          </Button>
        ) : null}
      </div>
    </div>
  );
}
