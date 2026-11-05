import { supabase } from "@/integrations/supabase/client";

// Ligne renvoyée par la fonction serveur get_my_delivery_missions (migration 20261105100000).
export interface DriverMissionRow {
  delivery_id: string;
  status: string;
  order_id: string;
  order_number: string | null;
  order_status: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  customer_city: string | null;
  total_amount: number | null;
  payment_status: string | null;
  amount_to_collect: number | null;
  failure_reason: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

/**
 * Missions du livreur connecté. Le livreur n'a pas de lecture directe sur `orders` : la fonction serveur ne renvoie
 * que SES courses et les champs utiles (client, adresse, montant à encaisser, 0 si déjà payé).
 * Les types générés ne connaissent pas encore cette fonction, d'où le client typé localement.
 */
export async function fetchMyDeliveryMissions(deliveryId: string | null, statuses: string[] | null): Promise<DriverMissionRow[]> {
  const { data, error } = await (supabase as unknown as RpcClient).rpc("get_my_delivery_missions", {
    _delivery_id: deliveryId,
    _statuses: statuses,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as DriverMissionRow[];
}
