import React, { useState } from "react";
import { 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ShieldCheck, 
  FileText, 
  Upload, 
  ArrowRight,
  ExternalLink,
  MessageSquare,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { deliveryService } from "@/lib/deliveryService";
import { DeliveryDispatch, DeliveryCashTransfer } from "@/types/delivery";

interface DeliveryCashTrackerProps {
  dispatch: DeliveryDispatch;
  userRole: 'seller' | 'partner' | 'admin';
  onUpdate?: () => void;
}

export default function DeliveryCashTracker({
  dispatch,
  userRole,
  onUpdate
}: DeliveryCashTrackerProps) {
  const { toast } = useToast();
  const cash = dispatch.cash_transfer;
  
  // Deposit Submission Dialog (For Delivery Company)
  const [isDepositModalOpen, setIsDepositModalOpen] = useState<boolean>(false);
  const [depositProofUrl, setDepositProofUrl] = useState<string>("");
  const [depositMethod, setDepositMethod] = useState<string>("Wave");
  const [transactionRef, setTransactionRef] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Dispute Dialog (For Seller)
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState<boolean>(false);
  const [disputeReason, setDisputeReason] = useState<string>("");

  const handleDepositSubmit = async () => {
    if (!depositProofUrl && !transactionRef) {
      toast({ variant: "destructive", title: "Preuve requise", description: "Veuillez charger une preuve de versement ou saisir la référence." });
      return;
    }

    setSubmitting(true);
    try {
      await deliveryService.submitDepositProof(
        dispatch.id,
        depositProofUrl,
        depositMethod,
        transactionRef
      );

      toast({
        title: "Preuve de dépôt transmise au vendeur !",
        description: "Le vendeur a été notifié pour valider la bonne réception du paiement.",
      });

      setIsDepositModalOpen(false);
      if (onUpdate) onUpdate();
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmSeller = async () => {
    setSubmitting(true);
    try {
      await deliveryService.confirmSellerDeposit(dispatch.id);
      toast({
        title: "Dépôt confirmé !",
        description: "Le cycle de paiement pour cette commande est maintenant clôturé avec succès.",
      });
      if (onUpdate) onUpdate();
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRaiseDispute = async () => {
    if (!disputeReason.trim()) {
      toast({ variant: "destructive", title: "Motif requis", description: "Veuillez expliquer la raison du signalement." });
      return;
    }

    setSubmitting(true);
    try {
      await deliveryService.raiseCashDispute(dispatch.id, disputeReason);
      toast({
        title: "Signalement transmis à la Fondation Ecomfy",
        description: "Notre équipe intervient immédiatement auprès de la structure de livraison.",
      });
      setIsDisputeModalOpen(false);
      if (onUpdate) onUpdate();
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const isConfirmed = cash?.status === 'confirmed_by_seller';
  const isTransferSent = cash?.status === 'transfer_initiated_to_seller';
  const isDisputed = cash?.dispute_raised || cash?.status === 'disputed';

  return (
    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-400" />
          <h4 className="text-sm font-bold text-white">Suivi Transparence du Cycle d'Argent (COD)</h4>
        </div>
        <Badge
          className={`text-[11px] ${
            isConfirmed
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
              : isDisputed
              ? "bg-red-500/20 text-red-300 border-red-500/40 animate-pulse"
              : isTransferSent
              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
              : "bg-slate-800 text-slate-400"
          }`}
        >
          {isConfirmed && "Paiement Reçu & Confirmé"}
          {isDisputed && "Signalement Litige Fondation"}
          {isTransferSent && "Preuve de Dépôt Soumise"}
          {!isConfirmed && !isDisputed && !isTransferSent && "En cours d'encaissement"}
        </Badge>
      </div>

      {/* Amounts Summary */}
      <div className="grid grid-cols-3 gap-2 text-xs bg-slate-950 p-3 rounded-lg border border-slate-800">
        <div>
          <span className="text-slate-500 block text-[10px]">MONTANT ENCAISSÉ</span>
          <span className="font-bold text-white">{dispatch.cod_amount?.toLocaleString()} {dispatch.currency}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">FRAIS LIVRAISON</span>
          <span className="font-semibold text-slate-300">-{dispatch.delivery_fee?.toLocaleString()} {dispatch.currency}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">NET DU VENDEUR</span>
          <span className="font-extrabold text-emerald-400">
            {(dispatch.cod_amount - dispatch.delivery_fee)?.toLocaleString()} {dispatch.currency}
          </span>
        </div>
      </div>

      {/* Cycle Progress Tracker */}
      <div className="grid grid-cols-4 gap-2 relative text-center">
        {[
          { step: 1, label: "Encaissé au Client", done: true },
          { step: 2, label: "Reçu en Entrepôt", done: cash?.status !== 'pending_collection' },
          { step: 3, label: "Dépôt Initié", done: isTransferSent || isConfirmed },
          { step: 4, label: "Validé Vendeur", done: isConfirmed },
        ].map((s) => (
          <div
            key={s.step}
            className={`p-2 rounded-lg border text-[11px] font-medium transition-all ${
              s.done
                ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300"
                : "bg-slate-950 border-slate-800 text-slate-600"
            }`}
          >
            <div className="flex items-center justify-center mb-1">
              {s.done ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Clock className="w-4 h-4 text-slate-600" />}
            </div>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Proof of Deposit Viewer if available */}
      {cash?.deposit_proof_url && (
        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <div>
              <span className="text-slate-200 font-medium">Preuve de versement ({cash.deposit_method || 'Mobile Money'})</span>
              {cash.transaction_reference && (
                <span className="block text-[10px] font-mono text-slate-400">Réf : {cash.transaction_reference}</span>
              )}
            </div>
          </div>
          <a
            href={cash.deposit_proof_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:underline text-xs flex items-center gap-1"
          >
            Voir la pièce <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Action Buttons Depending on User Role */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
        {/* Partner Action: Upload Deposit Proof */}
        {userRole === 'partner' && !isConfirmed && (
          <Button
            onClick={() => setIsDepositModalOpen(true)}
            size="sm"
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" /> Soumettre Preuve de Dépôt Vendeur
          </Button>
        )}

        {/* Seller Action: Confirm Deposit or Raise Dispute */}
        {userRole === 'seller' && (
          <div className="flex items-center gap-2 w-full justify-end">
            {!isConfirmed && (
              <Button
                variant="outline"
                onClick={() => setIsDisputeModalOpen(true)}
                size="sm"
                className="border-red-500/40 text-red-400 hover:bg-red-950 text-xs"
              >
                <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Signaler Retard / Litige
              </Button>
            )}

            {isTransferSent && !isConfirmed && (
              <Button
                onClick={handleConfirmSeller}
                disabled={submitting}
                size="sm"
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Confirmer Réception du Dépôt
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Deposit Submission Modal */}
      <Dialog open={isDepositModalOpen} onOpenChange={setIsDepositModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Upload className="w-4 h-4 text-emerald-400" /> Preuve de Dépôt / Reversement Vendeur
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-slate-300">Moyen de transfert</Label>
              <select
                value={depositMethod}
                onChange={(e) => setDepositMethod(e.target.value)}
                className="w-full h-9 rounded bg-slate-950 border border-slate-800 text-white text-xs px-2"
              >
                <option value="Wave">Wave</option>
                <option value="Orange Money">Orange Money</option>
                <option value="MTN MoMo">MTN Mobile Money</option>
                <option value="Espèces">Dépôt Espèces en Main</option>
                <option value="Virement">Virement BTP / Banque</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-slate-300">Référence de Transaction ou ID Reçu</Label>
              <Input
                placeholder="Ex: WVE-901823901"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs text-white"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-slate-300">Capture d'écran de la Preuve (URL ou Fichier)</Label>
              <Input
                placeholder="Lien ou image de confirmation"
                value={depositProofUrl}
                onChange={(e) => setDepositProofUrl(e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs text-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleDepositSubmit}
              disabled={submitting}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs"
            >
              Envoyer la Preuve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute Modal */}
      <Dialog open={isDisputeModalOpen} onOpenChange={setIsDisputeModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-4 h-4" /> Signaler un Litige à la Fondation Ecomfy
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="text-slate-400">
              La fondation Ecomfy interviendra immédiatement auprès de la structure de livraison certifiée pour débloquer le reversement.
            </p>
            <div className="space-y-1">
              <Label className="text-slate-300">Raison du signalement *</Label>
              <Input
                placeholder="Ex: Colis livré depuis 72h mais le dépôt n'a pas été effectué."
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs text-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleRaiseDispute}
              disabled={submitting}
              className="bg-red-500 hover:bg-red-600 text-white font-bold text-xs"
            >
              Transmettre le Signalement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
