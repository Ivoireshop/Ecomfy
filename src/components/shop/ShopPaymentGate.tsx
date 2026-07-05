import { useEffect, useState } from "react";
import { AlertOctagon, Lock, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRemaining, supportWhatsappLink, type ShopPaymentInfo } from "@/lib/shopPaymentStatus";
import { PayCommissionDialog } from "./PayCommissionDialog";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.max(0, Math.round(n)));

interface Props {
  shopId: string;
  info: ShopPaymentInfo;
  children: React.ReactNode;
}

export function ShopPaymentGate({ shopId, info, children }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [payOpen, setPayOpen] = useState(false);

  useEffect(() => {
    if (info.status !== "locked" && info.status !== "final_suspension") return;
    const i = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(i);
  }, [info.status]);

  if (info.status !== "locked" && info.status !== "final_suspension") {
    return <>{children}</>;
  }

  const remaining = info.deadline ? Math.max(0, new Date(info.deadline).getTime() - now) : 0;
  const isFinal = info.status === "final_suspension";
  const isExtra = info.status === "locked" && info.extraDeadlineActive;
  const extraExpired = isExtra && remaining <= 0;
  const waMsg = isFinal
    ? "Bonjour VisualPro, ma boutique a été fermée pour défaut de paiement. Je souhaite la réactiver."
    : `Bonjour VisualPro, ma boutique est verrouillée pour un paiement de ${fmt(info.amountDue)} FCFA. Je souhaite être assisté.`;

  return (
    <div className="relative min-h-[70vh]">
      {/* Blurred inert content */}
      <div aria-hidden className="pointer-events-none select-none blur-sm opacity-40">
        {children}
      </div>

      {/* Overlay */}
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-red-900/60 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border-2 border-red-600 overflow-hidden">
          <div className="bg-red-600 text-white px-5 py-4 flex items-center gap-2">
            {isFinal ? <AlertOctagon className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
            <h2 className="text-lg font-bold">
              {isFinal ? "Boutique fermée définitivement" : "Boutique verrouillée"}
            </h2>
          </div>
          <div className="p-5 space-y-4 text-gray-800">
            {isFinal ? (
              <p className="text-sm">
                Votre boutique a été fermée définitivement pour défaut de paiement. Pour la réactiver,
                veuillez contacter le support VisualPro sur WhatsApp.
              </p>
            ) : isExtra ? (
              <>
                <p className="text-sm">
                  Votre boutique est actuellement verrouillée. Un <span className="font-semibold">dernier délai de 2 jours</span> vous a été accordé pour effectuer le paiement de{" "}
                  <span className="font-bold text-red-600">{fmt(info.amountDue > 0 ? info.amountDue : 12000)} FCFA</span>.
                </p>
                {extraExpired ? (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-center">
                    <p className="text-sm font-semibold text-red-700">
                      Le délai supplémentaire est expiré. Veuillez effectuer votre paiement pour réactiver votre boutique.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-center">
                    <p className="text-xs uppercase tracking-wide text-red-700 font-semibold">Temps restant</p>
                    <p className="text-xl font-bold text-red-700 mt-1">{formatRemaining(remaining)}</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-sm">
                  Votre boutique est temporairement verrouillée. Vous disposez de 3 jours pour payer la
                  totalité du montant dû, soit <span className="font-bold text-red-600">{fmt(info.amountDue)} FCFA</span>.
                  Les paiements en tranche (25%, 50%, 75%) ne sont plus disponibles à ce stade.
                </p>
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-center">
                  <p className="text-xs uppercase tracking-wide text-red-700 font-semibold">
                    Fermeture définitive dans
                  </p>
                  <p className="text-xl font-bold text-red-700 mt-1">{formatRemaining(remaining)}</p>
                </div>
              </>
            )}

            {isFinal ? (
              <>
                <Button asChild size="lg" className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white">
                  <a href={supportWhatsappLink(waMsg)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-5 w-5" />
                    Contacter le support WhatsApp
                  </a>
                </Button>
                <Button disabled variant="outline" size="lg" className="w-full">
                  Payer maintenant
                </Button>
              </>
            ) : (
              <>
                <Button size="lg" onClick={() => setPayOpen(true)} className="w-full bg-red-600 hover:bg-red-700 text-white">
                  Payer {fmt(info.amountDue)} FCFA maintenant
                </Button>
                <Button asChild variant="outline" size="lg" className="w-full gap-2">
                  <a href={supportWhatsappLink(waMsg)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4" />
                    Contacter le support
                  </a>
                </Button>
              </>
            )}

            <p className="text-[11px] text-center text-gray-500">
              Vous restez connecté à VisualPro. Les fonctionnalités de la boutique sont bloquées tant
              que le paiement n'est pas effectué.
            </p>
          </div>
        </div>
      </div>

      <PayCommissionDialog open={payOpen} onOpenChange={setPayOpen} shopId={shopId} balanceDue={info.amountDue} fullOnly />
    </div>
  );
}