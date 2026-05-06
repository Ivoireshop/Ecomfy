import { useEffect, useState } from "react";
import { AlertTriangle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BillingBannerProps {
  balanceDue: number;
  threshold: number;
  paymentDeadline?: string | null;
  isSuspended?: boolean;
  supportPhone?: string;
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export function BillingBanner({
  balanceDue,
  threshold,
  paymentDeadline,
  isSuspended,
  supportPhone = "+225 07 58 15 27 61",
}: BillingBannerProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(i);
  }, []);

  const overThreshold = balanceDue >= threshold;
  const deadlineMs = paymentDeadline ? new Date(paymentDeadline).getTime() : null;
  const remainingMs = deadlineMs ? deadlineMs - now : null;
  const remainingDays =
    remainingMs !== null ? Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24))) : null;

  if (isSuspended) {
    return (
      <div className="bg-red-600 text-white px-4 md:px-6 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Boutique suspendue</p>
              <p className="text-xs opacity-90">
                Votre solde dû de {fmt(balanceDue)} FCFA n'a pas été réglé dans les délais.
                Contactez le support VisualPro pour réactiver votre boutique.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="secondary" className="font-semibold shrink-0">
            <a href={`https://wa.me/${supportPhone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer">
              Contacter le support
            </a>
          </Button>
        </div>
      </div>
    );
  }

  if (overThreshold) {
    return (
      <div className="bg-red-500 text-white px-4 md:px-6 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">
                Facture à régler : {fmt(balanceDue)} FCFA
              </p>
              <p className="text-xs opacity-90">
                {remainingDays !== null
                  ? `Vous avez ${remainingDays} jour${remainingDays > 1 ? "s" : ""} pour payer votre facture, sinon votre boutique sera automatiquement fermée.`
                  : "Veuillez régler votre facture sous 3 jours pour continuer à vendre."}
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="secondary" className="font-semibold shrink-0">
            <a href={`https://wa.me/${supportPhone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer">
              Payer maintenant
            </a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted/50 border-b px-4 md:px-6 py-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Wallet className="h-4 w-4" />
          <span>Montant dû VisualPro</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{fmt(balanceDue)} FCFA</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            / {fmt(threshold)} FCFA
          </span>
        </div>
      </div>
    </div>
  );
}