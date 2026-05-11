import { useEffect, useState } from "react";
import { AlertTriangle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PayCommissionDialog } from "./PayCommissionDialog";

interface BillingBannerProps {
  balanceDue: number;
  threshold: number;
  paymentDeadline?: string | null;
  isSuspended?: boolean;
  supportPhone?: string;
  shopId?: string;
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export function BillingBanner({
  balanceDue,
  threshold,
  paymentDeadline,
  isSuspended,
  supportPhone = "+225 07 58 15 27 61",
  shopId,
}: BillingBannerProps) {
  const [now, setNow] = useState(() => Date.now());
  const [payOpen, setPayOpen] = useState(false);
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
          <div className="flex gap-2 shrink-0">
            {shopId && balanceDue > 0 && (
              <Button size="sm" variant="secondary" className="font-semibold" onClick={() => setPayOpen(true)}>
                Payer maintenant
              </Button>
            )}
            <Button asChild size="sm" variant="outline" className="font-semibold bg-transparent text-white border-white/40 hover:bg-white/10 hover:text-white">
              <a href={`https://wa.me/${supportPhone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer">
                Support
              </a>
            </Button>
          </div>
        </div>
        {shopId && <PayCommissionDialog open={payOpen} onOpenChange={setPayOpen} shopId={shopId} balanceDue={balanceDue} />}
      </div>
    );
  }

  if (balanceDue > 0) {
    return (
      <div className={`${overThreshold ? "bg-red-600" : "bg-red-500"} text-white px-4 md:px-6 py-3`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-base sm:text-lg">
                Montant dû : {fmt(balanceDue)} FCFA
              </p>
              <p className="text-xs sm:text-sm opacity-95">
                {overThreshold && remainingDays !== null
                  ? `Vous avez ${remainingDays} jour${remainingDays > 1 ? "s" : ""} pour payer votre facture, sinon votre boutique sera automatiquement fermée.`
                  : overThreshold
                    ? "Veuillez régler votre facture sous 3 jours pour continuer à vendre."
                    : `Vous pouvez régler votre commission dès maintenant (seuil de blocage : ${fmt(threshold)} FCFA).`}
              </p>
            </div>
          </div>
          {shopId && (
            <Button size="sm" variant="secondary" className="font-semibold shrink-0" onClick={() => setPayOpen(true)}>
              Payer maintenant
            </Button>
          )}
        </div>
        {shopId && <PayCommissionDialog open={payOpen} onOpenChange={setPayOpen} shopId={shopId} balanceDue={balanceDue} />}
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
          <span className="font-semibold">0 FCFA</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            / {fmt(threshold)} FCFA
          </span>
        </div>
      </div>
    </div>
  );
}