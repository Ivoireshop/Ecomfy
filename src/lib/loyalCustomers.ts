// Clients fidèles d'une boutique : regroupés par la base (shop_loyal_customers) et lus page par page.

import { supabase } from "@/integrations/supabase/client";
import { pageRange, type PageResult } from "@/lib/pagination";

export type LoyaltyTier = "platine" | "or" | "argent" | "bronze";
export type LoyaltyFilter = "all" | "repeating" | LoyaltyTier;

export interface CustomerLoyaltyProfile {
  /** 8 derniers chiffres du téléphone, à défaut l'e-mail. */
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  delivery_city: string | null;
  order_count: number;
  total_spent: number;
  last_order_date: string;
  first_order_date: string;
  tier: LoyaltyTier;
}

/** Sur toute la boutique, recherche et niveau ignorés. */
export interface LoyaltyStats {
  customers: number;
  /** 2 commandes ou plus. */
  repeating: number;
  platine: number;
  or: number;
  argent: number;
  bronze: number;
  repeat_revenue: number;
}

export interface LoyalCustomersFilter {
  shopId: string;
  search: string;
  tier: LoyaltyFilter;
}

export interface LoyalCustomersPage extends PageResult<CustomerLoyaltyProfile> {
  stats: LoyaltyStats;
}

interface RpcResult {
  restricted: boolean;
  total: number;
  stats: LoyaltyStats;
  rows: CustomerLoyaltyProfile[];
}

async function readCustomers(filter: LoyalCustomersFilter, limit: number, offset: number): Promise<RpcResult> {
  const { data, error } = (await supabase.rpc("shop_loyal_customers" as never, {
    _shop_id: filter.shopId,
    _search: filter.search,
    _tier: filter.tier,
    _limit: limit,
    _offset: offset,
  } as never)) as unknown as { data: RpcResult | null; error: { message: string } | null };
  if (error) throw error;
  if (!data) throw new Error("Réponse vide");
  // Une boutique restreinte ne livre rien : à ne pas confondre avec une boutique sans client.
  if (data.restricted) throw new Error("Boutique restreinte");
  return data;
}

export async function fetchLoyalCustomersPage(filter: LoyalCustomersFilter, page: number, pageSize: number): Promise<LoyalCustomersPage> {
  const [from] = pageRange(page, pageSize);
  const data = await readCustomers(filter, pageSize, from);
  return { rows: data.rows, total: data.total, stats: data.stats };
}

const EXPORT_BATCH = 1000;

/** Tous les clients correspondant au filtre (export). Lève une erreur plutôt que d'en omettre. */
export async function fetchAllLoyalCustomers(filter: LoyalCustomersFilter): Promise<CustomerLoyaltyProfile[]> {
  // Une commande arrivée pendant la lecture déplace des clients : celui qui revient deux fois n'est gardé qu'une fois.
  const byId = new Map<string, CustomerLoyaltyProfile>();
  for (let offset = 0; ; offset += EXPORT_BATCH) {
    const data = await readCustomers(filter, EXPORT_BATCH, offset);
    data.rows.forEach((customer) => byId.set(customer.id, customer));
    if (data.rows.length < EXPORT_BATCH) return Array.from(byId.values());
  }
}

/** Part des clients fidèles, avec une décimale : 4 sur 1 105 donnent 0,4 % et non « 0 % ». */
export const repeatRate = (stats: Pick<LoyaltyStats, "customers" | "repeating">): number =>
  stats.customers > 0 ? Math.round((stats.repeating / stats.customers) * 1000) / 10 : 0;

// Neutralise l'interprétation d'une cellule comme formule dans Excel / Sheets (un numéro « +225… » reste intact).
export const csvCell = (value: string | number): string => {
  let s = String(value ?? "");
  if (/^([=@\t\r]|[+-].*[^\d\s().+-])/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

/** Fichier CSV des clients : point-virgule et BOM UTF-8, pour Excel en réglages français. */
export function loyalCustomersCsv(customers: CustomerLoyaltyProfile[]): string {
  const headers = ["Nom", "Telephone", "Email", "Ville", "Commandes", "Total Dépensé (FCFA)", "Niveau Fidélité", "Dernière Commande"];
  const rows = customers.map((c) => [
    csvCell(c.customer_name),
    csvCell(c.customer_phone),
    csvCell(c.customer_email || ""),
    csvCell(c.delivery_city || ""),
    c.order_count,
    c.total_spent,
    csvCell(c.tier.toUpperCase()),
    csvCell(new Date(c.last_order_date).toLocaleDateString("fr-FR")),
  ]);
  return "﻿" + [headers.map(csvCell).join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
}
