import React, { useState } from "react";
import { AlertTriangle, Lock, Clock, CreditCard, CheckCircle2, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BillingStatusInfo, formatGracePeriodCountdown } from "@/lib/billingSystem";
import { useNavigate } from "react-router-dom";

import { useBillingSystem } from "@/hooks/useBillingSystem";

import { BillingPaymentModal } from "./BillingPaymentModal";

interface BillingAlertBannerProps {
  shopId?: string | null;
  billingInfo?: BillingStatusInfo | null;
  onPayClick?: () => void;
}

export const BillingAlertBanner: React.FC<BillingAlertBannerProps> = ({ shopId, billingInfo: propsBillingInfo, onPayClick }) => {
  const navigate = useNavigate();
  const [dismissedSuccess, setDismissedSuccess] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const { billingInfo: hookBillingInfo } = useBillingSystem(shopId);
  const billingInfo = propsBillingInfo !== undefined ? propsBillingInfo : hookBillingInfo;

  if (!billingInfo) return null;

  const { isRestricted, isGracePeriod, remainingMs, dueDate, invoiceNumber, status } = billingInfo;

  const handlePay = () => {
    if (onPayClick) {
      onPayClick();
    } else {
      setPaymentModalOpen(true);
    }
  };

  // 1. STORE_RESTRICTED (Red Lock Banner)
  if (isRestricted) {
    return (
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-red-950 via-red-900 to-slate-900 border-2 border-red-500/80 p-4 sm:p-5 text-white shadow-xl shadow-red-950/40 relative overflow-hidden animate-pulse-subtle">
        <div className="absolute top-0 right-0 translate-x-8 -translate-y-8 w-40 h-40 bg-red-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 shrink-0 mt-0.5">
              <Lock className="w-6 h-6 animate-bounce" />
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-red-500 text-white font-black text-xs uppercase tracking-wider">
                  🔒 BOUTIQUE TEMPORAIREMENT RESTREINTE
                </span>
                {invoiceNumber && (
                  <span className="text-xs text-red-200/80 font-mono">
                    Réf: {invoiceNumber}
                  </span>
                )}
              </div>

              <p className="text-sm font-semibold text-red-100 leading-snug">
                Votre boutique continue de recevoir des commandes, mais l'accès aux données clients et à la gestion de votre boutique est temporairement suspendu.
              </p>

              <div className="flex items-center gap-4 text-xs text-red-200/90 font-medium pt-1">
                <span>Montant dû : <strong className="text-white font-bold text-sm">12 000 FCFA</strong></span>
                <span>•</span>
                <span>Statut : <strong className="text-red-300 font-bold uppercase">IMPAYÉ</strong></span>
              </div>
            </div>
          </div>

          <Button
            onClick={handlePay}
            className="w-full md:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 text-white font-black text-sm shadow-lg shadow-red-600/40 border border-red-400 shrink-0 flex items-center justify-center gap-2 group transition-all duration-200"
          >
            <CreditCard className="w-4 h-4" />
            <span>PAYER 12 000 FCFA</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>

        <BillingPaymentModal open={paymentModalOpen} onOpenChange={setPaymentModalOpen} shopId={shopId} />
      </div>
    );
  }

  // 2. GRACE PERIOD / PAYMENT_DUE (Amber Countdown Banner)
  if (isGracePeriod) {
    const formattedDate = dueDate ? new Date(dueDate).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }) : "";

    return (
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border border-amber-500/60 p-4 sm:p-5 text-white shadow-lg shadow-amber-950/20 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 shrink-0 mt-0.5">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider">
                  ⚠️ SEUIL DE FACTURATION ATTEINT (240 COMMANDES)
                </span>
                {formattedDate && (
                  <span className="text-xs text-amber-200/80 font-medium">
                    Date limite : {formattedDate}
                  </span>
                )}
              </div>

              <p className="text-sm text-slate-200 leading-snug">
                Votre boutique a atteint 240 commandes. Un montant de <strong>12 000 FCFA</strong> est maintenant dû.
                Vous disposez de 3 jours pour effectuer le règlement afin de conserver un accès normal à la gestion de votre boutique.
              </p>

              <div className="flex items-center gap-2 text-xs font-bold text-amber-300 pt-1">
                <Clock className="w-4 h-4" />
                <span>Temps restant : {formatGracePeriodCountdown(remainingMs)}</span>
              </div>
            </div>
          </div>

          <Button
            onClick={handlePay}
            className="w-full md:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/30 border border-yellow-300 shrink-0 flex items-center justify-center gap-2 group transition-all duration-200"
          >
            <CreditCard className="w-4 h-4 text-slate-950" />
            <span>PAYER 12 000 FCFA</span>
            <ChevronRight className="w-4 h-4 text-slate-950 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>

        <BillingPaymentModal open={paymentModalOpen} onOpenChange={setPaymentModalOpen} shopId={shopId} />
      </div>
    );
  }

  // 3. STORE_REACTIVATED / PAYMENT_CONFIRMED Success Toast Banner
  if ((status === "STORE_REACTIVATED" || status === "PAYMENT_CONFIRMED") && !dismissedSuccess) {
    return (
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border border-emerald-500/60 p-4 text-white shadow-lg shadow-emerald-950/20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
          <div>
            <h4 className="font-bold text-sm text-emerald-300">✅ Paiement confirmé</h4>
            <p className="text-xs text-slate-300">
              Votre règlement de 12 000 FCFA a été confirmé. Votre boutique est maintenant entièrement réactivée et les coordonnées clients sont accessibles.
            </p>
          </div>
        </div>
        <button
          onClick={() => setDismissedSuccess(true)}
          className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <BillingPaymentModal open={paymentModalOpen} onOpenChange={setPaymentModalOpen} shopId={shopId} />
    </>
  );
};
