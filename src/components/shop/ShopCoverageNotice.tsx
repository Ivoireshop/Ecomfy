import { Info, ShieldCheck } from "lucide-react";
import { useBillingSettings, useMyShopCoverage } from "@/hooks/useSubscriptionPlans";
import { formatFcfa } from "@/lib/subscriptionPlans";

interface Props {
  /** "builder" : avant la création d'une boutique ; "manager" : liste des boutiques. */
  variant: "builder" | "manager";
  className?: string;
}

/**
 * Explique au marchand ce que couvre son abonnement : les N boutiques les plus anciennes sont à 0 commission, les
 * suivantes paient la commission par commande. Information seule, la création n'est jamais bloquée.
 */
export function ShopCoverageNotice({ variant, className = "" }: Props) {
  const { coverage } = useMyShopCoverage();
  const { settings } = useBillingSettings();
  const commission = `${formatFcfa(settings.commission_per_order)} FCFA`;
  const owned = coverage?.shops?.length ?? 0;
  const active = !!coverage?.subscription_active && coverage?.max_shops !== null && coverage?.max_shops !== undefined;
  const max = coverage?.max_shops ?? 0;

  let message: string;
  let covered = false;
  if (!active) {
    message = variant === "builder"
      ? `Sans abonnement, chaque boutique paie une commission de ${commission} par commande.`
      : `Sans abonnement, chaque boutique paie une commission de ${commission} par commande. Un abonnement couvre vos boutiques les plus anciennes (0 commission).`;
  } else if (variant === "builder") {
    covered = owned < max;
    message = covered
      ? `Votre plan ${coverage?.plan_name} inclut ${max} boutique${max > 1 ? "s" : ""} (vous en avez ${owned}). Cette nouvelle boutique sera couverte : 0 commission.`
      : `Votre plan ${coverage?.plan_name} inclut ${max} boutique${max > 1 ? "s" : ""} et vous en avez déjà ${owned}. Cette nouvelle boutique paiera ${commission} par commande.`;
  } else {
    covered = true;
    message = `Votre plan ${coverage?.plan_name} inclut ${max} boutique${max > 1 ? "s" : ""} (les plus anciennes) : 0 commission. ${owned > max ? `Les ${owned - max} suivante${owned - max > 1 ? "s" : ""} paie${owned - max > 1 ? "nt" : ""} ${commission} par commande.` : ""}`;
  }

  return (
    <div
      role="note"
      className={`rounded-lg border p-3 text-sm flex items-start gap-2 ${
        covered ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-900"
      } ${className}`}
    >
      {covered ? <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" /> : <Info className="h-4 w-4 shrink-0 mt-0.5" />}
      <span>{message}</span>
    </div>
  );
}
