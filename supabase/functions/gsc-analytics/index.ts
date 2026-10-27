// supabase/functions/gsc-analytics/index.ts
// Synchronise les requêtes et pages réelles de Google Search Console vers le cache de la boutique
// (shop_seo_queries_cache / shop_seo_pages_cache). Réservé au propriétaire de la boutique.
//
// POST { shop_id, period: '7d' | '28d' | '3m' | '6m' | '12m' } → { queries, pages, syncedAt }
//
// Les CTR sont stockés en pourcentage (comme l'affiche l'application), les positions avec 1 décimale.

import { takeRateLimit } from "../_shared/rate-limit.ts";
import {
  adminClient, corsHeaders, fail, getUserId, getValidAccessToken, json, loadConnection, ownsShop,
} from "../_shared/gsc.ts";

const PERIOD_DAYS: Record<string, number> = { "7d": 7, "28d": 28, "3m": 90, "6m": 180, "12m": 365 };
const ROW_LIMIT = 1000;
const CHUNK = 500;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

async function query(site: string, token: string, dimension: "query" | "page", start: string, end: string) {
  const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ startDate: start, endDate: end, dimensions: [dimension], rowLimit: ROW_LIMIT }),
  });
  if (!res.ok) throw new Error(`Erreur API Search Console (${res.status})`);
  const data = await res.json();
  return (data.rows || []) as { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = adminClient();
  let shopId = "";

  try {
    const userId = await getUserId(req);
    if (!userId) return fail("Connectez-vous pour synchroniser Search Console.");

    let body: any = {};
    try { body = await req.json(); } catch (_) { /* corps vide */ }
    shopId = String(body.shop_id || "");
    const period = String(body.period || "28d");
    const days = PERIOD_DAYS[period];
    if (!days) return fail("Période invalide.");
    if (!(await ownsShop(admin, userId, shopId))) return fail("Boutique introuvable.");

    if (!(await takeRateLimit("gsc-sync", userId, 30, 3600))) {
      return fail("Trop de synchronisations. Réessayez dans quelques minutes.");
    }

    const conn = await loadConnection(admin, shopId);
    if (!conn || !conn.gsc_connected || !conn.gsc_property_id) return fail("Search Console n'est pas connecté pour cette boutique.");

    await admin.from("shop_seo_connections").update({ sync_status: "syncing", sync_error: null }).eq("shop_id", shopId);

    const token = await getValidAccessToken(admin, conn);

    // Les données Search Console ont ~2 jours de retard
    const end = new Date(Date.now() - 2 * 86400000);
    const start = new Date(end.getTime() - (days - 1) * 86400000);
    const [queryRows, pageRows] = await Promise.all([
      query(conn.gsc_property_id, token, "query", isoDay(start), isoDay(end)),
      query(conn.gsc_property_id, token, "page", isoDay(start), isoDay(end)),
    ]);

    const syncedAt = new Date().toISOString();
    const shape = (r: (typeof queryRows)[number]) => ({
      clicks: Math.round(r.clicks),
      impressions: Math.round(r.impressions),
      ctr: Number((r.ctr * 100).toFixed(2)),
      position: Number(r.position.toFixed(1)),
      synced_at: syncedAt,
    });

    // Remplace le cache de la période (remplacement complet : pas de lignes périmées)
    await admin.from("shop_seo_queries_cache").delete().eq("shop_id", shopId).eq("period", period);
    await admin.from("shop_seo_pages_cache").delete().eq("shop_id", shopId).eq("period", period);

    const queryInserts = queryRows.map((r) => ({ shop_id: shopId, period, query: r.keys[0], ...shape(r) }));
    const pageInserts = pageRows.map((r) => ({ shop_id: shopId, period, page_url: r.keys[0], ...shape(r) }));
    for (let i = 0; i < queryInserts.length; i += CHUNK) {
      const { error } = await admin.from("shop_seo_queries_cache").insert(queryInserts.slice(i, i + CHUNK));
      if (error) throw new Error("Enregistrement des requêtes impossible.");
    }
    for (let i = 0; i < pageInserts.length; i += CHUNK) {
      const { error } = await admin.from("shop_seo_pages_cache").insert(pageInserts.slice(i, i + CHUNK));
      if (error) throw new Error("Enregistrement des pages impossible.");
    }

    await admin.from("shop_seo_connections").update({ sync_status: "idle", last_synced_at: syncedAt }).eq("shop_id", shopId);
    return json({ success: true, queries: queryInserts.length, pages: pageInserts.length, syncedAt });
  } catch (err) {
    console.error("[gsc-analytics]", err);
    const message = err instanceof Error ? err.message : "Erreur interne.";
    if (shopId) await admin.from("shop_seo_connections").update({ sync_status: "error", sync_error: message }).eq("shop_id", shopId);
    return fail(message);
  }
});
