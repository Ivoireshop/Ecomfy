// Libellés et règles d'affichage partagés par les deux vues de la liste des commandes (cartes et liste).

import type { ShopDispatchSummary } from "@/types/delivery";
import type { ShopOrder } from "@/lib/shopOrders";

export const STATUS_MAP: Record<string, { label: string; color: string; dot: string }> = {
  new: { label: "Nouveau", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", dot: "bg-blue-500" },
  pending: { label: "En attente", color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300", dot: "bg-slate-400" },
  confirmed: { label: "Confirmé", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", dot: "bg-green-500" },
  processing: { label: "En traitement", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300", dot: "bg-yellow-500" },
  shipped: { label: "Expédié", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300", dot: "bg-purple-500" },
  delivered: { label: "Livré", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", dot: "bg-emerald-600" },
  cancelled: { label: "Annulé", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", dot: "bg-red-500" },
  returned: { label: "Retourné", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300", dot: "bg-orange-500" },
};

// Une commande terminée ou annulée ne peut plus être confiée à un livreur.
const NOT_SHIPPABLE = new Set(["delivered", "cancelled", "returned"]);
// Une livraison déjà récupérée, en route ou terminée ne se relance pas (refusé par le serveur).
const DELIVERY_IN_PROGRESS = new Set(["picked_up", "in_transit", "delivered"]);

export function deliveryStatusLabel(status: string, hasDriver: boolean): string {
  switch (status) {
    case "pending": return hasDriver ? "Assigné au livreur" : "En attente d'assignation";
    case "assigned": return "Assigné au livreur";
    case "picked_up": return "Récupéré";
    case "in_transit": return "En route";
    case "delivered": return "Livré";
    case "returned": return "Retourné";
    case "failed": return "Échec";
    default: return status;
  }
}

/** Envois possibles pour une commande. */
export function shippingOptions(order: ShopOrder, dispatch: ShopDispatchSummary | undefined, dispatchesLoading: boolean) {
  // Tant que les courses ne sont pas chargées, aucun envoi n'est proposé : la commande est peut-être déjà confiée.
  const canSend = !dispatchesLoading && !dispatch && !NOT_SHIPPABLE.has(order.order_status)
    && !order.order_deliveries?.some((d) => DELIVERY_IN_PROGRESS.has(d.status));
  // « Expédier » reste disponible pour relancer sa propre livraison, mais elle exclut la transmission.
  const hasOwnDelivery = !!order.order_deliveries?.some((d) => d.status !== "failed" && d.status !== "returned");
  return { canSend, canTransmit: canSend && !hasOwnDelivery };
}

export const phoneDigits = (phone: string | null | undefined) => phone?.replace(/[^0-9+]/g, "") ?? "";

export const whatsappLink = (order: ShopOrder) =>
  `https://wa.me/${phoneDigits(order.customer_phone).replace(/^\+/, "")}?text=${encodeURIComponent(`Bonjour ${order.customer_name}, je vous contacte au sujet de votre commande ${order.order_number}.`)}`;
