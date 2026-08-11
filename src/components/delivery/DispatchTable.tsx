import { useState } from "react";
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
import { Loader2, Package, MapPin, Clock, User } from "lucide-react";
import { toast } from "sonner";

interface DispatchTableProps {
  providerId: string;
}

export function DispatchTable({ providerId }: DispatchTableProps) {
  const queryClient = useQueryClient();

  const { data: deliveries, isLoading: deliveriesLoading } = useQuery({
    queryKey: ["provider-deliveries", providerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_deliveries")
        .select(`
          *,
          orders (
            id,
            order_number,
            customer_name,
            customer_phone,
            customer_address,
            customer_city,
            total_amount
          ),
          driver:driver_id (
            id,
            user_id
          )
        `)
        .eq("provider_id", providerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: drivers, isLoading: driversLoading } = useQuery({
    queryKey: ["provider-drivers", providerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_company_members")
        .select(`
          id,
          user_id,
          role,
          profiles:user_id (
            first_name,
            last_name
          )
        `)
        .eq("provider_id", providerId)
        .eq("role", "driver")
        .eq("is_active", true);

      if (error) throw error;
      return data;
    },
  });

  const assignDriverMutation = useMutation({
    mutationFn: async ({ deliveryId, driverId }: { deliveryId: string; driverId: string }) => {
      const { error } = await supabase
        .from("order_deliveries")
        .update({ 
          driver_id: driverId, 
          status: "pending"
        })
        .eq("id", deliveryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-deliveries", providerId] });
      toast.success("Livreur assigné avec succès");
    },
    onError: (error) => {
      toast.error("Erreur lors de l'assignation : " + error.message);
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
          {deliveries?.length === 0 ? (
            <div className="text-center p-8 text-slate-500">
              Aucune mission pour le moment.
            </div>
          ) : (
            deliveries?.map((delivery: any) => {
              const orderData = Array.isArray(delivery.orders) ? delivery.orders[0] : delivery.orders;
              const isAssigned = !!delivery.driver_id;
              
              return (
                <div key={delivery.id} className="border border-slate-100 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4 bg-slate-50 hover:bg-slate-100/50 transition-colors">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold font-mono text-slate-800">
                        {orderData?.order_number || orderData?.id?.substring(0, 8).toUpperCase()}
                      </span>
                      <Badge className={
                        delivery.status === "delivered" ? "bg-green-100 text-green-700 hover:bg-green-100" :
                        delivery.status === "in_transit" ? "bg-blue-100 text-blue-700 hover:bg-blue-100" :
                        isAssigned ? "bg-purple-100 text-purple-700 hover:bg-purple-100" :
                        "bg-orange-100 text-orange-700 hover:bg-orange-100"
                      }>
                        {delivery.status === "delivered" ? "Livré" :
                         delivery.status === "in_transit" ? "En cours" :
                         isAssigned ? "Assigné" : "À assigner"}
                      </Badge>
                    </div>

                    <div className="flex items-start gap-4 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4 shrink-0 text-slate-400" />
                        <span>{orderData?.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4 shrink-0 text-slate-400" />
                        <span className="truncate max-w-[200px]">{orderData?.customer_city}</span>
                      </div>
                      <div className="flex items-center gap-1 font-medium text-slate-800">
                        {orderData?.total_amount?.toLocaleString("fr-FR")} FCFA
                      </div>
                    </div>
                  </div>

                  <div className="w-full md:w-64 shrink-0">
                    {delivery.status === "delivered" || delivery.status === "in_transit" ? (
                      <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium">Livreur assigné</span>
                      </div>
                    ) : (
                      <Select 
                        value={delivery.driver_id || "unassigned"}
                        onValueChange={(value) => {
                          if (value !== "unassigned") {
                            assignDriverMutation.mutate({ deliveryId: delivery.id, driverId: value });
                          }
                        }}
                        disabled={assignDriverMutation.isPending}
                      >
                        <SelectTrigger className="w-full bg-white">
                          <SelectValue placeholder="Assigner un livreur" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Non assigné</SelectItem>
                          {drivers?.map((driver: any) => {
                            const profile = Array.isArray(driver.profiles) ? driver.profiles[0] : driver.profiles;
                            const name = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "Livreur Inconnu";
                            return (
                              <SelectItem key={driver.id} value={driver.id}>
                                {name || `Livreur ${driver.id.substring(0, 4)}`}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
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
