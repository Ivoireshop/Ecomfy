import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget call to the seo-auto-index edge function.
 * Re-submits the dynamic sitemap to Google Search Console and pings
 * public sitemap endpoints so updated content is indexed quickly.
 *
 * Never throws — SEO indexation must never block a save.
 */
export function triggerSeoAutoIndex(url?: string): void {
  try {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL || "https://ecomfy.cloud";
    const sitemapUrl = `${baseUrl}/functions/v1/dynamic-sitemap`;
    supabase.functions
      .invoke("seo-auto-index", { body: { url, sitemapUrl } })
      .catch((e) => console.warn("[seo-auto-index] failed", e));
  } catch (e) {
    console.warn("[seo-auto-index] threw", e);
  }
}
