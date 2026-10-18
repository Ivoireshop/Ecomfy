import { supabase } from "@/integrations/supabase/client";

export interface PublicOrderLine {
  product_id: string;
  quantity: number;
  bundle_index?: number | null;
  selected_variants?: Record<string, string> | null;
}

export interface PublicOrderInput {
  shopId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerAddress?: string | null;
  customerCity?: string | null;
  customerCountry?: string | null;
  paymentMethod: string;
  /** 'pending' pour une commande directe de la page d'accueil, sinon 'new' (valeur imposée par le serveur). */
  orderStatus?: "new" | "pending";
  items: PublicOrderLine[];
}

export interface PublicOrderResult {
  orderId: string;
  orderNumber: string;
  /** Total décidé par le serveur (prix de la base, offres en lot comprises). */
  total: number;
}

/**
 * Creates an order and its lines in one server-side transaction (H10). Prices, totals, commission, order number
 * and initial statuses are decided by the database; the browser only sends product ids and quantities.
 */
export async function createPublicOrder(input: PublicOrderInput): Promise<PublicOrderResult> {
  const { data, error } = await (supabase as any).rpc("create_public_order", {
    p_shop_id: input.shopId,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_items: input.items,
    p_customer_email: input.customerEmail || null,
    p_customer_address: input.customerAddress || null,
    p_customer_city: input.customerCity || null,
    p_customer_country: input.customerCountry || null,
    p_payment_method: input.paymentMethod,
    p_order_status: input.orderStatus ?? "new",
  });
  if (error) throw new Error(error.message || "Impossible d'enregistrer la commande.");
  if (!data?.success || !data.order_id) throw new Error("Impossible d'enregistrer la commande.");
  return { orderId: data.order_id, orderNumber: data.order_number, total: Number(data.total) };
}
