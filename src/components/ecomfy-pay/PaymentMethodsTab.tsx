import React from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PaymentMethodLogo } from "./PaymentMethodLogo";
import { ShieldCheck, CheckCircle2 } from "lucide-react";

export const PaymentMethodsTab: React.FC = () => {
  const methods = [
    {
      id: "wave",
      name: "Wave Mobile Money",
      country: "Côte d'Ivoire, Sénégal",
      status: "ACTIVE",
      fee: "1.0%",
      description: "Paiement instantané sans frais client via scan QR ou application Wave.",
    },
    {
      id: "orange_money",
      name: "Orange Money",
      country: "Côte d'Ivoire, Sénégal, Mali, Burkina Faso",
      status: "ACTIVE",
      fee: "2.0%",
      description: "Passerelle officielle Orange Money avec validation OTP SMS.",
    },
    {
      id: "mtn_momo",
      name: "MTN Mobile Money (MoMo)",
      country: "Côte d'Ivoire, Bénin, Ghana",
      status: "ACTIVE",
      fee: "2.0%",
      description: "Paiement direct via push USSD / MoMo API officielle.",
    },
    {
      id: "moov_money",
      name: "Moov Money (Flooz)",
      country: "Côte d'Ivoire, Togo, Bénin",
      status: "ACTIVE",
      fee: "2.0%",
      description: "Règlement sécurisé Moov Africa / Flooz.",
    },
    {
      id: "card",
      name: "Cartes Bancaires (Visa & Mastercard)",
      country: "International",
      status: "ACTIVE",
      fee: "3.2%",
      description: "Acceptation globale des cartes de débit/crédit (3D Secure).",
    },
    {
      id: "djamo",
      name: "Djamo Pay",
      country: "Côte d'Ivoire, Sénégal",
      status: "ACTIVE",
      fee: "1.5%",
      description: "Transfert direct et paiement via l'application Djamo.",
    },
    {
      id: "cinetpay",
      name: "CinetPay Aggregator",
      country: "Afrique de l'Ouest & Centrale",
      status: "ACTIVE",
      fee: "2.0%",
      description: "Agrégateur multi-pays pour guichet de paiement unique.",
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-slate-900 text-base">
              Moyens de Paiement Officiels Ecomfy Pay
            </h4>
            <Badge className="bg-[#0E7C66]/10 text-[#0E7C66] border-0 text-[10px] font-extrabold">
              Intégration API Directe
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Chaque moyen de paiement configuré s'affiche automatiquement sur vos fiches produits et vos Payment Links Ecomfy Pay.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-bold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 shrink-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>7/7 Passerelles Actives</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {methods.map((m) => (
          <div
            key={m.id}
            className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-start justify-between gap-4 hover:border-slate-300 transition-all"
          >
            <div className="flex items-start gap-3.5">
              <PaymentMethodLogo id={m.id} size={48} />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h5 className="font-bold text-slate-900 text-sm">{m.name}</h5>
                  <Badge className="bg-emerald-100 text-emerald-800 text-[10px] border-0 font-bold px-2 py-0.5">
                    Actif
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 leading-snug">{m.description}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-slate-400">
                  <span>Zone : <strong className="text-slate-700">{m.country}</strong></span>
                  <span>Frais : <strong className="text-[#0E7C66] font-bold">{m.fee}</strong></span>
                </div>
              </div>
            </div>

            <Switch checked={true} disabled className="mt-1 shrink-0 data-[state=checked]:bg-[#0E7C66]" />
          </div>
        ))}
      </div>
    </div>
  );
};
