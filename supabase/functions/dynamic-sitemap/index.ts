// Dynamic sitemap edge function — returns an up-to-date XML sitemap
// covering the visuelpro.cloud marketing pages, all published shops
// and all published products. No JWT required (search engines must
// be able to fetch it anonymously).
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const BASE_URL = "https://visuelpro.cloud";

const STATIC_PAGES: { path: string; changefreq: string; priority: string }[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/visuels-publicitaires", changefreq: "weekly", priority: "0.9" },
  { path: "/videos-publicitaires", changefreq: "weekly", priority: "0.9" },
  { path: "/sites-vitrines", changefreq: "weekly", priority: "0.9" },
  { path: "/boutiques-ecommerce", changefreq: "weekly", priority: "0.9" },
  { path: "/demo", changefreq: "monthly", priority: "0.7" },
  { path: "/tutorial", changefreq: "monthly", priority: "0.6" },
  { path: "/blog", changefreq: "weekly", priority: "0.6" },
  { path: "/api-documentation", changefreq: "monthly", priority: "0.5" },
  { path: "/auth", changefreq: "monthly", priority: "0.5" },
  { path: "/feedback", changefreq: "monthly", priority: "0.4" },
  { path: "/privacy-policy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms-of-service", changefreq: "yearly", priority: "0.3" },
  { path: "/cookies-policy", changefreq: "yearly", priority: "0.3" },
  { path: "/legal-notice", changefreq: "yearly", priority: "0.3" },
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlNode(loc: string, lastmod?: string, changefreq?: string, priority?: string) {
  return [
    "  <url>",
    `    <loc>${escapeXml(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod.split("T")[0]}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
    "  </url>",
  ].filter(Boolean).join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date().toISOString().split("T")[0];
    const urls: string[] = STATIC_PAGES.map((p) =>
      urlNode(`${BASE_URL}${p.path}`, today, p.changefreq, p.priority),
    );

    // Published & activated shops
    const { data: shops } = await supabase
      .from("shops")
      .select("slug, updated_at, custom_domain, domain_status")
      .eq("is_published", true)
      .eq("is_activated", true);

    const shopBaseFor = (s: { slug: string; custom_domain: string | null; domain_status: string | null }) =>
      s.custom_domain && s.domain_status === "active"
        ? `https://${s.custom_domain}`
        : `${BASE_URL}/shop/${s.slug}`;

    const shopIds: Record<string, { base: string; slug: string }> = {};
    if (shops) {
      for (const s of shops as any[]) {
        const base = shopBaseFor(s);
        urls.push(urlNode(base, s.updated_at, "daily", "0.8"));
        shopIds[s.slug] = { base, slug: s.slug };
      }
    }

    // Published products of published shops
    if (shops && shops.length > 0) {
      const { data: products } = await supabase
        .from("products")
        .select("slug, updated_at, shop_id, is_published, shops!inner(slug, is_published, is_activated, custom_domain, domain_status)")
        .eq("is_published", true)
        .eq("shops.is_published", true)
        .eq("shops.is_activated", true);

      if (products) {
        for (const p of products as any[]) {
          const shop = p.shops;
          if (!shop?.slug || !p.slug) continue;
          const base = shop.custom_domain && shop.domain_status === "active"
            ? `https://${shop.custom_domain}`
            : `${BASE_URL}/shop/${shop.slug}`;
          urls.push(urlNode(`${base}/p/${p.slug}`, p.updated_at, "weekly", "0.7"));
        }
      }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;

    return new Response(xml, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=600",
      },
    });
  } catch (e) {
    console.error("dynamic-sitemap error", e);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`,
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/xml; charset=utf-8" } },
    );
  }
});
