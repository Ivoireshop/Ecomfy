import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, MapPin, Phone, User, PackageOpen, CheckCircle, Navigation, XCircle, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SignaturePad } from "@/components/driver/SignaturePad";
import { fetchMyDeliveryMissions } from "@/lib/driverMissions";
import { uploadDeliveryProof } from "@/lib/deliveryRpc";

// Motifs proposés au livreur ; « Autre » demande un texte libre. Le serveur exige un motif non vide.
const FAILURE_REASONS = [
  "Client injoignable",
  "Client absent",
  "Adresse introuvable",
  "Colis refusé par le client",
  "Autre",
];

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "À récupérer", className: "bg-orange-100 text-orange-700" },
  picked_up: { label: "En route", className: "bg-blue-100 text-blue-700" },
  in_transit: { label: "En route", className: "bg-blue-100 text-blue-700" },
  delivered: { label: "Livré", className: "bg-green-100 text-green-700" },
  failed: { label: "Échoué", className: "bg-red-100 text-red-700" },
  returned: { label: "Retourné à la boutique", className: "bg-slate-100 text-slate-700" },
};

export default function DriverMission() {
  const { deliveryId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSignatureOpen, setIsSignatureOpen] = useState(false);
  const [isFailureOpen, setIsFailureOpen] = useState(false);
  const [failureChoice, setFailureChoice] = useState<string>("");
  const [failureOther, setFailureOther] = useState("");

  // Lecture par la fonction serveur : le livreur n'a pas accès direct à `orders`, et ne reçoit que SA course.
  const { data: delivery, isLoading } = useQuery({
    queryKey: ["driver-delivery", deliveryId],
    queryFn: async () => (await fetchMyDeliveryMissions(deliveryId!, null))[0] ?? null,
    enabled: !!deliveryId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (update: { status: string; signatureUrl?: string; failureReason?: string }) => {
      // Les horodatages (départ, livraison) sont posés par le serveur ; le client n'envoie que le statut, la preuve et le motif.
      const updateData: { status: string; pod_signature_url?: string; failure_reason?: string } = { status: update.status };
      // La signature va dans le stockage privé ; seule la référence est enregistrée sur la livraison.
      if (update.signatureUrl) updateData.pod_signature_url = await uploadDeliveryProof(deliveryId!, update.signatureUrl);
      if (update.failureReason) updateData.failure_reason = update.failureReason;

      // `.select()` : une mise à jour filtrée par la sécurité ne renvoie aucune erreur mais 0 ligne.
      const { data, error } = await supabase
        .from("order_deliveries")
        .update(updateData)
        .eq("id", deliveryId!)
        .select("id");

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Cette course ne peut plus être modifiée (elle n'est plus assignée à vous ou a changé).");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-delivery", deliveryId] });
      queryClient.invalidateQueries({ queryKey: ["driver-active-deliveries"] });
      toast.success("Statut mis à jour");
    },
    onError: (error: Error) => {
      toast.error("Erreur lors de la mise à jour : " + error.message);
      // La course a peut-être changé (annulation, réassignation) : on recharge l'état réel.
      queryClient.invalidateQueries({ queryKey: ["driver-delivery", deliveryId] });
      queryClient.invalidateQueries({ queryKey: ["driver-active-deliveries"] });
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[80vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="p-4 text-center mt-20">
        <h2 className="text-xl font-bold text-slate-800">Livraison introuvable</h2>
        <Button onClick={() => navigate("/delivery/driver")} className="mt-4">
          Retour aux missions
        </Button>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[delivery.status] ?? { label: delivery.status, className: "bg-slate-100 text-slate-700" };
  const canStart = delivery.status === "pending";
  const canFinish = delivery.status === "in_transit" || delivery.status === "picked_up";
  const canFail = canStart || canFinish;
  const toCollect = Number(delivery.amount_to_collect) || 0;

  const handleStartTransit = () => {
    updateStatusMutation.mutate({ status: "in_transit" });
  };

  const handleSaveSignature = (dataUrl: string) => {
    updateStatusMutation.mutate({ status: "delivered", signatureUrl: dataUrl }, {
      onSuccess: () => {
        // Rediriger vers l'accueil après un petit délai
        setTimeout(() => navigate("/delivery/driver"), 1500);
      }
    });
  };

  const failureReason = failureChoice === "Autre" ? failureOther.trim() : failureChoice;

  const handleConfirmFailure = () => {
    if (!failureReason) {
      toast.error("Indiquez le motif de l'échec.");
      return;
    }
    updateStatusMutation.mutate({ status: "failed", failureReason }, {
      onSuccess: () => {
        setIsFailureOpen(false);
        setTimeout(() => navigate("/delivery/driver"), 1500);
      }
    });
  };

  return (
    <div className="bg-slate-50 min-h-full pb-6">
      {/* Top Navigation */}
      <div className="bg-white px-4 py-3 shadow-sm sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => navigate("/delivery/driver")} className="p-2 -ml-2 rounded-full hover:bg-slate-100">
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </button>
        <h1 className="font-bold text-slate-800 text-lg">Détails de la course</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Status Card */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <span className="text-slate-500 font-medium">Statut</span>
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${statusInfo.className}`}>
            {statusInfo.label}
          </span>
        </div>

        {delivery.status === "failed" && delivery.failure_reason && (
          <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-4 text-sm flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>Motif : {delivery.failure_reason}</span>
          </div>
        )}

        {/* Customer Details */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 space-y-4">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Client
          </h2>

          <div className="pl-7 space-y-3">
            <p className="font-semibold text-slate-700">{delivery.customer_name}</p>

            <div className="flex items-start gap-3 text-slate-600">
              <MapPin className="w-5 h-5 shrink-0 mt-0.5 text-slate-400" />
              <span>
                {delivery.customer_address}
                <br />
                {delivery.customer_city}
              </span>
            </div>

            <div className="flex items-center gap-3 text-slate-600">
              <Phone className="w-5 h-5 shrink-0 text-slate-400" />
              <span>{delivery.customer_phone}</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => window.open(`tel:${delivery.customer_phone}`, '_system')}
            >
              Appeler
            </Button>
            <Button
              variant="outline"
              className="flex-1 rounded-xl bg-[#25D366] text-white hover:bg-[#128C7E] hover:text-white border-0"
              onClick={() => window.open(`https://wa.me/${delivery.customer_phone?.replace(/[^0-9]/g, '')}`, '_system')}
            >
              WhatsApp
            </Button>
          </div>
        </div>

        {/* Package & Payment Details */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
          <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
            <PackageOpen className="w-5 h-5 text-primary" />
            Colis & Paiement
          </h2>

          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-500">Commande</span>
            <span className="font-mono text-xs text-slate-700">
              {delivery.order_number || delivery.order_id?.substring(0, 8).toUpperCase()}
            </span>
          </div>

          <div className="flex justify-between items-center py-3">
            <span className="text-slate-700 font-medium">À encaisser</span>
            {toCollect > 0 ? (
              <span className="text-xl font-bold text-slate-900">
                {toCollect.toLocaleString("fr-FR")} FCFA
              </span>
            ) : (
              <span className="text-sm font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-full">
                Déjà payé · rien à encaisser
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 pb-20 space-y-3">
          {canStart && (
            <Button
              onClick={handleStartTransit}
              disabled={updateStatusMutation.isPending}
              className="w-full h-14 rounded-xl text-lg font-semibold bg-blue-600 hover:bg-blue-700"
            >
              <Navigation className="w-5 h-5 mr-2" />
              Démarrer la course
            </Button>
          )}

          {canFinish && (
            <Button
              onClick={() => setIsSignatureOpen(true)}
              disabled={updateStatusMutation.isPending}
              className="w-full h-14 rounded-xl text-lg font-semibold bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Marquer comme Livré
            </Button>
          )}

          {canFail && (
            <Button
              variant="outline"
              onClick={() => setIsFailureOpen(true)}
              disabled={updateStatusMutation.isPending}
              className="w-full h-12 rounded-xl text-base font-semibold border-red-200 text-red-700 hover:bg-red-50"
            >
              <XCircle className="w-5 h-5 mr-2" />
              Échec de livraison
            </Button>
          )}
        </div>
      </div>

      <SignaturePad
        open={isSignatureOpen}
        onOpenChange={setIsSignatureOpen}
        onSave={handleSaveSignature}
      />

      <Dialog open={isFailureOpen} onOpenChange={setIsFailureOpen}>
        <DialogContent className="sm:max-w-[425px] w-[95vw] rounded-xl p-4">
          <DialogHeader>
            <DialogTitle>Échec de livraison</DialogTitle>
            <DialogDescription>
              Choisissez le motif. La boutique et le prestataire en seront informés et pourront relancer la livraison.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 my-2">
            {FAILURE_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => setFailureChoice(reason)}
                className={`w-full text-left px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                  failureChoice === reason
                    ? "border-red-400 bg-red-50 text-red-700"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {reason}
              </button>
            ))}
            {failureChoice === "Autre" && (
              <Textarea
                value={failureOther}
                onChange={(e) => setFailureOther(e.target.value)}
                placeholder="Précisez le motif"
                maxLength={300}
              />
            )}
          </div>
          <div className="flex justify-between gap-3">
            <Button variant="outline" onClick={() => setIsFailureOpen(false)} className="w-1/3">
              Annuler
            </Button>
            <Button
              onClick={handleConfirmFailure}
              disabled={!failureReason || updateStatusMutation.isPending}
              className="w-2/3 bg-red-600 hover:bg-red-700"
            >
              Confirmer l'échec
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
