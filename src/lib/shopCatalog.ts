/**
 * Logique pure de la page d'accueil boutique : recherche, tri, répartition vitrine / catalogue,
 * et restauration du panier. Aucun accès réseau ni DOM : tout est testable.
 */

export interface CatalogProduct {
  id: string;
  name: string;
  price: number;
  compare_at_price?: number | null;
  category?: string | null;
  short_description?: string | null;
  is_featured?: boolean;
  stock_quantity?: number | null;
  created_at?: string | null;
  display_order?: number | null;
}

export type SortKey = "relevance" | "price_asc" | "price_desc" | "discount" | "newest";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "relevance", label: "Pertinence" },
  { value: "discount", label: "Promotions d'abord" },
  { value: "price_asc", label: "Prix croissant" },
  { value: "price_desc", label: "Prix décroissant" },
  { value: "newest", label: "Nouveautés" },
];

/** Minuscules, sans accents, espaces compactés : « Crème  Visage » et « creme visage » se retrouvent. */
export const normalizeText = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Tous les mots saisis doivent apparaître (nom, catégorie ou accroche), dans n'importe quel ordre. */
export const matchesQuery = (product: CatalogProduct, query: string): boolean => {
  const terms = normalizeText(query).split(" ").filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = normalizeText(`${product.name} ${product.category ?? ""} ${product.short_description ?? ""}`);
  return terms.every((t) => haystack.includes(t));
};

/** Pourcentage de remise affiché sur la carte ; 0 si aucun prix barré valide. */
export const discountPercent = (product: Pick<CatalogProduct, "price" | "compare_at_price">): number => {
  const compare = Number(product.compare_at_price);
  const price = Number(product.price);
  if (!Number.isFinite(compare) || !Number.isFinite(price) || compare <= 0 || compare <= price) return 0;
  return Math.max(1, Math.round((1 - price / compare) * 100));
};

/** Stock bas à signaler (« Plus que 3 ») : seulement 1 à 5 unités, jamais pour un stock inconnu ou épuisé. */
export const lowStockCount = (product: Pick<CatalogProduct, "stock_quantity">): number | null => {
  const stock = product.stock_quantity;
  if (stock === null || stock === undefined) return null;
  const n = Number(stock);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
};

const timeOf = (p: CatalogProduct) => {
  const t = p.created_at ? Date.parse(p.created_at) : NaN;
  return Number.isFinite(t) ? t : 0;
};

/** Tri stable : à égalité on garde l'ordre choisi par le marchand (celui de la liste d'entrée). */
export const sortProducts = <T extends CatalogProduct>(products: T[], key: SortKey): T[] => {
  if (key === "relevance") return products;
  const indexed = products.map((p, i) => ({ p, i }));
  const by: Record<Exclude<SortKey, "relevance">, (a: T, b: T) => number> = {
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    discount: (a, b) => discountPercent(b) - discountPercent(a),
    newest: (a, b) => timeOf(b) - timeOf(a),
  };
  const cmp = by[key];
  return indexed.sort((x, y) => cmp(x.p, y.p) || x.i - y.i).map((x) => x.p);
};

export const MAX_FEATURED = 8;

/** Produits de la vitrine : ceux marqués « vedette » (8 au plus), sinon les 4 premiers. */
export const pickFeatured = <T extends CatalogProduct>(products: T[]): { items: T[]; isCurated: boolean } => {
  const flagged = products.filter((p) => p.is_featured);
  if (flagged.length > 0) return { items: flagged.slice(0, MAX_FEATURED), isCurated: true };
  return { items: products.slice(0, 4), isCurated: false };
};

export interface CatalogInput<T extends CatalogProduct> {
  products: T[];
  featured: T[];
  category: string;
  query: string;
  sort: SortKey;
  featuredEnabled: boolean;
  showAllOnHome: boolean;
}

export interface CatalogView<T extends CatalogProduct> {
  /** Produits listés dans la section catalogue. */
  items: T[];
  /** La section catalogue doit exister (sinon une partie du catalogue serait inaccessible). */
  showCatalog: boolean;
  /** La vitrine « vedette » est masquée pendant une recherche ou un filtre. */
  showFeatured: boolean;
  isFiltering: boolean;
  /** Produits non montrés en vitrine, listés « sans doublon » : sert au titre « Plus de produits ». */
  excludesFeatured: boolean;
}

/**
 * Règle de l'accueil :
 *  - recherche ou catégorie active : on liste tous les résultats, la vitrine s'efface ;
 *  - « Tous les produits » activé (ou vitrine désactivée) : catalogue complet ;
 *  - sinon : le catalogue ne contient que ce que la vitrine n'a pas montré. S'il n'y a rien de plus,
 *    la section n'apparaît pas. Avant, seuls 4 produits étaient atteignables.
 */
export const buildCatalogView = <T extends CatalogProduct>(input: CatalogInput<T>): CatalogView<T> => {
  const { products, featured, category, query, sort, featuredEnabled, showAllOnHome } = input;
  const q = query.trim();
  const isFiltering = q.length > 0 || category !== "all";
  const featuredIds = new Set(featured.map((p) => p.id));

  let pool = products.filter(
    (p) => (category === "all" || p.category === category) && matchesQuery(p, q)
  );

  const featuredShown = featuredEnabled && featured.length > 0 && !isFiltering;
  const full = isFiltering || showAllOnHome || !featuredShown;
  if (!full) pool = pool.filter((p) => !featuredIds.has(p.id));

  const items = sortProducts(pool, sort);
  return {
    items,
    showCatalog: isFiltering || items.length > 0 || !featuredShown,
    showFeatured: featuredShown,
    isFiltering,
    excludesFeatured: !full,
  };
};

/** Catégories avec leur effectif, dans l'ordre d'apparition. « all » en tête. */
export const categoryCounts = (products: CatalogProduct[]): { name: string; count: number }[] => {
  const map = new Map<string, number>();
  for (const p of products) {
    const c = (p.category ?? "").trim();
    if (c) map.set(c, (map.get(c) ?? 0) + 1);
  }
  return [{ name: "all", count: products.length }, ...Array.from(map, ([name, count]) => ({ name, count }))];
};

// ---------------------------------------------------------------------------------------------
// Panier persistant : on ne stocke que l'identité des lignes, jamais les prix (le serveur recalcule).
// ---------------------------------------------------------------------------------------------

export interface StoredCartLine {
  product_id: string;
  quantity: number;
  selected_variants: Record<string, string> | null;
}

export const serializeCart = (
  cart: { product: { id: string }; quantity: number; selectedVariants?: Record<string, string> | null }[]
): StoredCartLine[] =>
  cart.map((l) => ({
    product_id: l.product.id,
    quantity: l.quantity,
    selected_variants: l.selectedVariants && Object.keys(l.selectedVariants).length > 0 ? l.selectedVariants : null,
  }));

const MAX_LINE_QTY = 99;

/** Relie les lignes stockées aux produits actuels : produit supprimé ou dépublié = ligne écartée. */
export const restoreCart = <P extends { id: string }>(
  raw: unknown,
  products: P[]
): { product: P; quantity: number; selectedVariants: Record<string, string> | null }[] => {
  if (!Array.isArray(raw)) return [];
  const byId = new Map(products.map((p) => [p.id, p]));
  const out: { product: P; quantity: number; selectedVariants: Record<string, string> | null }[] = [];
  for (const line of raw as Partial<StoredCartLine>[]) {
    const product = line && typeof line.product_id === "string" ? byId.get(line.product_id) : undefined;
    const qty = Math.floor(Number(line?.quantity));
    if (!product || !Number.isFinite(qty) || qty < 1) continue;
    const sv = line.selected_variants && typeof line.selected_variants === "object" ? line.selected_variants : null;
    out.push({ product, quantity: Math.min(qty, MAX_LINE_QTY), selectedVariants: sv });
  }
  return out;
};
