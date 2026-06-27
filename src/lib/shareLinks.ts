/**
 * Build a crawler-friendly share URL for a product.
 *
 * Social platforms (WhatsApp, Facebook, Messenger, Telegram, LinkedIn, X,
 * iMessage…) do not execute JavaScript, so the per-route <Helmet> meta tags
 * inside our SPA are invisible to them. The `share-product` edge function
 * returns a tiny HTML page with the correct Open Graph + Twitter Card tags
 * (product image, name, description, shop name) and immediately redirects
 * real browsers to the actual SPA product page.
 *
 * Use this URL anywhere the user copies/shares a product link.
 */
const SUPABASE_PROJECT_ID = "dqlbmtkaamjohgbcjwtw";
const SHARE_BASE = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/share-product`;

export function buildProductShareUrl(params: {
  shopSlug: string;
  productId?: string | null;
  productSlug?: string | null;
}): string {
  const key = params.productSlug || params.productId;
  if (!params.shopSlug || !key) return "https://visuelpro.cloud";
  const u = new URL(SHARE_BASE);
  u.searchParams.set("shop", params.shopSlug);
  u.searchParams.set("product", String(key));
  return u.toString();
}