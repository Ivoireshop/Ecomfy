import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRemaining, type ShopPaymentInfo } from "@/lib/shopPaymentStatus";
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
    const i = window.setInterval(() => setNow(Date.now()), 1000 * 30);
    return () => window.clearInterval(i);
  }, []);

  if (info.status !== "payment_pending") return null;

  const remaining = info.deadline ? Math.max(0, new Date(info.deadline).getTime() - now) : 0;

  return (
    <div className="bg-red-600 text-white px-4 md:px-6 py-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm sm:text-base">
              Paiement requis : {fmt(info.amountDue)} FCFA
            </p>
            <p className="text-xs sm:text-sm opacity-95">
              Temps restant : <span className="font-semibold">{formatRemaining(remaining)}</span>
              {" "}· Payez 50%, 75% ou 100% pour éviter le verrouillage.
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