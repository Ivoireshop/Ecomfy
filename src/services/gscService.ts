// src/services/gscService.ts
// Integration Service for Google Search Console API & OAuth management in Ecomfy.

import { supabase } from "@/integrations/supabase/client";
import { seoDb } from "@/lib/seoShop";
import { GscMetricData, GscOpportunity, GscPageRow, GscProperty, GscQueryRow, UrlInspectionResult } from "@/types/seoIntelligence";

export class GscService {
  /**
   * Fetch OAuth connection status for a shop.
   */
  public static async getConnectionStatus(shopId: string): Promise<{
    isConnected: boolean;
    propertyId: string | null;
    propertyType: string | null;
    lastSyncedAt: string | null;
  }> {
    try {
      const { data, error } = await seoDb
        .from("shop_seo_connections")
        .select("gsc_connected, gsc_property_id, gsc_property_type, last_synced_at")
        .eq("shop_id", shopId)
        .maybeSingle();

      if (error || !data) {
        return { isConnected: false, propertyId: null, propertyType: null, lastSyncedAt: null };
      }

      return {
        isConnected: !!data.gsc_connected,
        propertyId: data.gsc_property_id,
        propertyType: data.gsc_property_type,
        lastSyncedAt: data.last_synced_at,
      };
    } catch {
      return { isConnected: false, propertyId: null, propertyType: null, lastSyncedAt: null };
    }
  }

  /**
   * Verify whether a GSC Property belongs / matches the given shop domain.
   */
  public static verifyDomainMatch(shopDomain: string, propertySiteUrl: string): boolean {
    if (!shopDomain || !propertySiteUrl) return false;

    const cleanShop = shopDomain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/$/, "");
    const cleanProp = propertySiteUrl
      .toLowerCase()
      .replace(/^sc-domain:/, "")
      .replace(/^(https?:\/\/)?(www\.)?/, "")
      .replace(/\/$/, "");

    return cleanShop === cleanProp || cleanShop.endsWith("." + cleanProp) || cleanProp.endsWith("." + cleanShop);
  }

  /**
   * Agrège les requêtes en cache en métriques globales.
   * La position moyenne est pondérée par les impressions (comme dans Search Console).
   * Retourne des valeurs null s'il n'y a aucune donnée : jamais de chiffre inventé.
   */
  public static computeMetrics(
    queries: GscQueryRow[],
    period: GscMetricData["period"],
    lastSyncedAt: string | null
  ): GscMetricData {
    if (!queries || queries.length === 0) {
      return { clicks: null, impressions: null, ctr: null, position: null, source: "Google Search Console", lastSyncedAt, period };
    }

    const clicks = queries.reduce((acc, r) => acc + (Number(r.clicks) || 0), 0);
    const impressions = queries.reduce((acc, r) => acc + (Number(r.impressions) || 0), 0);
    const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;
    const weightedPositions = queries.reduce((acc, r) => acc + (Number(r.position) || 0) * (Number(r.impressions) || 0), 0);
    const position = impressions > 0
      ? Number((weightedPositions / impressions).toFixed(1))
      : Number((queries.reduce((acc, r) => acc + (Number(r.position) || 0), 0) / queries.length).toFixed(1));

    return { clicks, impressions, ctr, position, source: "Google Search Console", lastSyncedAt, period };
  }

  /**
   * Pages Search Console en cache pour une période (vide si aucune synchronisation).
   */
  public static async getCachedPages(shopId: string, period: GscMetricData["period"]): Promise<GscPageRow[]> {
    const { data, error } = await seoDb
      .from("shop_seo_pages_cache")
      .select("page_url, clicks, impressions, ctr, position")
      .eq("shop_id", shopId)
      .eq("period", period)
      .order("clicks", { ascending: false });

    if (error || !data) return [];
    return data.map((r: any) => ({
      url: r.page_url,
      clicks: Number(r.clicks) || 0,
      impressions: Number(r.impressions) || 0,
      ctr: Number(r.ctr) || 0,
      position: Number(r.position) || 0,
    }));
  }

  /**
   * Calculate SEO Keyword Opportunities from real search analytics data.
   */
  public static extractOpportunities(queries: GscQueryRow[]): GscOpportunity[] {
    const opps: GscOpportunity[] = [];

    queries.forEach((q) => {
      // 1. High impressions + Low CTR (< 2.5%)
      if (q.impressions > 100 && q.ctr < 2.5) {
        opps.push({
          type: "high_impressions_low_ctr",
          title: "Fortes impressions mais faible CTR",
          query: q.query,
          clicks: q.clicks,
          impressions: q.impressions,
          ctr: q.ctr,
          position: q.position,
          suggestion: "Optimisez la balise Meta Title et la Meta Description pour inciter davantage aux clics.",
        });
      }

      // 2. Striking Distance (Position 4 à 20)
      if (q.position >= 4 && q.position <= 20 && q.impressions > 50) {
        opps.push({
          type: "striking_distance",
          title: "Mot-clé à portée de la 1ère page (Position 4-20)",
          query: q.query,
          clicks: q.clicks,
          impressions: q.impressions,
          ctr: q.ctr,
          position: q.position,
          suggestion: "Enrichissez le texte de votre fiche produit pour gagner les quelques positions manquantes vers le Top 3.",
        });
      }
    });

    return opps.sort((a, b) => b.impressions - a.impressions).slice(0, 10);
  }

  // ---- Connexion OAuth et synchronisation (jetons uniquement côté serveur) ----

  private static async invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.functions.invoke(fn, { body });
    if (error) throw new Error(error.message || "Service Google indisponible.");
    if (!data?.success) throw new Error(data?.error || "Opération Google refusée.");
    return data as T;
  }

  /** URL d'autorisation Google pour une boutique. */
  public static async getAuthUrl(shopId: string): Promise<string> {
    const res = await this.invoke<{ authUrl: string }>("gsc-oauth-flow", { action: "get_auth_url", shop_id: shopId });
    return res.authUrl;
  }

  /** Échange le code reçu au retour de Google ; renvoie les propriétés Search Console du compte. */
  public static async exchangeCode(code: string, state: string): Promise<{ shopId: string; sites: GscProperty[] }> {
    const res = await this.invoke<{ shopId: string; sites: { siteUrl: string; permissionLevel: string }[] }>(
      "gsc-oauth-flow",
      { action: "exchange_code", code, state }
    );
    return {
      shopId: res.shopId,
      sites: res.sites.map((s) => ({ ...s, isCompatible: s.permissionLevel !== "siteUnverifiedUser" })),
    };
  }

  public static async setProperty(shopId: string, siteUrl: string): Promise<void> {
    await this.invoke("gsc-oauth-flow", { action: "set_property", shop_id: shopId, site_url: siteUrl });
  }

  public static async disconnect(shopId: string): Promise<void> {
    await this.invoke("gsc-oauth-flow", { action: "disconnect", shop_id: shopId });
  }

  /** Importe requêtes et pages de la période dans le cache. */
  public static async sync(shopId: string, period: GscMetricData["period"]): Promise<{ queries: number; pages: number }> {
    return this.invoke("gsc-analytics", { shop_id: shopId, period });
  }

  /**
   * Inspection d'URL. L'API URL Inspection de Google n'est pas encore branchée : on ne renvoie
   * jamais un verdict inventé, uniquement « UNAVAILABLE » avec la raison.
   */
  public static async inspectUrl(shopDomain: string, targetUrl: string): Promise<UrlInspectionResult> {
    const raw = targetUrl.trim();
    const cleanUrl = /^https?:\/\//i.test(raw)
      ? raw
      : `https://${shopDomain}${raw.startsWith("/") ? raw : "/" + raw}`;

    return {
      inspectUrl: cleanUrl,
      verdict: "UNAVAILABLE",
      coverageState: "Inspection indisponible",
      indexingState: "Inconnu",
      message:
        "L'inspection en direct nécessite l'API Google URL Inspection, qui n'est pas encore activée. " +
        "Vérifiez l'indexation de cette URL dans Google Search Console (outil « Inspection de l'URL »).",
      source: "Google Search Console URL Inspection API",
    };
  }
}
