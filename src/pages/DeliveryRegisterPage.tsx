import React from "react";
import { Truck, ShieldCheck } from "lucide-react";
import { DeliveryOnboardingWizard } from "@/components/delivery/DeliveryOnboardingWizard";

export default function DeliveryRegisterPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Header Banner */}
      <div className="max-w-4xl mx-auto mb-8 text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold tracking-wide uppercase">
          <Truck className="w-4 h-4" /> Ecomfy Livraison — Inscription & Vérification
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-emerald-400 bg-clip-text text-transparent">
          Vérification d'Identité & Activation de Compte
        </h1>
        <p className="text-slate-400 text-base max-w-2xl mx-auto">
          Complétez la vérification de vos pièces justificatives (Gérants et Livreurs) pour débloquer votre accès au service Ecomfy Livraison.
        </p>

        {/* Security Alert Badge */}
        <div className="mt-4 p-4 rounded-xl bg-slate-900/80 border border-amber-500/30 text-amber-300 text-sm flex items-start gap-3 text-left max-w-2xl mx-auto shadow-lg backdrop-blur-md">
          <ShieldCheck className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">Sécurité & Confidentialité de vos Données :</span>
            <span className="block text-slate-300 text-xs mt-1">
              Vos pièces d'identité et selfies sont analysés de manière sécurisée et ne sont jamais exposés publiquement. Seuls les profils approuvés sont autorisés.
            </span>
          </div>
        </div>
      </div>

      {/* Main Onboarding Wizard Component */}
      <DeliveryOnboardingWizard />
    </div>
  );
}
