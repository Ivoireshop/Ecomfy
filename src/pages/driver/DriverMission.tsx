import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Phone, User, PackageOpen, CheckCircle, Navigation } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SignaturePad } from "@/components/driver/SignaturePad";

export default function DriverMission() {
  const { deliveryId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSignatureOpen, setIsSignatureOpen] = useState(false);

  const { data: delivery, isLoading } = useQuery({
    queryKey: ["driver-delivery", deliveryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_deliveries")
        .select(`
          *,
          orders (
            id,
            total_amount,
            customer_name,
            customer_phone,
            customer_address,
            customer_city
          )
        `)
        .eq("id", deliveryId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!deliveryId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, signatureUrl }: { status: string; signatureUrl?: string }) => {
      const updateData: any = { status };
      
      if (status === "in_transit") {
        updateData.picked_up_at = new Date().toISOString();
      } else if (status === "delivered") {
        updateData.delivered_at = new Date().toISOString();
        if (signatureUrl) {
          updateData.pod_signature_url = signatureUrl;
        }
      }

      const { error } = await supabase
        .from("order_deliveries")
        .update(updateData)
        .eq("id", deliveryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-delivery", deliveryId] });
      queryClient.invalidateQueries({ queryKey: ["driver-active-deliveries"] });
      toast.success("Statut mis à jour");
    },
    onError: (error) => {
      toast.error("Erreur lors de la mise à jour : " + error.message);
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

  const orderData = Array.isArray(delivery.orders) ? delivery.orders[0] : delivery.orders;

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
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${
            delivery.status === "pending" ? "bg-orange-100 text-orange-700" :
            delivery.status === "in_transit" ? "bg-blue-100 text-blue-700" :
            delivery.status === "delivered" ? "bg-green-100 text-green-700" :
            "bg-red-100 text-red-700"
          }`}>
            {delivery.status === "pending" ? "À récupérer" :
             delivery.status === "in_transit" ? "En route" :
             delivery.status === "delivered" ? "Livré" : "Échoué"}
          </span>
        </div>

        {/* Customer Details */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 space-y-4">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Client
          </h2>
          
          <div className="pl-7 space-y-3">
            <p className="font-semibold text-slate-700">{orderData?.customer_name}</p>
            
            <div className="flex items-start gap-3 text-slate-600">
              <MapPin className="w-5 h-5 shrink-0 mt-0.5 text-slate-400" />
              <span>
                {orderData?.customer_address}
                <br />
                {orderData?.customer_city}
              </span>
            </div>

            <div className="flex items-center gap-3 text-slate-600">
              <Phone className="w-5 h-5 shrink-0 text-slate-400" />
              <span>{orderData?.customer_phone}</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              className="flex-1 rounded-xl"
              onClick={() => window.open(`tel:${orderData?.customer_phone}`, '_system')}
            >
              Appeler
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 rounded-xl bg-[#25D366] text-white hover:bg-[#128C7E] hover:text-white border-0"
              onClick={() => window.open(`https://wa.me/${orderData?.customer_phone?.replace(/[^0-9]/g, '')}`, '_system')}
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
            <span className="text-slate-500">ID Commande</span>
            <span className="font-mono text-xs text-slate-700">{orderData?.id?.substring(0, 8).toUpperCase()}</span>
          </div>
          
          <div className="flex justify-between items-center py-3">
            <span className="text-slate-700 font-medium">À encaisser</span>
            <span className="text-xl font-bold text-slate-900">
              {orderData?.total_amount?.toLocaleString("fr-FR")} FCFA
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 pb-20">
          {delivery.status === "pending" && (
            <Button 
              onClick={handleStartTransit}
              disabled={updateStatusMutation.isPending}
              className="w-full h-14 rounded-xl text-lg font-semibold bg-blue-600 hover:bg-blue-700"
            >
              <Navigation className="w-5 h-5 mr-2" />
              Démarrer la course
            </Button>
          )}

          {delivery.status === "in_transit" && (
            <Button 
              onClick={() => setIsSignatureOpen(true)}
              disabled={updateStatusMutation.isPending}
              className="w-full h-14 rounded-xl text-lg font-semibold bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Marquer comme Livré
            </Button>
          )}
        </div>
      </div>

      <SignaturePad 
        open={isSignatureOpen} 
        onOpenChange={setIsSignatureOpen}
        onSave={handleSaveSignature}
      />
    </div>
  );
}
