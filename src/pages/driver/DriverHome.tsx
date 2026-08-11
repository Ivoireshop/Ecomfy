import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, MapPin, Phone, CheckCircle2, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function DriverHome() {
  const navigate = useNavigate();

  // Fetch active deliveries for the current driver
  const { data: deliveries, isLoading } = useQuery({
    queryKey: ["driver-active-deliveries"],
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
        .in("status", ["pending", "in_transit"])
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pendingCount = deliveries?.filter((d) => d.status === "pending").length || 0;
  const inTransitCount = deliveries?.filter((d) => d.status === "in_transit").length || 0;

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
              const order = delivery.orders;
              // Cast properly if orders is an array or object
              const orderData = Array.isArray(order) ? order[0] : order;
              if (!orderData) return null;

              return (
                <div 
                  key={delivery.id} 
                  onClick={() => navigate(`/delivery/driver/mission/${delivery.id}`)}
                  className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 active:scale-[0.98] transition-transform cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        delivery.status === "in_transit" 
                          ? "bg-blue-100 text-blue-700" 
                          : "bg-orange-100 text-orange-700"
                      }`}>
                        {delivery.status === "in_transit" ? "En route" : "À récupérer"}
                      </span>
                    </div>
                    <span className="font-bold text-slate-700">
                      {orderData.total_amount?.toLocaleString("fr-FR")} FCFA
                    </span>
                  </div>
                  
                  <h3 className="font-semibold text-slate-800 text-base mb-1">
                    {orderData.customer_name || "Client anonyme"}
                  </h3>
                  
                  <div className="flex items-start gap-2 text-slate-500 text-sm mt-2">
                    <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="line-clamp-2 leading-tight">
                      {orderData.customer_address}, {orderData.customer_city}
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
