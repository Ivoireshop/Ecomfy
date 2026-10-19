// Prix d'une ligne de commande avec offre en lot. Même règle que le trigger SQL enforce_order_item_price
// (migration 20261015120000) et que supabase/functions/_shared/pricing.ts : le lot ne s'applique que si la quantité
// atteint celle du lot, au prix unitaire price / quantity du lot ; sinon prix de base.

export type BundleOffer = { quantity: number; price: number; label?: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function priceLine(
  product: { price?: number | null; bundle_offers?: unknown },
  bundleIdx: number | null,
  quantity: number,
): { total: number; bundleIndex: number | null; offer?: BundleOffer } {
  const base = Number(product.price) || 0;
  const offers = Array.isArray(product.bundle_offers) ? (product.bundle_offers as BundleOffer[]) : [];
  const offer = bundleIdx !== null ? offers[bundleIdx] : undefined;
  const oq = Number(offer?.quantity);
  const op = Number(offer?.price);
  if (offer && Number.isFinite(oq) && Number.isFinite(op) && oq >= 1 && op >= 0 && quantity >= oq) {
    return { total: round2((op * quantity) / oq), bundleIndex: bundleIdx, offer };
  }
  return { total: round2(base * quantity), bundleIndex: null };
}
