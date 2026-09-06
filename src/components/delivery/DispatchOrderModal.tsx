import React, { useEffect, useState } from "react";
import { 
  Truck, 
  ShieldCheck, 
  MapPin, 
  CheckCircle2, 
  Sparkles, 
  Star, 
  Building2, 
  Send,
  AlertCircle,
  Phone,
  Camera,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { deliveryService } from "@/lib/deliveryService";
import { DeliveryCompany } from "@/types/delivery";

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
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [companies, setCompanies] = useState<DeliveryCompany[]>([]);
  
  // 2-3 Clicks UX State
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [deliveryFee, setDeliveryFee] = useState<number>(1500); // Default XOF fee
  const [deliveryNote, setDeliveryNote] = useState<string>("");
  const [customerParcelPhotoUrl, setCustomerParcelPhotoUrl] = useState<string>("");

  useEffect(() => {
    if (isOpen && order) {
      loadCompanies();
    }
  }, [isOpen, order]);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      // Auto-match system: fetch verified partners covering the customer's city
      const list = await deliveryService.getVerifiedCompaniesForCity(order.city);
      setCompanies(list);

      // Auto-select the top matched company (Click 1 pre-selected!)
      if (list.length > 0) {
        setSelectedCompanyId(list[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDispatch = async () => {
    if (!selectedCompanyId) {
      toast({ variant: "destructive", title: "Sélection requise", description: "Veuillez choisir une structure de livraison." });
      return;
    }

    setSubmitting(true);
    try {
      await deliveryService.createDispatch({
        order_id: order.id,
        shop_id: order.shop_id,
        company_id: selectedCompanyId,
        delivery_address: order.delivery_address,
        recipient_name: order.customer_name,
        recipient_phone: order.customer_phone,
        city: order.city || "Abidjan",
        cod_amount: order.total_amount,
        delivery_fee: deliveryFee,
        delivery_note: deliveryNote,
        customer_parcel_photo_url: customerParcelPhotoUrl,
      });

      toast({
        title: "Commande transmise au livreur !",
        description: "Le partenaire de livraison et son livreur ont été notifiés instantanément sur la plateforme Ecomfy.",
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

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);

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
              <span className="text-slate-500 block text-[10px]">MATCHING AUTO</span>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] mt-0.5">
                <Sparkles className="w-3 h-3 mr-1" /> Recommandé
              </Badge>
            </div>
          </div>

          {/* CLIC 1: Select / Validate Delivery Partner */}
          <div className="space-y-2">
            <Label className="text-slate-200 text-xs font-bold flex items-center justify-between">
              <span>Clic 1 : Sélectionner la Structure Partenaire Vérifiée</span>
              <span className="text-[11px] text-emerald-400 font-normal">
                {companies.length} structures disponibles à {order.city}
              </span>
            </Label>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Recherche des meilleures structures de livraison...
              </div>
            ) : companies.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-amber-400 text-center">
                Aucune structure certifiée ne couvre directement {order.city} pour l'instant.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {companies.map((company, index) => {
                  const isSelected = company.id === selectedCompanyId;
                  const coversCity = company.covered_cities?.some(
                    (c) => c.toLowerCase().includes((order.city || "").toLowerCase())
                  );

                  return (
                    <div
                      key={company.id}
                      onClick={() => setSelectedCompanyId(company.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? "bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-950"
                          : "bg-slate-950 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold ${
                            isSelected
                              ? "bg-emerald-500 border-emerald-400 text-slate-950"
                              : "border-slate-700 text-transparent"
                          }`}
                        >
                          ✓
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{company.company_name}</span>
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] py-0">
                              <ShieldCheck className="w-3 h-3 mr-0.5" /> Partenaire Vérifié
                            </Badge>
                            {index === 0 && (
                              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-semibold">
                                Top Choix
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                            <span>{company.total_drivers_count || 1} livreurs</span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-amber-400">
                              <Star className="w-3 h-3 fill-amber-400" /> {company.rating_score || 5.0} ({company.reviews_count || 0} avis)
                            </span>
                            <span>•</span>
                            <span>Délai moyen dépôt : {company.average_payout_delay_hours || 24}h</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-mono text-emerald-400">{company.manager_phone}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
