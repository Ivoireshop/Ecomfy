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
  /** Code promo de la boutique ; le serveur vérifie et calcule la remise. */
  promoCode?: string | null;
}

export interface PublicOrderResult {
  orderId: string;
  orderNumber: string;
  /** Total décidé par le serveur (prix de la base, offres en lot comprises). */
  total: number;
  /** Remise appliquée par le serveur (0 sans code ou si le code a été refusé). */
  discount: number;
  promoApplied: boolean;
  /** Raison du refus quand un code a été saisi mais n'a pas pu être appliqué. */
  promoMessage: string | null;
}

export interface PromoPreview {
  valid: boolean;
  discount: number;
  code?: string;
  message: string;
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
    p_promo_code: input.promoCode?.trim() || null,
  });
  if (error) throw new Error(error.message || "Impossible d'enregistrer la commande.");
  if (!data?.success || !data.order_id) throw new Error("Impossible d'enregistrer la commande.");
  return {
    orderId: data.order_id,
    orderNumber: data.order_number,
    total: Number(data.total),
    discount: Number(data.discount) || 0,
    promoApplied: data.promo_applied === true,
    promoMessage: data.promo_message ?? null,
  };
}

/**
 * Aperçu de la remise d'un code pour l'affichage du panier. Le montant définitif est toujours recalculé par le serveur
 * à la création de la commande (le sous-total envoyé ici ne sert qu'à l'aperçu et au minimum de commande).
 */
export async function previewPromoCode(input: {
  shopId: string;
  code: string;
  subtotal: number;
  customerPhone?: string | null;
  customerEmail?: string | null;
}): Promise<PromoPreview> {
  const { data, error } = await (supabase as any).rpc("preview_shop_promo_code", {
    p_shop_id: input.shopId,
    p_code: input.code.trim(),
    p_subtotal: input.subtotal,
    p_customer_phone: input.customerPhone || null,
    p_customer_email: input.customerEmail || null,
  });
  if (error) throw new Error(error.message || "Impossible de vérifier le code promo.");
  return {
    valid: data?.valid === true,
    discount: Number(data?.discount) || 0,
    code: data?.code,
    message: data?.message || "Code promo invalide",
  };
}
