import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Wallet, MerchantKyc } from "@/types/ecomfyPay";
import { ecomfyPayApi } from "@/lib/ecomfyPay";
import { PaymentMethodLogo } from "./PaymentMethodLogo";
import { Smartphone, Building, ShieldCheck, AlertCircle } from "lucide-react";

interface WithdrawalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallet: Wallet | null;
  kyc: MerchantKyc | null;
  onSuccess: () => void;
  formatPrice: (amount: number) => string;
}

export const WithdrawalModal: React.FC<WithdrawalModalProps> = ({
  open,
  onOpenChange,
  wallet,
  kyc,
  onSuccess,
  formatPrice,
}) => {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"mobile_money" | "bank_transfer">("mobile_money");
  const [phone, setPhone] = useState(wallet?.default_payout_phone || kyc?.phone_number || "");
  const [recipientName, setRecipientName] = useState(wallet?.default_payout_name || kyc?.full_name || "");
  const [iban, setIban] = useState("");
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (open) {
      if (wallet?.default_payout_phone) setPhone(wallet.default_payout_phone);
      else if (kyc?.phone_number) setPhone(kyc.phone_number);

      if (wallet?.default_payout_name) setRecipientName(wallet.default_payout_name);
      else if (kyc?.full_name) setRecipientName(kyc.full_name);
    }
  }, [open, wallet, kyc]);

  const available = wallet?.available_balance || 0;
  const isKycVerified = kyc?.verification_status === "VERIFIED";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isKycVerified) {
      toast({
        title: "Vérification KYC requise",
        description: "Votre compte KYC doit être vérifié avant tout retrait.",
        variant: "destructive",
      });
      return;
    }

    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      toast({ title: "Montant invalide", description: "Entrez un montant valide.", variant: "destructive" });
      return;
    }

    if (num > available) {
      toast({ title: "Solde insuffisant", description: "Le montant dépasse votre solde disponible.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const res = await ecomfyPayApi.requestWithdrawal({
      amount: num,
      payout_method: method,
      destination_phone: method === "mobile_money" ? phone : undefined,
      destination_name: recipientName,
      destination_bank_iban: method === "bank_transfer" ? iban : undefined,
    });
    setSubmitting(false);

    if (res.success) {
      toast({
        title: "Retrait enregistré ✓",
        description: `Référence: ${res.withdrawal_reference}. Transfert en cours.`,
      });
      onOpenChange(false);
      setAmount("");
      onSuccess();
    } else {
      toast({
        title: "Échec de la demande",
        description: res.error || "Impossible d'effectuer le retrait.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">
            Retirer mes fonds (Ecomfy Wallet)
          </DialogTitle>
        </DialogHeader>

        {!isKycVerified ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 space-y-2 my-2">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>Vérification d'identité (KYC) requise</span>
            </div>
            <p>
              Pour la sécurité des transactions et la conformité financière, vous devez soumettre vos documents d'identité dans l'onglet KYC avant de pouvoir effectuer un retrait.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs font-medium pt-2">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center">
              <span className="text-slate-500 font-semibold">Solde disponible :</span>
              <span className="font-extrabold text-sm text-[#0E7C66]">
                {formatPrice(available)} FCFA
              </span>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Montant à retirer (FCFA)</Label>
              <Input
                required
                type="number"
                max={available}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ex: 50000"
                className="mt-1 font-bold text-base h-11"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Mode de paiement</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setMethod("mobile_money")}
                  className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 font-bold transition-all ${
                    method === "mobile_money"
                      ? "border-[#0E7C66] bg-[#0E7C66]/5 text-[#0E7C66]"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Mobile Money</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod("bank_transfer")}
                  className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 font-bold transition-all ${
                    method === "bank_transfer"
                      ? "border-[#0E7C66] bg-[#0E7C66]/5 text-[#0E7C66]"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  <Building className="w-4 h-4" />
                  <span>Banque</span>
                </button>
              </div>
            </div>

            {method === "mobile_money" ? (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Numéro Mobile Money de Retrait</Label>
                <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200 overflow-x-auto">
                  <PaymentMethodLogo id="wave" size={28} />
                  <PaymentMethodLogo id="orange" size={28} />
                  <PaymentMethodLogo id="mtn" size={28} />
                  <PaymentMethodLogo id="moov" size={28} />
                  <span className="text-[10px] text-slate-400 font-semibold ml-1">Wave, Orange, MTN, Moov</span>
                </div>
                <Input
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: 0700000000"
                  className="mt-1 font-bold text-sm h-10"
                />
              </div>
            ) : (
              <div>
                <Label className="text-xs font-semibold text-slate-700">IBAN / Compte Bancaire</Label>
                <Input
                  required
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  placeholder="RIB / IBAN..."
                  className="mt-1 font-semibold"
                />
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold text-slate-700">Nom du bénéficiaire</Label>
              <Input
                required
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Nom complet figurant sur le compte"
                className="mt-1"
              />
            </div>

            <Button
              type="submit"
              disabled={submitting || available <= 0}
              className="w-full bg-[#0E7C66] hover:bg-[#0A5C4C] text-white font-bold rounded-xl h-11 text-sm mt-2 shadow-md"
            >
              {submitting ? "Traitement sécurisé..." : "Confirmer la demande de retrait"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
