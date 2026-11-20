import React, { useEffect, useState } from "react";
import { Truck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { deliveryService } from "@/lib/deliveryService";
import DeliveryDirectoryBrowser from "./DeliveryDirectoryBrowser";

interface DispatchOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
    id: string;
    shop_id: string;
    customer_name: string;
    customer_phone: string;
    delivery_address: string;
    city: string;
    total_amount: number;
    currency?: string;
  };
  onSuccess?: () => void;
}

export default function DispatchOrderModal({
  isOpen,
  onClose,
  order,
  onSuccess
}: DispatchOrderModalProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState<boolean>(false);
  
  // 2-3 Clicks UX State
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [deliveryFee, setDeliveryFee] = useState<number>(1500); // Default XOF fee
  const [deliveryNote, setDeliveryNote] = useState<string>("");
  const [customerParcelPhotoUrl, setCustomerParcelPhotoUrl] = useState<string>("");

  const handleDispatch = async () => {
    if (!selectedCompanyId) {
      toast({ variant: "destructive", title: "Sélection requise", description: "Veuillez choisir une structure de livraison." });
      return;
    }

    setSubmitting(true);
    try {
      await deliveryService.createDispatch({
        order_id: order.id,
        company_id: selectedCompanyId,
        delivery_fee: deliveryFee,
        delivery_note: deliveryNote,
        customer_parcel_photo_url: customerParcelPhotoUrl,
      });

      toast({
        title: "Commande transmise à la structure",
        description: "La structure est notifiée. Vous serez prévenu dès qu'elle accepte ou refuse la commande.",
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Erreur d'envoi", description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-slate-900 border-slate-800 text-slate-100 p-6">
        <DialogHeader className="border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-white">
                Envoyer à un Livreur Partenaire
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Transmission ultra-rapide en 2-3 clics vers une structure vérifiée Ecomfy.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-4">
          {/* Order Summary & Customer Info */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px]">CLIENT</span>
              <span className="font-semibold text-white truncate block">{order.customer_name}</span>
              <span className="text-[11px] text-emerald-400">{order.customer_phone}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">DESTINATION</span>
              <span className="font-semibold text-white truncate block">{order.city}</span>
              <span className="text-[11px] text-slate-400 truncate block">{order.delivery_address}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">ENCAISSEMENT COD</span>
              <span className="font-extrabold text-emerald-400 text-sm block">
                {order.total_amount?.toLocaleString()} {order.currency || 'XOF'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">STRUCTURE CHOISIE</span>
              <span className={`font-semibold text-xs block mt-0.5 ${selectedCompanyId ? "text-emerald-400" : "text-amber-400"}`}>
                {selectedCompanyId ? "Oui ✓" : "Aucune pour l'instant"}
              </span>
            </div>
          </div>

          {/* CLIC 1: Select / Validate Delivery Partner */}
          <div className="space-y-2">
            <Label className="text-slate-200 text-xs font-bold flex items-center justify-between">
              <span>Clic 1 : Rechercher et choisir une structure de livraison vérifiée</span>
            </Label>

            <DeliveryDirectoryBrowser
              suggestedCity={order.city}
              selectedId={selectedCompanyId}
              onChoose={(card) => setSelectedCompanyId(card.id)}
              chooseLabel="Choisir"
              listClassName="max-h-64 overflow-y-auto pr-1"
            />
          </div>

          {/* CLIC 3 (Optionnel): Notes ou Photo Colis */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
            <div className="space-y-1">
              <Label className="text-xs text-slate-300">Frais de Livraison (XOF)</Label>
              <Input
                type="number"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(Number(e.target.value))}
                className="bg-slate-950 border-slate-800 text-xs text-white"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-slate-300">Note au livreur (Optionnel)</Label>
              <Input
                placeholder="Ex: Appeler avant d'arriver, colis fragile"
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs text-white"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between border-t border-slate-800 pt-4 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-slate-800 text-slate-400 hover:bg-slate-800 text-xs"
          >
            Annuler
          </Button>

          {/* CLIC 2: Confirm Dispatch Button */}
          <Button
            type="button"
            onClick={handleDispatch}
            disabled={submitting || !selectedCompanyId}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-950/50"
          >
            {submitting ? "Transmission en cours..." : "Clic 2 : Confirmer l'Envoi au Livreur"} <Send className="w-4 h-4 ml-2" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
