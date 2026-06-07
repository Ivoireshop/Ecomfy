// Lightweight in-memory cache for public shop & product data.
// Pattern: stale-while-revalidate. Pages read synchronously from cache to
// render instantly, then a background refetch updates the cache for the next
// navigation. No external dependency, no behavioral change for callers that
// don't opt in.

type Entry<T> = { data: T; at: number };

const TTL_MS = 60_000; // 1 minute — long enough for typical browse sessions
const store = new Map<string, Entry<any>>();

export function cacheGet<T = any>(key: string): T | null {
  const e = store.get(key);
  if (!e) return null;
  return e.data as T;
}

export function cacheIsFresh(key: string, ttl = TTL_MS): boolean {
  const e = store.get(key);
  if (!e) return false;
  return Date.now() - e.at < ttl;
}

export function cacheSet<T = any>(key: string, data: T): void {
  store.set(key, { data, at: Date.now() });
}

export function cacheInvalidate(prefix?: string): void {
  if (!prefix) { store.clear(); return; }
  for (const k of Array.from(store.keys())) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}

// Helpers for the standard shop/product keys used by ShopView & ProductView.
export const shopKey = (idOrSlug: string, kind: "id" | "slug" | "domain") =>
  `shop:${kind}:${idOrSlug}`;
export const shopProductsKey = (shopId: string) => `shop-products:${shopId}`;
export const productKey = (shopId: string, productSlugOrId: string) =>
  `product:${shopId}:${productSlugOrId}`;