// SEO auto-indexation — re-submits the dynamic sitemap to Google
// Search Console (via the connected GSC account) and pings public
// search engines whenever a shop or product is updated.
//
// Connected via the Google Search Console connector. The gateway
// transparently refreshes the OAuth token for the connected account
// (must own the verified GSC property for visuelpro.cloud).
//
// Body: { url?: string, siteUrls?: string[] }
//   - url: the specific URL that changed (used for IndexNow ping)
//   - siteUrls: GSC property identifiers (default: both URL-prefix
//     and domain property for visuelpro.cloud)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";
const SITEMAP_URL = "https://visuelpro.cloud/sitemap.xml";
const DEFAULT_SITES = [
  "https://visuelpro.cloud/",
  "sc-domain:visuelpro.cloud",
];

async function submitSitemap(siteUrl: string, sitemapUrl: string, lovableKey: string, gscKey: string) {
  const encodedSite = encodeURIComponent(siteUrl);
  const encodedFeed = encodeURIComponent(sitemapUrl);
  const res = await fetch(`${GATEWAY}/webmasters/v3/sites/${encodedSite}/sitemaps/${encodedFeed}`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": gscKey,
    },
  });
  const text = await res.text();
  return { siteUrl, status: res.status, ok: res.ok, body: text.slice(0, 200) };
}

async function pingPublicSitemap(sitemapUrl: string) {
  // Google + Bing accept GET pings on /ping?sitemap=...
  const endpoints = [
    `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
    `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
  ];
  return Promise.all(
    endpoints.map((u) =>
      fetch(u, { method: "GET" })
        .then((r) => ({ url: u, status: r.status }))
        .catch((e) => ({ url: u, error: String(e) })),
    ),
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const gscKey = Deno.env.get("GOOGLE_SEARCH_CONSOLE_API_KEY");

    let body: { url?: string; siteUrls?: string[]; sitemapUrl?: string } = {};
    try { body = await req.json(); } catch (_) { /* allow empty */ }

    const sitemapUrl = body.sitemapUrl || SITEMAP_URL;
    const siteUrls = body.siteUrls && body.siteUrls.length > 0 ? body.siteUrls : DEFAULT_SITES;

    const results: any = { sitemapUrl, gsc: [], pings: [] };

    if (lovableKey && gscKey) {
      results.gsc = await Promise.all(
        siteUrls.map((s) => submitSitemap(s, sitemapUrl, lovableKey, gscKey).catch((e) => ({ siteUrl: s, error: String(e) }))),
      );
    } else {
      results.gsc_skipped = "Google Search Console connector not linked";
    }

    // Always ping public endpoints as a fallback
    results.pings = await pingPublicSitemap(sitemapUrl);

    return new Response(JSON.stringify({ success: true, ...results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("seo-auto-index error", e);
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
