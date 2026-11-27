// Commandes d'une boutique, lues page par page (shop_orders_page), avec le suivi de leurs livraisons.

import { supabase } from "@/integrations/supabase/client";
import { pageRange, type PageResult } from "@/lib/pagination";

export interface ShopOrderItem {
  id: string;
  product_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_image_url: string | null;
  selected_variants?: Record<string, string> | null;
}

export interface ShopOrderDelivery {
  id: string;
  status: string;
  failure_reason?: string | null;
  pod_signature_url?: string | null;
  pod_photo_url?: string | null;
  payment?: { amount_collected: number; status: "collected_by_driver" | "remitted_to_company" | "remitted_to_shop" } | null;
  driver?: { name: string; phone: string } | null;
  provider?: { company_name: string } | null;
}

export interface ShopOrder {
  id: string;
  /** Rang de la commande dans la boutique : la plus ancienne est la n° 1. */
  sequence: number;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_address: string | null;
  customer_city: string | null;
  total: number;
  promo_code?: string | null;
  discount_amount?: number | null;
  payment_method: string;
  payment_status: string;
  order_status: string;
  is_read: boolean;
  created_at: string;
  products_summary?: string | null;
  scheduled_delivery_date?: string | null;
  internal_delivery_note?: string | null;
  notes?: string | null;
  order_items?: ShopOrderItem[];
  order_deliveries?: ShopOrderDelivery[] | null;
}

export type DeliveryDateFilter = "all" | "today" | "tomorrow" | "scheduled" | "unscheduled";

export interface DeliveryDateCounts {
  today: number;
  tomorrow: number;
  scheduled: number;
  unscheduled: number;
}

export interface ShopOrdersFilter {
  shopId: string;
  search: string;
  delivery: DeliveryDateFilter;
  /** Jour du marchand (AAAA-MM-JJ). */
  today: string;
}

export interface ShopOrdersPage extends PageResult<ShopOrder> {
  /** Boutique restreinte : aucune commande n'est livrée. */
  restricted: boolean;
  /** Toutes les commandes de la boutique, filtres ignorés. */
  shopTotal: number;
  counts: DeliveryDateCounts;
}

interface PageRow {
  restricted: boolean;
  total: number;
  shop_total: number;
  counts: DeliveryDateCounts;
  rows: ShopOrder[];
}

async function readOrders(filter: ShopOrdersFilter, limit: number, offset: number): Promise<PageRow> {
  const { data, error } = (await supabase.rpc("shop_orders_page" as never, {
    _shop_id: filter.shopId,
    _search: filter.search,
    _delivery: filter.delivery,
    _today: filter.today,
    _limit: limit,
    _offset: offset,
  } as never)) as unknown as { data: PageRow | null; error: { message: string } | null };
  if (error) throw error;
  if (!data) throw new Error("Réponse vide");
  return data;
}

export async function fetchShopOrdersPage(filter: ShopOrdersFilter, page: number, pageSize: number): Promise<ShopOrdersPage> {
  const [from] = pageRange(page, pageSize);
  const data = await readOrders(filter, pageSize, from);
  return {
    restricted: data.restricted,
    total: data.total,
    shopTotal: data.shop_total,
    counts: data.counts,
    rows: await attachDeliveries(data.rows),
  };
}

const EXPORT_BATCH = 500;

/** Toutes les commandes correspondant au filtre (export, impression). Lève une erreur plutôt que d'en omettre. */
export async function fetchAllShopOrders(filter: ShopOrdersFilter): Promise<ShopOrder[]> {
  // Une commande arrivée pendant la lecture décale les lots : celle qui revient deux fois n'est gardée qu'une fois.
  const byId = new Map<string, ShopOrder>();
  for (let offset = 0; ; offset += EXPORT_BATCH) {
    const data = await readOrders(filter, EXPORT_BATCH, offset);
    if (data.restricted) throw new Error("Boutique restreinte");
    data.rows.forEach((order) => byId.set(order.id, order));
    if (data.rows.length < EXPORT_BATCH) return Array.from(byId.values());
  }
}

interface DeliveryRow {
  id: string;
  order_id: string;
  status: string;
  provider_id: string | null;
  driver_id: string | null;
}

interface DriverContact { member_id: string; full_name: string | null; phone: string | null }

type Payment = NonNullable<ShopOrderDelivery["payment"]> & { delivery_id: string };

type Read<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Lecture d'une table ou d'une fonction absente des types générés. */
const untyped = supabase as unknown as {
  from: (table: string) => { select: (columns: string) => { in: (column: string, values: string[]) => unknown } };
  rpc: (name: string, args: Record<string, unknown>) => unknown;
};

const readIn = <T,>(table: string, columns: string, column: string, values: string[]) =>
  untyped.from(table).select(columns).in(column, values) as Read<T>;

/**
 * Ajoute à chaque commande ses livraisons (prestataire, livreur, argent encaissé). Un échec de cette lecture ne
 * masque pas les commandes : elles sont rendues sans suivi.
 */
export async function attachDeliveries(orders: ShopOrder[]): Promise<ShopOrder[]> {
  if (orders.length === 0) return orders;
  try {
    const { data: deliveries, error } = await readIn<DeliveryRow>("order_deliveries", "*", "order_id", orders.map((o) => o.id));
    if (error) throw error;
    const rows = deliveries ?? [];
    const unique = (values: (string | null)[]) => Array.from(new Set(values.filter((v): v is string => !!v)));

    // Le nom du prestataire vient de la vue publique : `delivery_providers` n'est lisible que par son propriétaire.
    const providerIds = unique(rows.map((d) => d.provider_id));
    const providerNames = new Map<string, { id: string; company_name: string }>();
    if (providerIds.length > 0) {
      const { data: providers } = await readIn<{ id: string; company_name: string }>("delivery_providers_public", "id, company_name", "id", providerIds);
      (providers ?? []).forEach((p) => providerNames.set(p.id, p));
    }
    // Nom et téléphone du livreur : absents de delivery_company_members, lus dans le profil via une fonction
    // qui ne répond que pour les livreurs affectés aux commandes de l'appelant.
    const driverIds = unique(rows.map((d) => d.driver_id));
    const driverContacts = new Map<string, DriverContact>();
    if (driverIds.length > 0) {
      const { data: contacts } = await (untyped.rpc("get_delivery_driver_contacts", { _member_ids: driverIds }) as Read<DriverContact>);
      (contacts ?? []).forEach((c) => driverContacts.set(c.member_id, c));
    }
    // Argent encaissé à la livraison (une ligne par livraison livrée sur commande non payée en ligne).
    const paymentsByDelivery = new Map<string, Payment>();
    if (rows.length > 0) {
      const { data: payments } = await readIn<Payment>("delivery_payments", "delivery_id, amount_collected, status", "delivery_id", rows.map((d) => d.id));
      (payments ?? []).forEach((p) => paymentsByDelivery.set(p.delivery_id, p));
    }

    const byOrder = new Map<string, ShopOrderDelivery[]>();
    rows.forEach((d) => {
      const contact = d.driver_id ? driverContacts.get(d.driver_id) : null;
      const list = byOrder.get(d.order_id) ?? [];
      list.push({
        ...d,
        payment: paymentsByDelivery.get(d.id) || null,
        provider: (d.provider_id && providerNames.get(d.provider_id)) || null,
        driver: d.driver_id ? { name: contact?.full_name || "Livreur", phone: contact?.phone || "" } : null,
      });
      byOrder.set(d.order_id, list);
    });
    return orders.map((o) => ({ ...o, order_deliveries: byOrder.get(o.id) ?? [] }));
  } catch (error) {
    console.error("Failed to fetch order deliveries", error);
    return orders;
  }
}
