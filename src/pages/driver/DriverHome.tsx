import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyDeliveryMissions } from "@/lib/driverMissions";
import { useDeliveryEvents } from "@/hooks/useDeliveryEvents";
import { Package, MapPin, Phone, CheckCircle2, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function DriverHome() {
  const navigate = useNavigate();

  // Courses actives du livreur connecté. Les droits de lecture sur `orders` ne sont pas ouverts aux livreurs :
  // la fonction serveur ne renvoie que SES courses et les champs utiles (client, adresse, montant à encaisser).
  const { data: userId } = useQuery({
    queryKey: ["driver-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });

  const { data: deliveries, isLoading, refetch } = useQuery({
    queryKey: ["driver-active-deliveries"],
    queryFn: () => fetchMyDeliveryMissions(null, ["pending", "picked_up", "in_transit"]),
  });

  // Alerte en direct : nouvelle course assignée, course annulée par la boutique.
  useDeliveryEvents("driver_user_id", userId, "driver", () => { void refetch(); });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pendingCount = deliveries?.filter((d) => d.status === "pending").length || 0;
  const inTransitCount = deliveries?.filter((d) => d.status === "in_transit" || d.status === "picked_up").length || 0;

  return (
    <div className="p-4 space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
          <Clock className="w-8 h-8 text-orange-500 mb-2" />
          <p className="text-2xl font-bold text-slate-800">{pendingCount}</p>
          <p className="text-xs text-slate-500 font-medium">À récupérer</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
          <Package className="w-8 h-8 text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-slate-800">{inTransitCount}</p>
          <p className="text-xs text-slate-500 font-medium">En cours</p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="font-bold text-lg text-slate-800">Courses actuelles</h2>
        
        {deliveries?.length === 0 ? (
          <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-100 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-700">Aucune course assignée</h3>
            <p className="text-sm text-slate-500 mt-1">Vous êtes à jour pour le moment.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deliveries?.map((delivery) => {
              const enRoute = delivery.status === "in_transit" || delivery.status === "picked_up";
              return (
                <div
                  key={delivery.delivery_id}
                  onClick={() => navigate(`/delivery/driver/mission/${delivery.delivery_id}`)}
                  className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 active:scale-[0.98] transition-transform cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        enRoute ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                      }`}>
                        {enRoute ? "En route" : "À récupérer"}
                      </span>
                    </div>
                    <span className="font-bold text-slate-700">
                      {Number(delivery.amount_to_collect) > 0
                        ? `${Number(delivery.amount_to_collect).toLocaleString("fr-FR")} FCFA à encaisser`
                        : "Déjà payé"}
                    </span>
                  </div>

                  <h3 className="font-semibold text-slate-800 text-base mb-1">
                    {delivery.customer_name || "Client anonyme"}
                  </h3>

                  <div className="flex items-start gap-2 text-slate-500 text-sm mt-2">
                    <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="line-clamp-2 leading-tight">
                      {delivery.customer_address}, {delivery.customer_city}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="pt-4">
        <Button 
          className="w-full rounded-xl h-14 text-base font-semibold shadow-lg shadow-primary/25"
          onClick={() => navigate("/delivery/driver/scanner")}
        >
          Scanner un colis
        </Button>
      </div>
    </div>
  );
}
