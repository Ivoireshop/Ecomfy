// Produits d'une boutique dans l'éditeur : page du tableau (calculée par la base) et catalogue complet.
import { supabase } from "@/integrations/supabase/client";
import { pageRange, readAll, type PageResult } from "@/lib/pagination";

export type ProductImageRow = { id: string; image_url: string; is_primary: boolean; display_order: number };

/** Image principale d'abord, puis l'ordre choisi par le marchand. */
export const sortProductImages = (images?: ProductImageRow[] | null) =>
  [...(images || [])].sort((a, b) => {
    if (!!a.is_primary !== !!b.is_primary) return a.is_primary ? -1 : 1;
    return (a.display_order ?? 0) - (b.display_order ?? 0);
  });

export interface ShopProduct {
  id: string;
  slug?: string | null;
  name: string;
  description: string | null;
  short_description: string | null;
  price: number;
  compare_at_price: number | null;
  category: string;
  stock_quantity: number;
  is_published: boolean;
  is_digital: boolean;
  is_featured: boolean;
  display_order: number;
  currency: string | null;
  sku: string | null;
  weight: number | null;
  created_at?: string;
  product_images?: ProductImageRow[];
}

export interface ShopProductRow extends ShopProduct {
  /** Nombre de commandes distinctes contenant ce produit. */
  order_count: number;
}

export type ProductStatusFilter = "all" | "published" | "draft" | "out_of_stock";
export type ProductSort = "recent" | "name_asc" | "name_desc" | "price_asc" | "price_desc" | "orders_desc" | "stock_asc";

type Rows = PromiseLike<{ data: unknown; error: { message: string } | null }>;

export interface ShopProductsQuery {
  shopId: string;
  page: number;
  pageSize: number;
  search: string;
  status: ProductStatusFilter;
  /** null : toutes les catégories. */
  category: string | null;
  sort: ProductSort;
}

export async function fetchShopProductsPage(q: ShopProductsQuery): Promise<PageResult<ShopProductRow> & { categories: string[] }> {
  const [from] = pageRange(q.page, q.pageSize);
  const { data, error } = (await supabase.rpc("shop_products_page" as never, {
    _shop_id: q.shopId,
    _search: q.search,
    _status: q.status,
    _category: q.category,
    _sort: q.sort,
    _limit: q.pageSize,
    _offset: from,
  } as never)) as unknown as {
    data: (PageResult<ShopProductRow> & { categories: string[] }) | null;
    error: { message: string } | null;
  };
  if (error) throw error;
  return { rows: data?.rows ?? [], total: data?.total ?? 0, categories: data?.categories ?? [] };
}

/** Catalogue complet avec images (aperçu des thèmes, page d'accueil, optimiseur IA). */
export async function fetchShopCatalog(shopId: string): Promise<ShopProduct[]> {
  const rows = await readAll<ShopProduct>((from, to) =>
    supabase.from("products").select("*, product_images(*)").eq("shop_id", shopId)
      .order("display_order").order("id").range(from, to) as unknown as Rows);
  return rows.map((product) => ({ ...product, product_images: sortProductImages(product.product_images) }));
}

export type ShopProductName = { id: string; name: string; price: number };

/** Noms seuls (statistiques : produits consultés sans commande). */
export function fetchShopProductNames(shopId: string): Promise<ShopProductName[]> {
  return readAll<ShopProductName>((from, to) =>
    supabase.from("products").select("id, name, price").eq("shop_id", shopId).order("id").range(from, to) as unknown as Rows);
}
