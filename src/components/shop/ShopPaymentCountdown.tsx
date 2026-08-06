import { useEffect, useState } from "react";
import { AlertTriangle, Lock, AlertOctagon, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRemaining, supportWhatsappLink, type ShopPaymentInfo } from "@/lib/shopPaymentStatus";
import { PayCommissionDialog } from "./PayCommissionDialog";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.max(0, Math.round(n)));

interface Props {
  shopId: string;
  info: ShopPaymentInfo;
}

export function ShopPaymentCountdown({ shopId, info }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [payOpen, setPayOpen] = useState(false);

  useEffect(() => {
    const i = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(i);
  }, []);

  if (info.status === "active") return null;

  const remaining = info.deadline ? Math.max(0, new Date(info.deadline).getTime() - now) : 0;
  const amount = info.amountDue > 0 ? info.amountDue : 12000;

  // FINAL SUSPENSION
  if (info.status === "final_suspension") {
    const waMsg = "Bonjour Ecomfy, ma boutique a été fermée pour défaut de paiement. Je souhaite la réactiver.";
    return (
      <div className="bg-red-800 text-white px-4 md:px-6 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertOctagon className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm sm:text-base">Boutique fermée — accès commandes bloqué</p>
              <p className="text-xs sm:text-sm opacity-95">
                Votre boutique publique reste visible mais l'espace de gestion est fermé.
                Contactez le support pour réactiver.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="secondary" className="font-semibold shrink-0 gap-1.5">
            <a href={supportWhatsappLink(waMsg)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" /> Support WhatsApp
            </a>
          </Button>
        </div>
      </div>
    );
  }

  // LOCKED — full-amount payment required, WA fallback
  if (info.status === "locked") {
    const isExtra = info.extraDeadlineActive;
    const extraExpired = isExtra && remaining <= 0;
    return (
      <div className="bg-red-700 text-white px-4 md:px-6 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm sm:text-base">
                {isExtra
                  ? `Dernier délai — Payez ${fmt(amount)} FCFA pour déverrouiller`
                  : `Boutique verrouillée — Payez ${fmt(amount)} FCFA pour déverrouiller`}
              </p>
              <p className="text-xs sm:text-sm opacity-95">
                {isExtra ? (
                  extraExpired ? (
                    <>Le délai supplémentaire est expiré. Veuillez effectuer votre paiement pour réactiver votre boutique.</>
                  ) : (
                    <>Un dernier délai de 2 jours vous a été accordé. Temps restant : <span className="font-semibold">{formatRemaining(remaining)}</span></>
                  )
                ) : (
                  <>
                    Votre boutique reste en ligne pour vos clients. L'accès aux commandes est
                    bloqué jusqu'au paiement complet.
                    {remaining > 0 && (<> · Fermeture définitive dans <span className="font-semibold">{formatRemaining(remaining)}</span></>)}
                  </>
                )}
              </p>
            </div>
          </div>
          <Button size="sm" variant="secondary" className="font-semibold shrink-0" onClick={() => setPayOpen(true)}>
            Déverrouiller maintenant
          </Button>
        </div>
        <PayCommissionDialog open={payOpen} onOpenChange={setPayOpen} shopId={shopId} balanceDue={amount} fullOnly />
      </div>
    );
  }

  // PAYMENT PENDING — 3-day warning window with flexible tranches
  return (
    <div className="bg-red-600 text-white px-4 md:px-6 py-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm sm:text-base">
              Seuil atteint — Paiement requis : {fmt(info.amountDue)} FCFA
            </p>
            <p className="text-xs sm:text-sm opacity-95">
              Temps restant : <span className="font-semibold">{formatRemaining(remaining)}</span>
              {" "}· Pendant ces 3 jours, payez 25%, 50%, 75% ou 100% pour éviter le verrouillage.
            </p>
          </div>
        </div>
        <Button size="sm" variant="secondary" className="font-semibold shrink-0" onClick={() => setPayOpen(true)}>
          Payer maintenant
        </Button>
      </div>
      <PayCommissionDialog open={payOpen} onOpenChange={setPayOpen} shopId={shopId} balanceDue={info.amountDue} />
    </div>
  );
}