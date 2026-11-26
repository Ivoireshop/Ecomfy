import type { ShopDispatchSummary } from "@/types/delivery";

// Même liste que le serveur (delivery_dispatch_transmit) : une course dans l'un de ces statuts libère la commande.
const RELEASED_DISPATCH = new Set<string>(["refused", "cancelled", "returned", "failed"]);

/** Pour chaque commande, la course qui la confie encore à une structure (aucune entrée si la commande est libre). */
export function activeDispatchByOrder<T extends Pick<ShopDispatchSummary, "order_id" | "status">>(dispatches: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const d of dispatches) {
    if (d.order_id && !RELEASED_DISPATCH.has(d.status)) map.set(d.order_id, d);
  }
  return map;
}
