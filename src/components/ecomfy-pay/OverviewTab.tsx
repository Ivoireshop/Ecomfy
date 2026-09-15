import React from "react";
import { Wallet, EcomfyPayment, MerchantKyc } from "@/types/ecomfyPay";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Wallet as WalletIcon,
  Clock,
  ArrowUpRight,
  TrendingUp,
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  ArrowDownLeft,
  CheckCircle2,
} from "lucide-react";
import { PaymentMethodLogo } from "./PaymentMethodLogo";

interface OverviewTabProps {
  wallet: Wallet | null;
  kyc: MerchantKyc | null;
  payments: EcomfyPayment[];
  onOpenWithdrawal: () => void;
  onNavigateTab: (tab: string) => void;
  formatPrice: (amount: number) => string;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  wallet,
  kyc,
  payments,
  onOpenWithdrawal,
  onNavigateTab,
  formatPrice,
}) => {
  const pendingBalance = wallet?.pending_balance || 0;
  const availableBalance = wallet?.available_balance || 0;
  const totalReceived = wallet?.total_received || 0;
  const totalWithdrawn = wallet?.total_withdrawn || 0;

  const isKycVerified = kyc?.verification_status === "VERIFIED";
  const recentPayments = payments.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Banner d'alerte KYC si non vérifié */}
      {!isKycVerified && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-600 rounded-xl shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-amber-900 text-sm sm:text-base">
                Identité marchande à vérifier (KYC)
              </h4>
              <p className="text-xs sm:text-sm text-amber-700 mt-0.5">
                Soumettez vos documents de vérification d'identité pour pouvoir effectuer des retraits vers votre Mobile Money ou compte bancaire.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shrink-0"
            onClick={() => onNavigateTab("kyc")}
          >
            Vérifier mon identité →
          </Button>
        </div>
      )}

      {/* Cartes financières principales (Fintech Overview) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Solde Disponible */}
        <div className="bg-gradient-to-br from-[#0E7C66] to-[#0A5C4C] rounded-2xl p-5 text-white shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-100">
              Solde Disponible
            </span>
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
              <WalletIcon className="w-4 h-4 text-emerald-200" />
            </div>
          </div>
          <div className="my-4">
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {formatPrice(availableBalance)}{" "}
              <span className="text-sm font-medium opacity-80">FCFA</span>
            </h3>
            <p className="text-[11px] text-emerald-100/80 mt-1">
              Immédiatement retirable
            </p>
          </div>
          <Button
            size="sm"
            className="w-full bg-white text-[#0E7C66] hover:bg-emerald-50 font-bold rounded-xl text-xs shadow-md"
            onClick={onOpenWithdrawal}
            disabled={availableBalance <= 0 || !isKycVerified}
          >
            <ArrowUpRight className="w-3.5 h-3.5 mr-1.5" /> Retirer mes fonds
          </Button>
        </div>

        {/* Solde En Attente */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Solde en attente
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="my-4">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {formatPrice(pendingBalance)}{" "}
              <span className="text-sm font-medium text-slate-500">FCFA</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Délai de règlement 72h encours
            </p>
          </div>
          <div className="text-[11px] font-medium text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
            <Clock className="w-3 h-3 shrink-0" />
            <span>Disponible après contrôle automatisé</span>
          </div>
        </div>

        {/* Total Reçu */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Encaissé
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="my-4">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {formatPrice(totalReceived)}{" "}
              <span className="text-sm font-medium text-slate-500">FCFA</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Cumul des paiements réussis
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs font-medium rounded-xl border-slate-200 text-slate-700"
            onClick={() => onNavigateTab("payments")}
          >
            Voir les transactions →
          </Button>
        </div>

        {/* Total Retiré */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Retiré
            </span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="my-4">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {formatPrice(totalWithdrawn)}{" "}
              <span className="text-sm font-medium text-slate-500">FCFA</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Transféré vers Mobile Money / Banque
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs font-medium rounded-xl border-slate-200 text-slate-700"
            onClick={() => onNavigateTab("wallet")}
          >
            Historique des retraits →
          </Button>
        </div>
      </div>

      {/* Raccourcis d'actions & Statut du compte */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#0E7C66]/10 text-[#0E7C66] rounded-xl">
              <CreditCard className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Payment Links</h4>
          </div>
          <p className="text-xs text-slate-500">
            Générez des liens de paiement directs pour vos produits pour vendre sur WhatsApp, Instagram ou Facebook.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs font-semibold text-[#0E7C66] border-[#0E7C66]/30 hover:bg-[#0E7C66]/5 rounded-xl"
            onClick={() => onNavigateTab("payment_links")}
          >
            Mes Payment Links →
          </Button>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Statut Marchand</h4>
          </div>
          <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
            <span className="text-slate-500">Vérification KYC :</span>
            {isKycVerified ? (
              <Badge className="bg-emerald-100 text-emerald-800 font-semibold border-0 text-[10px]">
                ✓ Vérifié
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-800 font-semibold border-0 text-[10px]">
                En attente
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-between text-xs py-1">
            <span className="text-slate-500">Compte Ecomfy Pay :</span>
            <Badge className="bg-emerald-100 text-emerald-800 font-semibold border-0 text-[10px]">
              Actif
            </Badge>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Délai de règlement</h4>
          </div>
          <p className="text-xs text-slate-500">
            Les fonds reçus sont conservés <span className="font-semibold text-slate-800">72 heures</span> en attente avant d'être transférés sur votre solde disponible.
          </p>
          <span className="text-[11px] text-slate-400 block">
            Garantie anti-fraude &amp; sécurité des clients
          </span>
        </div>
      </div>

      {/* Derniers Paiements Reçus */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-slate-900 text-base">
            Derniers Paiements Reçus
          </h4>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-[#0E7C66] font-semibold hover:bg-emerald-50"
            onClick={() => onNavigateTab("payments")}
          >
            Tout voir →
          </Button>
        </div>

        {recentPayments.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500">
              Aucune transaction encaissée pour le moment.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentPayments.map((p) => (
              <div
                key={p.id}
                className="py-3 flex items-center justify-between gap-3 text-xs sm:text-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <PaymentMethodLogo id={p.payment_method_code || p.payment_method || "card"} size={36} />
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900 block truncate">
                      {p.customer_name || "Client"}
                    </span>
                    <span className="text-[11px] text-slate-400 block truncate">
                      {p.internal_reference} • {new Date(p.created_at).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-bold text-slate-900 block">
                    +{formatPrice(p.net_merchant_amount)} FCFA
                  </span>
                  <Badge
                    className={
                      p.status === "SUCCEEDED"
                        ? "bg-emerald-100 text-emerald-800 text-[10px]"
                        : "bg-amber-100 text-amber-800 text-[10px]"
                    }
                  >
                    {p.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
