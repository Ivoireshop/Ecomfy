import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Package, MapPin, User } from "lucide-react";
import { toast } from "sonner";
import { deliveryRpc, type ProviderDeliveryRow, type ProviderDriverRow } from "@/lib/deliveryRpc";

interface DispatchTableProps {
  providerId: string;
  /** Propriétaire, admin ou dispatcher : peut assigner et relancer. Le caissier consulte seulement. */
  canManage?: boolean;
}

const IN_PROGRESS = new Set(["picked_up", "in_transit"]);
// Tant que la course n'a pas commencé (ou après un échec), le livreur peut être changé.
const REASSIGNABLE = new Set(["pending", "assigned", "failed"]);

const CASH_LABELS: Record<string, string> = {
  collected_by_driver: "Argent chez le livreur",
  remitted_to_company: "Argent reçu par le prestataire",
  remitted_to_shop: "Argent reversé à la boutique",
};

export function DispatchTable({ providerId, canManage = true }: DispatchTableProps) {
  const queryClient = useQueryClient();

  // Fonctions serveur : lecture des commandes et des profils réservée à leur propriétaire en accès direct,
  // donc un dispatcher non propriétaire n'aurait ni client ni nom de livreur.
  const { data: deliveries, isLoading: deliveriesLoading } = useQuery({
    queryKey: ["provider-deliveries", providerId],
    queryFn: () => deliveryRpc<ProviderDeliveryRow>("get_provider_deliveries", { _provider_id: providerId }),
  });

  const { data: team, isLoading: driversLoading } = useQuery({
    queryKey: ["provider-drivers", providerId],
    queryFn: () => deliveryRpc<ProviderDriverRow>("get_provider_drivers", { _provider_id: providerId }),
  });

  const drivers = (team ?? []).filter((m) => m.role === "driver" && m.is_active);
  const driverName = (id: string | null) => {
    if (!id) return null;
    const m = (team ?? []).find((x) => x.member_id === id);
    return m?.full_name || `Livreur ${id.substring(0, 4)}`;
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["provider-deliveries", providerId] });
  };

  // Une mise à jour refusée par la sécurité renvoie 0 ligne sans erreur : on la détecte avec .select().
  const assignDriverMutation = useMutation({
    mutationFn: async ({ deliveryId, driverId }: { deliveryId: string; driverId: string }) => {
      // Pour une course en échec, l'assignation la relance (le serveur remet le statut en attente et efface le motif).
      const { data, error } = await supabase
        .from("order_deliveries")
        .update({
          driver_id: driverId,
          status: "pending"
        })
        .eq("id", deliveryId)
        .select("id");

      if (error) throw error;
      if (!data || data.length === 0) throw new Error("mise à jour refusée.");
    },
    onSuccess: () => {
      refresh();
      toast.success("Livreur assigné avec succès");
    },
    onError: (error: Error) => {
      toast.error("Erreur lors de l'assignation : " + error.message);
    }
  });

  // Colis qui n'a pas pu être livré : retour à la boutique (la commande passe « retournée »).
  const returnToShopMutation = useMutation({
    mutationFn: async (deliveryId: string) => {
      const { data, error } = await supabase
        .from("order_deliveries")
        .update({ status: "returned" })
        .eq("id", deliveryId)
        .select("id");

      if (error) throw error;
      if (!data || data.length === 0) throw new Error("mise à jour refusée.");
    },
    onSuccess: () => {
      refresh();
      toast.success("Colis marqué comme retourné à la boutique");
    },
    onError: (error: Error) => {
      toast.error("Erreur : " + error.message);
    }
  });

  if (deliveriesLoading || driversLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="w-5 h-5 text-primary" />
          Missions de Livraison
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {!deliveries || deliveries.length === 0 ? (
            <div className="text-center p-8 text-slate-500">
              Aucune mission pour le moment.
            </div>
          ) : (
            deliveries.map((delivery) => {
              const isAssigned = !!delivery.driver_id;
              const status = delivery.status;
              const showSelect = canManage && REASSIGNABLE.has(status);

              return (
                <div key={delivery.delivery_id} className="border border-slate-100 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4 bg-slate-50 hover:bg-slate-100/50 transition-colors">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold font-mono text-slate-800" data-testid="dispatch-order-number">
                        {delivery.order_number || delivery.order_id.substring(0, 8).toUpperCase()}
                      </span>
                      <Badge className={
                        status === "delivered" ? "bg-green-100 text-green-700 hover:bg-green-100" :
                        IN_PROGRESS.has(status) ? "bg-blue-100 text-blue-700 hover:bg-blue-100" :
                        status === "failed" ? "bg-red-100 text-red-700 hover:bg-red-100" :
                        status === "returned" ? "bg-slate-200 text-slate-700 hover:bg-slate-200" :
                        isAssigned ? "bg-purple-100 text-purple-700 hover:bg-purple-100" :
                        "bg-orange-100 text-orange-700 hover:bg-orange-100"
                      }>
                        {status === "delivered" ? "Livré" :
                         IN_PROGRESS.has(status) ? "En cours" :
                         status === "failed" ? "Échec" :
                         status === "returned" ? "Retourné" :
                         isAssigned ? "Assigné" : "À assigner"}
                      </Badge>
                      {delivery.cash_status && (
                        <Badge variant="outline" className="text-xs">{CASH_LABELS[delivery.cash_status] ?? delivery.cash_status}</Badge>
                      )}
                    </div>

                    {status === "failed" && delivery.failure_reason && (
                      <p className="text-sm text-red-600">Motif : {delivery.failure_reason}</p>
                    )}

                    <div className="flex flex-wrap items-start gap-4 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4 shrink-0 text-slate-400" />
                        <span>{delivery.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4 shrink-0 text-slate-400" />
                        <span className="truncate max-w-[200px]">{delivery.customer_city}</span>
                      </div>
                      <div className="flex items-center gap-1 font-medium text-slate-800">
                        {Number(delivery.total_amount ?? 0).toLocaleString("fr-FR")} FCFA
                      </div>
                    </div>
                  </div>

                  <div className="w-full md:w-64 shrink-0">
                    {!showSelect ? (
                      <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium" data-testid="dispatch-driver-name">
                          {driverName(delivery.driver_id) ?? "Non assigné"}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Select
                          value={status === "failed" ? "unassigned" : delivery.driver_id || "unassigned"}
                          onValueChange={(value) => {
                            if (value !== "unassigned") {
                              assignDriverMutation.mutate({ deliveryId: delivery.delivery_id, driverId: value });
                            }
                          }}
                          disabled={assignDriverMutation.isPending}
                        >
                          <SelectTrigger className="w-full bg-white" data-testid="dispatch-assign-trigger">
                            <SelectValue placeholder={status === "failed" ? "Réassigner pour relancer" : "Assigner un livreur"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Non assigné</SelectItem>
                            {drivers.map((driver) => (
                              <SelectItem key={driver.member_id} value={driver.member_id}>
                                {driver.full_name || `Livreur ${driver.member_id.substring(0, 4)}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {status === "failed" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            disabled={returnToShopMutation.isPending}
                            onClick={() => returnToShopMutation.mutate(delivery.delivery_id)}
                          >
                            Colis retourné à la boutique
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
