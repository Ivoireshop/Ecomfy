// Listes paginées du tableau de bord fondateur (la RLS réserve ces lectures à la direction).
import { supabase } from "@/integrations/supabase/client";
import { pageRange, searchFilter, type PageResult } from "@/lib/pagination";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  country: string | null;
  created_at: string;
  free_generations_remaining: number;
}

export interface ShopItem {
  id: string;
  business_name: string;
  slug: string | null;
  city: string | null;
  country: string | null;
  whatsapp_number: string | null;
  is_published: boolean | null;
  is_activated: boolean | null;
  /** Commission restant due ; sert à proposer le montant d'un règlement manuel. */
  commission_balance_due: number | null;
  total_orders: number | null;
  total_sales: number | null;
  created_at: string;
  user_id: string;
  owner_email?: string | null;
}

const SHOP_COLUMNS =
  "id, business_name, slug, city, country, whatsapp_number, is_published, is_activated, commission_balance_due, total_orders, total_sales, created_at, user_id";

type PageArgs = { page: number; pageSize: number; search: string };

export async function fetchFounderUsers({ page, pageSize, search }: PageArgs): Promise<PageResult<UserProfile>> {
  const [from, to] = pageRange(page, pageSize);
  const filter = searchFilter(["full_name", "email", "phone", "country"], search);
  let query = supabase
    .from("profiles")
    .select("id, email, full_name, phone, country, created_at, free_generations_remaining", { count: "exact" })
    // Second tri : sans lui, deux inscriptions à la même date pourraient changer de page d'une lecture à l'autre.
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  if (filter) query = query.or(filter);

  const { data, error, count } = await query;
  if (error) {
    // PGRST103 : la page demandée n'existe plus. On rend le nouveau total, la liste recule d'elle-même.
    if (error.code === "PGRST103" && page > 1) {
      const first = await fetchFounderUsers({ page: 1, pageSize, search });
      return { rows: [], total: first.total };
    }
    throw error;
  }
  return { rows: (data ?? []) as UserProfile[], total: count ?? 0 };
}

export async function fetchFounderShops({ page, pageSize, search }: PageArgs): Promise<PageResult<ShopItem>> {
  const [from] = pageRange(page, pageSize);
  // La fonction n'est pas encore dans les types générés.
  const { data, error } = await supabase.rpc("founder_search_shops" as never, {
    _query: search || null,
    _limit: pageSize,
    _offset: from,
  } as never);
  if (error) throw error;
  const result = data as unknown as PageResult<ShopItem> | null;
  if (!result) throw new Error("Accès refusé.");
  return result;
}

/** Correspondance exacte sur l'identifiant ou le slug ; `null` si aucune boutique ne correspond. */
export async function findShopByIdOrSlug(value: string): Promise<ShopItem | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  const { data, error } = await supabase
    .from("shops")
    .select(SHOP_COLUMNS)
    .eq(isUuid ? "id" : "slug", value)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as ShopItem | null;
}
