export type ProductSectionKey =
  | "countdown"
  | "stock"
  | "short_description"
  | "variants"
  | "bundle_offers"
  | "long_description";

export type ProductImageLayout = "image_left" | "image_right";

export interface ProductSectionOrder {
  layout?: ProductImageLayout;
  blocks: ProductSectionKey[];
}

export const DEFAULT_PRODUCT_BLOCKS: ProductSectionKey[] = [
  "countdown",
  "stock",
  "short_description",
  "bundle_offers",
  "variants",
  "long_description",
];

export const PRODUCT_SECTION_LABELS: Record<ProductSectionKey, string> = {
  countdown: "Compte à rebours",
  stock: "Barre d'urgence stock",
  short_description: "Description courte",
  variants: "Variantes (taille, couleur…)",
  bundle_offers: "Offres en lot (variantes de prix)",
  long_description: "Description détaillée",
};

export function normalizeSectionOrder(raw: any): ProductSectionOrder {
  const layout: ProductImageLayout =
    raw?.layout === "image_right" ? "image_right" : "image_left";
  const allKeys = new Set<ProductSectionKey>(DEFAULT_PRODUCT_BLOCKS);
  const rawBlocks: any[] = Array.isArray(raw?.blocks)
    ? raw.blocks
    : Array.isArray(raw)
    ? raw
    : [];
  const ordered: ProductSectionKey[] = [];
  for (const k of rawBlocks) {
    if (typeof k === "string" && allKeys.has(k as ProductSectionKey) && !ordered.includes(k as ProductSectionKey)) {
      ordered.push(k as ProductSectionKey);
    }
  }
  for (const k of DEFAULT_PRODUCT_BLOCKS) {
    if (!ordered.includes(k)) ordered.push(k);
  }
  return { layout, blocks: ordered };
}