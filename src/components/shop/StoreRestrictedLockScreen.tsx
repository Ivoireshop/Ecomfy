import React from "react";
import { Lock, CreditCard, ShieldAlert, ArrowRight, Eye, Package, Settings, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface StoreRestrictedLockScreenProps {
  title?: string;
  description?: string;
  invoiceNumber?: string | null;
  onPayClick?: () => void;
  children?: React.ReactNode;
  isRestricted?: boolean;
}

export const StoreRestrictedLockScreen: React.FC<StoreRestrictedLockScreenProps> = ({
  title = "Gestion de boutique suspendue",
  description = "Votre boutique continue de recevoir des commandes, mais l'accès aux données clients et la modification des produits et paramètres sont temporairement suspendus.",
  invoiceNumber,
  onPayClick,
  children,
  isRestricted = true,
}) => {
  const navigate = useNavigate();

  if (!isRestricted) {
    return <>{children}</>;
  }

  const handlePay = () => {
    if (onPayClick) {
      onPayClick();
    } else {
      navigate("/dashboard/billing");
    }
  };

  return (
    <div className="relative rounded-3xl bg-slate-900/90 border-2 border-red-500/60 p-6 sm:p-10 text-center text-white overflow-hidden shadow-2xl backdrop-blur-xl my-6">
      
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-xl mx-auto space-y-6">
        
        {/* Lock Icon Badge */}
        <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-950 border border-red-500/50 text-red-400 shadow-xl shadow-red-950/50">
          <Lock className="w-10 h-10 animate-pulse" />
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-black uppercase tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5" /> STORE RESTRICTED · IMPAYÉ
          </span>

          <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {title}
          </h3>

          <p className="text-sm text-slate-300 leading-relaxed font-medium">
            {description}
          </p>
        </div>

        {/* Amount Due Box */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-red-500/30 text-center space-y-1 max-w-sm mx-auto shadow-inner">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Montant dû pour réactivation instantanée
          </span>
          <div className="text-3xl font-black text-red-400 font-mono tracking-tight">
            12 000 FCFA
          </div>
          {invoiceNumber && (
            <span className="text-[11px] text-slate-400 block font-mono">
              Facture n° {invoiceNumber}
            </span>
          )}
        </div>

        {/* Blocked vs Active Feature Overview */}
        <div className="grid grid-cols-2 gap-3 text-left max-w-md mx-auto pt-2">
          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-xs space-y-1">
            <span className="text-emerald-400 font-bold block flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> Toujours Actif
            </span>
            <p className="text-slate-300 text-[11px] leading-tight">
              Réception des nouvelles commandes & système de checkout client.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/20 text-xs space-y-1">
            <span className="text-red-400 font-bold block flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" /> Temporairement Suspendu
            </span>
            <p className="text-slate-300 text-[11px] leading-tight">
              Coordonnées clients, modification de produits et paramètres.
            </p>
          </div>
        </div>

        {/* CTA Pay Button */}
        <div className="pt-2">
          <Button
            onClick={handlePay}
            size="lg"
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 text-white font-black text-base shadow-xl shadow-red-600/40 border border-red-400 flex items-center justify-center gap-2 group transition-all"
          >
            <CreditCard className="w-5 h-5" />
            <span>PAYER 12 000 FCFA ET DÉVERROUILLER</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>

      </div>
    </div>
  );
};
