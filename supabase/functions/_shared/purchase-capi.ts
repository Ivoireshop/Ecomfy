// Envoi serveur du Purchase d'un paiement en ligne encaissé. Partagé par ecomfy-pay-webhook (à l'encaissement)
// et ecomfy-pay-settlement (reprise des Purchase non partis).
//
// Idempotent : track-conversion réserve l'envoi par commande (tracking_purchase_log) et utilise l'event_id canonique
// ord_<n° de commande>. L'appeler deux fois ne produit donc jamais deux Purchase, et un envoi raté est repris
// uniquement vers les destinations qui n'avaient pas été servies.
import { purchaseEventId } from "./tracking-event-id.ts";

export interface ServerPurchaseResult {
  sent: boolean;
  reason?: string;
}

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- client Supabase de service sans types générés
export async function sendServerPurchase(supabase: any, paymentId: string): Promise<ServerPurchaseResult> {
  const { data: pay } = await supabase
    .from("ecomfy_payments")
    .select("order_id, shop_id, amount, currency, customer_name, customer_phone, customer_email, metadata")
    .eq("id", paymentId)
    .maybeSingle();
  if (!pay?.shop_id || !pay?.order_id) return { sent: false, reason: "payment_without_order" };

  const { data: ord } = await supabase.from("orders").select("order_number").eq("id", pay.order_id).maybeSingle();
  if (!ord?.order_number) return { sent: false, reason: "order_not_found" };

  const ctx = ((pay.metadata as Record<string, unknown> | null)?.tracking ?? {}) as Record<string, string | undefined>;
  const nameParts = String(pay.customer_name || "").trim().split(/\s+/).filter(Boolean);
  const orderNumber = String(ord.order_number);

  const { data: res, error } = await supabase.functions.invoke("track-conversion", {
    body: {
      shop_id: pay.shop_id,
      event: "Purchase",
      event_id: purchaseEventId(orderNumber),
      event_source_url: ctx.event_source_url || "https://ecomfy.cloud/",
      user_agent: ctx.user_agent,
      client_ip: ctx.client_ip,
      payload: {
        value: Number(pay.amount),
        currency: pay.currency || "XOF",
        order_id: orderNumber,
        email: pay.customer_email || undefined,
        phone: pay.customer_phone || undefined,
        first_name: nameParts[0],
        last_name: nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined,
        fbp: ctx.fbp,
        fbc: ctx.fbc,
      },
    },
  });
  if (error) return { sent: false, reason: error.message || "invoke_failed" };
  if (res?.success === false) return { sent: false, reason: res.error || "track_conversion_failed" };
  // « deduplicated » : déjà parti (ou en cours chez un autre appel) : rien à refaire, ce n'est pas un échec.
  return { sent: true, reason: res?.deduplicated ? "already_sent" : undefined };
}
