import React, { useState } from "react";
import { Wallet } from "@/types/ecomfyPay";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ecomfyPayApi } from "@/lib/ecomfyPay";
import { PaymentMethodLogo } from "./PaymentMethodLogo";
import { Settings, ShieldCheck, Smartphone, CheckCircle2 } from "lucide-react";

interface SettingsTabProps {
  wallet?: Wallet | null;
  onRefresh?: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ wallet, onRefresh }) => {
  const [payoutPhone, setPayoutPhone] = useState(wallet?.default_payout_phone || "");
  const [payoutName, setPayoutName] = useState(wallet?.default_payout_name || "");
  const [payoutProvider, setPayoutProvider] = useState(wallet?.default_payout_provider || "wave");
  const [saving, setSaving] = useState(false);

  const handleSavePayoutConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutPhone) {
      toast({ title: "Numéro manquant", description: "Entrez votre numéro de retrait.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const res = await ecomfyPayApi.savePayoutConfig({
      payout_phone: payoutPhone,
      payout_name: payoutName,
      payout_provider: payoutProvider,
    });
    setSaving(false);

    if (res.success) {
      toast({ title: "Numéro de retrait enregistré ✓", description: "Ce numéro sera prérempli pour vos retraits." });
      onRefresh?.();
    } else {
      toast({ title: "Erreur", description: res.error || "Impossible d'enregistrer.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Numéro de Retrait par Défaut (Demande Utilisateur) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2.5 bg-[#0E7C66]/10 text-[#0E7C66] rounded-xl">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-base">
              Configuration du Numéro de Retrait par Défaut
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Enregistrez le numéro Mobile Money sur lequel vous souhaitez recevoir vos transferts lors des demandes de retrait.
            </p>
          </div>
        </div>

        <form onSubmit={handleSavePayoutConfig} className="space-y-5 text-xs font-medium">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold text-slate-700">Réseau / Opérateur Mobile Money</Label>
              <div className="flex items-center gap-2 mt-1.5">
                <PaymentMethodLogo id={payoutProvider} size={38} />
                <Select value={payoutProvider} onValueChange={setPayoutProvider}>
                  <SelectTrigger className="font-bold h-10 flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wave">Wave Mobile Money</SelectItem>
                    <SelectItem value="orange">Orange Money</SelectItem>
                    <SelectItem value="mtn">MTN Mobile Money (MoMo)</SelectItem>
                    <SelectItem value="moov">Moov Money (Flooz)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Numéro de téléphone de retrait</Label>
              <Input
                required
                value={payoutPhone}
                onChange={(e) => setPayoutPhone(e.target.value)}
                placeholder="Ex: 0700000000"
                className="mt-1.5 font-bold text-sm h-10"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold text-slate-700">Nom et Prénoms du titulaire de la ligne</Label>
            <Input
              required
              value={payoutName}
              onChange={(e) => setPayoutName(e.target.value)}
              placeholder="Ex: KOUASSI Koffi Jean"
              className="mt-1.5 font-bold h-10"
            />
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="bg-[#0E7C66] hover:bg-[#0A5C4C] text-white font-extrabold rounded-xl h-11 text-xs px-6 shadow-md gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            {saving ? "Enregistrement..." : "Enregistrer mon numéro de retrait"}
          </Button>
        </form>
      </div>

      {/* Préférences Générales */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="border-b border-slate-100 pb-3">
          <h4 className="font-bold text-slate-900 text-base">
            Préférences de Sécurité &amp; Notifications
          </h4>
        </div>

        <div className="space-y-4 text-xs font-medium">
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <div>
              <Label className="text-xs font-bold text-slate-800">
                Notifications e-mail transactionnelles
              </Label>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Recevez une alerte mail immédiate à chaque paiement client réussi.
              </p>
            </div>
            <Switch defaultChecked className="data-[state=checked]:bg-[#0E7C66]" />
          </div>

          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <div>
              <Label className="text-xs font-bold text-slate-800">
                Délai de règlement automatisé
              </Label>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Transfert automatique du solde en attente vers le solde disponible (72h par défaut).
              </p>
            </div>
            <Input readOnly value="72 Heures" className="w-28 text-center h-8 font-bold bg-slate-50 text-slate-700" />
          </div>

          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <div>
              <Label className="text-xs font-bold text-slate-800">
                Devise de stockage Wallet
              </Label>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Devise principale pour la comptabilité et les retraits.
              </p>
            </div>
            <Input readOnly value="XOF (FCFA)" className="w-32 text-center h-8 font-extrabold bg-slate-50 text-[#0E7C66]" />
          </div>
        </div>
      </div>
    </div>
  );
};
