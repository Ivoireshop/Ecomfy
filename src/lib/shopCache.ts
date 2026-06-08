// Lightweight in-memory cache for public shop & product data.
// Pattern: stale-while-revalidate. Pages read synchronously from cache to
// render instantly, then a background refetch updates the cache for the next
// navigation. No external dependency, no behavioral change for callers that
// don't opt in.

type Entry<T> = { data: T; at: number };

const TTL_MS = 60_000; // 1 minute — long enough for typical browse sessions
const store = new Map<string, Entry<any>>();

// Persist cache across page reloads in the same tab (sessionStorage). This
// makes "click an ad link → page reload" feel instant: we hydrate from the
// previously-fetched data while a fresh fetch runs in the background.
const SS_PREFIX = "vp_cache:";
const SS_TTL_MS = 5 * 60_000; // 5 min on disk — refreshed by every fetch

const readFromSession = <T>(key: string): Entry<T> | null => {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(SS_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry<T>;
    if (!parsed || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > SS_TTL_MS) return null;
    return parsed;
  } catch { return null; }
};

const writeToSession = <T>(key: string, entry: Entry<T>) => {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(SS_PREFIX + key, JSON.stringify(entry));
  } catch { /* quota / serialization — ignore */ }
};

export function cacheGet<T = any>(key: string): T | null {
  const e = store.get(key);
  if (e) return e.data as T;
  const fromSS = readFromSession<T>(key);
  if (fromSS) {
    store.set(key, fromSS);
    return fromSS.data as T;
  }
  return null;
}

export function cacheIsFresh(key: string, ttl = TTL_MS): boolean {
  let e = store.get(key);
  if (!e) {
    const fromSS = readFromSession(key);
    if (fromSS) { store.set(key, fromSS); e = fromSS; }
  }
  if (!e) return false;
  return Date.now() - e.at < ttl;
}

export function cacheSet<T = any>(key: string, data: T): void {
  const entry = { data, at: Date.now() };
  store.set(key, entry);
  writeToSession(key, entry);
}

export function cacheInvalidate(prefix?: string): void {
  if (!prefix) {
    store.clear();
    try {
      if (typeof sessionStorage !== "undefined") {
        Object.keys(sessionStorage)
          .filter(k => k.startsWith(SS_PREFIX))
          .forEach(k => sessionStorage.removeItem(k));
      }
    } catch {}
    return;
  }
  for (const k of Array.from(store.keys())) {
    if (k.startsWith(prefix)) store.delete(k);
  }
  try {
    if (typeof sessionStorage !== "undefined") {
      Object.keys(sessionStorage)
        .filter(k => k.startsWith(SS_PREFIX + prefix))
        .forEach(k => sessionStorage.removeItem(k));
    }
  } catch {}
}

// Helpers for the standard shop/product keys used by ShopView & ProductView.
export const shopKey = (idOrSlug: string, kind: "id" | "slug" | "domain") =>
  `shop:${kind}:${idOrSlug}`;
export const shopProductsKey = (shopId: string) => `shop-products:${shopId}`;
export const productKey = (shopId: string, productSlugOrId: string) =>
  `product:${shopId}:${productSlugOrId}`;