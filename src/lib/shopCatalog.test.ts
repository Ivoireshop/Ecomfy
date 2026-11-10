import { describe, it, expect } from "vitest";
import {
  buildCatalogView,
  categoryCounts,
  discountPercent,
  lowStockCount,
  matchesQuery,
  normalizeText,
  pickFeatured,
  restoreCart,
  serializeCart,
  sortProducts,
  type CatalogProduct,
} from "./shopCatalog";

const p = (id: string, price: number, extra: Partial<CatalogProduct> = {}): CatalogProduct => ({
  id,
  name: `Produit ${id}`,
  price,
  ...extra,
});

describe("recherche", () => {
  it("ignore accents, casse et espaces", () => {
    expect(normalizeText("  CRÈME   Visage ")).toBe("creme visage");
    expect(matchesQuery(p("a", 1, { name: "Crème Visage" }), "creme")).toBe(true);
  });
  it("exige tous les mots, dans n'importe quel ordre, sur nom, catégorie et accroche", () => {
    const prod = p("a", 1, { name: "Sérum", category: "Soins", short_description: "Visage éclatant" });
    expect(matchesQuery(prod, "visage serum")).toBe(true);
    expect(matchesQuery(prod, "soins eclatant")).toBe(true);
    expect(matchesQuery(prod, "serum cheveux")).toBe(false);
  });
  it("une saisie vide ne filtre rien", () => {
    expect(matchesQuery(p("a", 1), "   ")).toBe(true);
  });
});

describe("remise et stock", () => {
  it("calcule la remise et ignore les prix barrés incohérents", () => {
    expect(discountPercent({ price: 10500, compare_at_price: 21000 })).toBe(50);
    expect(discountPercent({ price: 100, compare_at_price: 100 })).toBe(0);
    expect(discountPercent({ price: 100, compare_at_price: null })).toBe(0);
    expect(discountPercent({ price: 100, compare_at_price: 50 })).toBe(0);
    expect(discountPercent({ price: 999, compare_at_price: 1000 })).toBe(1);
  });
  it("ne signale le stock que de 1 à 5", () => {
    expect(lowStockCount({ stock_quantity: 3 })).toBe(3);
    expect(lowStockCount({ stock_quantity: 0 })).toBeNull();
    expect(lowStockCount({ stock_quantity: 6 })).toBeNull();
    expect(lowStockCount({ stock_quantity: null })).toBeNull();
  });
});

describe("tri", () => {
  const list = [
    p("a", 300, { compare_at_price: 400, created_at: "2026-01-01" }),
    p("b", 100, { created_at: "2026-03-01" }),
    p("c", 200, { compare_at_price: 400, created_at: "2026-02-01" }),
  ];
  it("pertinence : ordre du marchand inchangé", () => {
    expect(sortProducts(list, "relevance").map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
  it("prix", () => {
    expect(sortProducts(list, "price_asc").map((x) => x.id)).toEqual(["b", "c", "a"]);
    expect(sortProducts(list, "price_desc").map((x) => x.id)).toEqual(["a", "c", "b"]);
  });
  it("promotions d'abord, puis ordre d'origine à égalité ; ne modifie pas l'entrée", () => {
    expect(sortProducts(list, "discount").map((x) => x.id)).toEqual(["c", "a", "b"]);
    expect(list.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
  it("nouveautés : dates absentes en dernier", () => {
    const withMissing = [p("x", 1), ...list];
    expect(sortProducts(withMissing, "newest").map((x) => x.id)).toEqual(["b", "c", "a", "x"]);
  });
});

describe("vitrine", () => {
  const many = Array.from({ length: 10 }, (_, i) => p(String(i), 100 + i));
  it("sans vedette : 4 premiers", () => {
    const r = pickFeatured(many);
    expect(r.items).toHaveLength(4);
    expect(r.isCurated).toBe(false);
  });
  it("avec vedettes : jusqu'à 8, pas seulement 4", () => {
    const flagged = many.map((x, i) => ({ ...x, is_featured: i < 6 }));
    expect(pickFeatured(flagged).items).toHaveLength(6);
    const all = many.map((x) => ({ ...x, is_featured: true }));
    expect(pickFeatured(all).items).toHaveLength(8);
  });
});

describe("catalogue de l'accueil", () => {
  const products = Array.from({ length: 8 }, (_, i) =>
    p(String(i), 100 + i, { category: i % 2 ? "Soins" : "Corps" })
  );
  const featured = products.slice(0, 4);
  const base = { products, featured, category: "all", query: "", sort: "relevance" as const, featuredEnabled: true, showAllOnHome: false };

  it("régression : les produits hors vitrine restent atteignables, sans doublon", () => {
    const v = buildCatalogView(base);
    expect(v.showFeatured).toBe(true);
    expect(v.showCatalog).toBe(true);
    expect(v.excludesFeatured).toBe(true);
    expect(v.items.map((x) => x.id)).toEqual(["4", "5", "6", "7"]);
  });
  it("pas de section catalogue quand la vitrine montre déjà tout", () => {
    const v = buildCatalogView({ ...base, products: featured });
    expect(v.showCatalog).toBe(false);
  });
  it("« Tous les produits » activé : catalogue complet", () => {
    const v = buildCatalogView({ ...base, showAllOnHome: true });
    expect(v.items).toHaveLength(8);
    expect(v.excludesFeatured).toBe(false);
  });
  it("vitrine désactivée : catalogue complet", () => {
    const v = buildCatalogView({ ...base, featuredEnabled: false });
    expect(v.showFeatured).toBe(false);
    expect(v.items).toHaveLength(8);
  });
  it("régression : la recherche agit même si la vitrine était seule visible", () => {
    const v = buildCatalogView({ ...base, query: "produit 1" });
    expect(v.isFiltering).toBe(true);
    expect(v.showFeatured).toBe(false);
    expect(v.showCatalog).toBe(true);
    expect(v.items.map((x) => x.id)).toEqual(["1"]);
  });
  it("recherche sans résultat : la section reste affichée pour le message vide", () => {
    const v = buildCatalogView({ ...base, query: "zzz" });
    expect(v.items).toHaveLength(0);
    expect(v.showCatalog).toBe(true);
  });
  it("filtre par catégorie", () => {
    const v = buildCatalogView({ ...base, category: "Soins" });
    expect(v.items.map((x) => x.id)).toEqual(["1", "3", "5", "7"]);
  });
  it("aucun produit du tout : la section catalogue s'affiche (état vide)", () => {
    const v = buildCatalogView({ ...base, products: [], featured: [] });
    expect(v.showCatalog).toBe(true);
    expect(v.showFeatured).toBe(false);
  });
  it("catégories avec effectifs", () => {
    expect(categoryCounts(products)).toEqual([
      { name: "all", count: 8 },
      { name: "Corps", count: 4 },
      { name: "Soins", count: 4 },
    ]);
  });
});

describe("panier persistant", () => {
  const catalog = [{ id: "a" }, { id: "b" }];
  it("ne stocke que l'identité des lignes (jamais de prix)", () => {
    const line = { product: { id: "a", price: 5 }, quantity: 2, selectedVariants: { Taille: "M" } };
    const stored = serializeCart([line]);
    expect(stored).toEqual([{ product_id: "a", quantity: 2, selected_variants: { Taille: "M" } }]);
    expect(JSON.stringify(stored)).not.toContain("price");
  });
  it("restaure avec les produits actuels et écarte les produits disparus", () => {
    const out = restoreCart(
      [
        { product_id: "a", quantity: 2, selected_variants: null },
        { product_id: "zzz", quantity: 1, selected_variants: null },
      ],
      catalog
    );
    expect(out).toHaveLength(1);
    expect(out[0].product).toBe(catalog[0]);
  });
  it("résiste aux données corrompues et plafonne la quantité", () => {
    expect(restoreCart("n'importe quoi", catalog)).toEqual([]);
    expect(restoreCart([null, { product_id: "a", quantity: -3 }, { product_id: "a", quantity: "x" }], catalog)).toEqual([]);
    expect(restoreCart([{ product_id: "b", quantity: 5000 }], catalog)[0].quantity).toBe(99);
  });
});
