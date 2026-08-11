import { useEffect, useState } from "react";
import { AlertTriangle, Wallet, ArrowRight, ShieldAlert } from "lucide-react";
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
      <div className="mx-4 md:mx-6 mt-6 p-4 md:p-5 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive-foreground shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2 bg-destructive/20 rounded-full shrink-0">
              <ShieldAlert className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="font-bold text-base text-destructive">Boutique suspendue</p>
              <p className="text-sm text-destructive/90 mt-0.5 leading-relaxed">
                Votre solde dû de <span className="font-semibold">{fmt(balanceDue)} FCFA</span> n'a pas été réglé dans les délais. Contactez le support Ecomfy pour réactiver votre boutique.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {shopId && balanceDue > 0 && (
              <Button size="sm" variant="destructive" className="font-semibold shadow-sm" onClick={() => setPayOpen(true)}>
                Payer {fmt(balanceDue)} F
              </Button>
            )}
            <Button asChild size="sm" variant="outline" className="font-semibold border-destructive/30 text-destructive hover:bg-destructive/10">
              <a href={`https://wa.me/${supportPhone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer">
                Contacter le support
              </a>
            </Button>
          </div>
        </div>
        {shopId && <PayCommissionDialog open={payOpen} onOpenChange={setPayOpen} shopId={shopId} balanceDue={balanceDue} />}
      </div>
    );
  }

  if (balanceDue > 0) {
    const isUrgent = overThreshold;
    return (
      <div className={`mx-4 md:mx-6 mt-6 p-4 md:p-5 rounded-2xl border shadow-sm ${
        isUrgent 
          ? "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/30 text-orange-900 dark:text-orange-200" 
          : "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/30 text-blue-900 dark:text-blue-200"
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-2 rounded-full shrink-0 ${isUrgent ? "bg-orange-200/50 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400" : "bg-blue-200/50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"}`}>
              {isUrgent ? <AlertTriangle className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}
            </div>
            <div>
              <p className="font-bold text-base flex items-center gap-2">
                Facture en attente
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isUrgent ? "bg-orange-200 text-orange-800 dark:bg-orange-900 dark:text-orange-200" : "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                }`}>
                  {fmt(balanceDue)} FCFA
                </span>
              </p>
              <p className={`text-sm mt-1 leading-relaxed ${isUrgent ? "text-orange-800/80 dark:text-orange-300/80" : "text-blue-800/80 dark:text-blue-300/80"}`}>
                {isUrgent && remainingDays !== null
                  ? `Vous avez ${remainingDays} jour${remainingDays > 1 ? "s" : ""} pour régler votre facture. Au-delà, votre boutique sera suspendue temporairement.`
                  : isUrgent
                    ? "Veuillez régler votre facture sous 3 jours pour éviter toute interruption de service."
                    : `Votre solde approche le seuil de paiement de ${fmt(threshold)} FCFA.`}
              </p>
            </div>
          </div>
          {shopId && (
            <Button 
              size="sm" 
              onClick={() => setPayOpen(true)}
              className={`shrink-0 font-semibold shadow-sm group ${
                isUrgent 
                  ? "bg-orange-600 hover:bg-orange-700 text-white" 
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              Régler maintenant <ArrowRight className="h-3.5 w-3.5 ml-1.5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          )}
        </div>
        {shopId && <PayCommissionDialog open={payOpen} onOpenChange={setPayOpen} shopId={shopId} balanceDue={balanceDue} />}
      </div>
    );
  }

  // Si solde = 0, on n'affiche plus de grande bannière, juste un indicateur discret si besoin (ou rien).
  return null;
}