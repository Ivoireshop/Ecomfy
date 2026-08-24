// share-product — returns crawler-friendly HTML with full Open Graph
// metadata so that WhatsApp, Facebook, Messenger, Telegram, LinkedIn,
// X/Twitter, iMessage… display the correct product image, title and
// description when a VisualPro product link is shared.
//
// Real browsers receive the same HTML but get auto-redirected (JS +
// <meta http-equiv="refresh">) to the actual SPA product page so the
// user experience is unchanged.
//
// Public — no JWT required.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const FALLBACK_OG = "https://ecomfy.cloud/og-default.jpg";
const SITE_NAME = "Ecomfy";
const BASE_URL = "https://ecomfy.cloud";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isHttpUrl(u: string | null | undefined): boolean {
  if (!u) return false;
  return /^https?:\/\//i.test(u);
}

function pickProductImage(product: any, shop: any): string {
  const imgs = Array.isArray(product?.product_images) ? product.product_images : [];
  const primary = imgs.find((i: any) => i?.is_primary)?.image_url;
  const first = imgs[0]?.image_url;
  const candidates = [
    primary,
    first,
    product?.thumbnail_url,
    product?.image_url,
    shop?.logo_url,
    shop?.banner_url,
    shop?.cover_url,
  ];
  for (const c of candidates) {
    if (isHttpUrl(c)) return c as string;
  }
  return FALLBACK_OG;
}

function buildProductUrl(shopSlug: string, productSlug: string | null, productId: string): string {
  if (productSlug) return `${BASE_URL}/shop/${shopSlug}/p/${productSlug}`;
  return `${BASE_URL}/shop/${shopSlug}/product?product=${productId}`;
}

function renderHtml(opts: {
  title: string;
  description: string;
  image: string;
  url: string;
  siteName: string;
  redirectUrl: string;
}): string {
  const { title, description, image, url, siteName, redirectUrl } = opts;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(url)}" />

<meta property="og:type" content="product" />
<meta property="og:site_name" content="${esc(siteName)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:image:secure_url" content="${esc(image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${esc(title)}" />
<meta property="og:locale" content="fr_FR" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(image)}" />
<meta name="twitter:url" content="${esc(url)}" />

<meta http-equiv="refresh" content="0; url=${esc(redirectUrl)}" />
<script>try{window.location.replace(${JSON.stringify(redirectUrl)});}catch(e){}</script>
<style>
  body{font-family:system-ui,sans-serif;background:#0f172a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}
  img{max-width:min(560px,90vw);border-radius:12px;margin-bottom:24px;box-shadow:0 10px 30px rgba(0,0,0,.4)}
  h1{font-size:20px;margin:0 0 8px}
  p{opacity:.8;margin:0 0 24px;max-width:560px}
  a{color:#a78bfa;text-decoration:none;font-weight:600}
</style>
</head>
<body>
  <img src="${esc(image)}" alt="${esc(title)}" />
  <h1>${esc(title)}</h1>
  <p>${esc(description)}</p>
  <a href="${esc(redirectUrl)}">Voir le produit →</a>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    // Accept ?shop=&product= OR /share-product/{shopSlug}/{productSlugOrId}
    let shopSlug = url.searchParams.get("shop");
    let productKey = url.searchParams.get("product");

    if (!shopSlug || !productKey) {
      const parts = url.pathname.split("/").filter(Boolean);
      // parts: [..., "share-product", "{shopSlug}", "{productKey}"]
      const idx = parts.indexOf("share-product");
      if (idx >= 0) {
        shopSlug = shopSlug || parts[idx + 1] || null;
        productKey = productKey || parts[idx + 2] || null;
      }
    }

    if (!shopSlug || !productKey) {
      const html = renderHtml({
        title: "Ecomfy",
        description: "Visuels, vidéos publicitaires, sites vitrines et boutiques e-commerce par IA.",
        image: FALLBACK_OG,
        url: BASE_URL,
        siteName: SITE_NAME,
        redirectUrl: BASE_URL,
      });
      return new Response(html, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let shop: any = null;
    let product: any = null;

    // Try the standard RPC first (treats productKey as slug)
    try {
      const { data: rpc } = await supabase.rpc("get_public_product_page" as any, {
        p_shop_slug: shopSlug,
        p_product_slug: productKey,
      });
      if (rpc && (rpc as any).shop && (rpc as any).product) {
        shop = (rpc as any).shop;
        product = (rpc as any).product;
      }
    } catch (_) { /* fall through */ }

    // Fallback: treat productKey as a UUID
    if (!product) {
      const { data: shopRow } = await supabase
        .from("shops")
        .select("id, slug, business_name, business_description, logo_url, banner_url")
        .eq("slug", shopSlug)
        .maybeSingle();
      if (shopRow) {
        shop = shopRow;
        const { data: prodRow } = await supabase
          .from("products")
          .select("id, name, slug, short_description, description, price, currency, product_images(image_url, is_primary, display_order)")
          .eq("shop_id", (shopRow as any).id)
          .or(`id.eq.${productKey},slug.eq.${productKey}`)
          .eq("is_published", true)
          .maybeSingle();
        if (prodRow) product = prodRow;
      }
    }

    const productName = product?.name || shop?.business_name || "Ecomfy";
    const productDesc = (product?.short_description || product?.description || shop?.business_description ||
      "Découvrez ce produit sur Ecomfy.").toString().replace(/<[^>]+>/g, "").slice(0, 280);
    const image = pickProductImage(product, shop);
    const productSlug = product?.slug || null;
    const productId = product?.id || productKey;
    const redirectUrl = product
      ? buildProductUrl(shop?.slug || shopSlug, productSlug, productId)
      : `${BASE_URL}/shop/${shopSlug}`;
    const title = product ? `${productName} — ${shop?.business_name || SITE_NAME}` : productName;

    const html = renderHtml({
      title,
      description: productDesc,
      image,
      url: redirectUrl,
      siteName: shop?.business_name || SITE_NAME,
      redirectUrl,
    });

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=600, s-maxage=600",
      },
    });
  } catch (e) {
    console.error("share-product error", e);
    const html = renderHtml({
      title: "Ecomfy",
      description: "Visuels, vidéos publicitaires, sites vitrines et boutiques e-commerce par IA.",
      image: FALLBACK_OG,
      url: BASE_URL,
      siteName: SITE_NAME,
      redirectUrl: BASE_URL,
    });
    return new Response(html, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  }
});