// E-mail « votre achat est prêt » : envoie à l'acheteur le lien personnel de téléchargement de sa commande.
// Partagé par ecomfy-pay-webhook (à la confirmation du paiement) et digital-download (renvoi à la demande).
//
// Le jeton ne quitte jamais le serveur sauf dans CE mail, adressé à l'e-mail enregistré sur la commande.
import { APP_URL } from "./email-sender.ts";

// deno-lint-ignore no-explicit-any
type Db = any;

export type DigitalDeliveryResult = { sent: boolean; reason?: string };

/**
 * @param idempotencyKey clé d'envoi unique : `digital-ready-<commande>` pour l'envoi automatique (un seul mail par
 *   commande, même si le webhook est rejoué), une clé horodatée pour un renvoi demandé par l'acheteur.
 */
export async function sendDigitalDeliveryEmail(db: Db, orderId: string, idempotencyKey: string): Promise<DigitalDeliveryResult> {
  const { data: order } = await db
    .from("orders")
    .select("id, order_number, payment_status, customer_name, customer_email, shop_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { sent: false, reason: "order_not_found" };
  if (String(order.payment_status ?? "").toLowerCase() !== "paid") return { sent: false, reason: "not_paid" };
  const email = String(order.customer_email ?? "").trim();
  if (!email) return { sent: false, reason: "no_email" };

  const { data: access } = await db.from("digital_order_access").select("token").eq("order_id", order.id).maybeSingle();
  if (!access?.token) return { sent: false, reason: "no_digital_items" };

  const [{ data: shop }, { data: lines }] = await Promise.all([
    db.from("shops").select("business_name").eq("id", order.shop_id).maybeSingle(),
    db.from("order_items").select("product_id, product_name").eq("order_id", order.id),
  ]);
  const ids = Array.from(new Set((lines ?? []).map((l: { product_id: string }) => l.product_id)));
  const { data: digital } = ids.length
    ? await db.from("products").select("id").in("id", ids).eq("is_digital", true)
    : { data: [] };
  const digitalIds = new Set((digital ?? []).map((p: { id: string }) => p.id));
  const productNames = (lines ?? [])
    .filter((l: { product_id: string }) => digitalIds.has(l.product_id))
    .map((l: { product_name: string }) => l.product_name);

  const { error } = await db.functions.invoke("send-transactional-email", {
    body: {
      templateName: "digital-order-ready",
      recipientEmail: email,
      idempotencyKey,
      templateData: {
        customerName: order.customer_name || undefined,
        shopName: shop?.business_name || undefined,
        orderNumber: order.order_number,
        downloadUrl: `${APP_URL}/telechargement/${access.token}`,
        productNames,
      },
    },
  });
  if (error) return { sent: false, reason: "send_failed" };
  return { sent: true };
}
