// src/hooks/useSeoIntelligence.ts
// Hook React du module ECOMFY SEO INTELLIGENCE : audits, Search Console (cache), PageSpeed, correctifs et exports.

import { useState, useEffect, useCallback, useRef } from "react";
import { GscMetricData, PageSpeedResult, SeoAuditResult, GscQueryRow, GscPageRow, GscOpportunity, SeoIssue } from "@/types/seoIntelligence";
import { SeoAuditService, DEFAULT_SEO_WEIGHTS } from "@/services/seoAuditService";
import { SeoFixService } from "@/services/seoFixService";
import { GscService } from "@/services/gscService";
import { PageSpeedService } from "@/services/pageSpeedService";
import { SeoReportService } from "@/services/seoReportService";
import { getShopDomain, getShopHomeUrl, getShopName, seoDb } from "@/lib/seoShop";
import { toast } from "sonner";

export type SeoPeriod = GscMetricData["period"];

export interface SeoShopData {
  shop: any;
  products: any[];
}

const emptyMetrics = (period: SeoPeriod): GscMetricData => ({
  clicks: null,
  impressions: null,
  ctr: null,
  position: null,
  source: "Google Search Console",
  lastSyncedAt: null,
  period,
});

const toNumberOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

function rowToAudit(row: any, shop: any): SeoAuditResult {
  return {
    id: row.id,
    shopId: row.shop_id,
    scannedDomain: row.scanned_domain || getShopDomain(shop),
    overallScore: Number(row.overall_score) || 0,
    technicalScore: Number(row.technical_score) || 0,
    performanceScore: toNumberOrNull(row.performance_score),
    contentScore: Number(row.content_score) || 0,
    indexabilityScore: Number(row.indexability_score) || 0,
    metadataScore: Number(row.metadata_score) || 0,
    mobileScore: toNumberOrNull(row.mobile_score),
    issuesCriticalCount: Number(row.issues_critical) || 0,
    issuesImportantCount: Number(row.issues_important) || 0,
    issuesOptimizationCount: Number(row.issues_optimization) || 0,
    issues: (row.audit_data?.issues as SeoIssue[]) || [],
    auditedAt: row.created_at,
    source: "Algorithme Ecomfy",
  };
}

/**
 * @param onDataChanged appelé après une correction/sauvegarde : doit recharger la boutique et ses produits
 *                      et renvoyer les données fraîches pour relancer l'audit dessus.
 */
export function useSeoIntelligence(
  shop: any,
  products: any[] = [],
  onDataChanged?: () => Promise<SeoShopData | void>
) {
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [isAnalyzingPageSpeed, setIsAnalyzingPageSpeed] = useState<boolean>(false);
  const [isApplyingFix, setIsApplyingFix] = useState<boolean>(false);
  const [isSyncingGsc, setIsSyncingGsc] = useState<boolean>(false);
  /** Message si les tables d'historique/cache sont inaccessibles (migration non déployée, droits...). */
  const [storageError, setStorageError] = useState<string | null>(null);

  const [currentAudit, setCurrentAudit] = useState<SeoAuditResult | null>(null);
  const [auditHistory, setAuditHistory] = useState<SeoAuditResult[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<SeoPeriod>("28d");
  const [gscMetrics, setGscMetrics] = useState<GscMetricData>(emptyMetrics("28d"));
  const [queries, setQueries] = useState<GscQueryRow[]>([]);
  const [pages, setPages] = useState<GscPageRow[]>([]);
  const [opportunities, setOpportunities] = useState<GscOpportunity[]>([]);
  const [mobilePageSpeed, setMobilePageSpeed] = useState<PageSpeedResult | null>(null);
  const [desktopPageSpeed, setDesktopPageSpeed] = useState<PageSpeedResult | null>(null);
  const [gscConnection, setGscConnection] = useState<{
    isConnected: boolean;
    propertyId: string | null;
    lastSyncedAt: string | null;
  }>({ isConnected: false, propertyId: null, lastSyncedAt: null });

  // Ignore les réponses d'un chargement périmé (changement rapide de boutique ou de période)
  const loadSeq = useRef(0);
  const shopId: string | undefined = shop?.id;

  const loadSeoData = useCallback(async () => {
    const seq = ++loadSeq.current;
    const isStale = () => seq !== loadSeq.current;

    if (!shopId) {
      setCurrentAudit(null);
      setAuditHistory([]);
      setQueries([]);
      setPages([]);
      setOpportunities([]);
      setGscMetrics(emptyMetrics(selectedPeriod));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setStorageError(null);

      const conn = await GscService.getConnectionStatus(shopId);
      if (isStale()) return;
      setGscConnection({ isConnected: conn.isConnected, propertyId: conn.propertyId, lastSyncedAt: conn.lastSyncedAt });

      // Historique des audits
      const { data: auditData, error: auditError } = await seoDb
        .from("shop_seo_audits")
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (isStale()) return;

      if (auditError) {
        setStorageError(auditError.message);
        setCurrentAudit(null);
        setAuditHistory([]);
      } else {
        const history = (auditData || []).map((row: any) => rowToAudit(row, shop));
        setAuditHistory(history);
        setCurrentAudit(history[0] ?? null);
      }

      // Données Search Console en cache
      if (conn.isConnected) {
        const { data: cachedQueries, error: queriesError } = await seoDb
          .from("shop_seo_queries_cache")
          .select("query, clicks, impressions, ctr, position")
          .eq("shop_id", shopId)
          .eq("period", selectedPeriod)
          .order("clicks", { ascending: false });
        const cachedPages = await GscService.getCachedPages(shopId, selectedPeriod);
        if (isStale()) return;

        const rows: GscQueryRow[] = queriesError
          ? []
          : (cachedQueries || []).map((r: any) => ({
              query: r.query,
              clicks: Number(r.clicks) || 0,
              impressions: Number(r.impressions) || 0,
              ctr: Number(r.ctr) || 0,
              position: Number(r.position) || 0,
            }));

        setQueries(rows);
        setPages(cachedPages);
        setOpportunities(GscService.extractOpportunities(rows));
        setGscMetrics(GscService.computeMetrics(rows, selectedPeriod, conn.lastSyncedAt));
      } else {
        setQueries([]);
        setPages([]);
        setOpportunities([]);
        setGscMetrics(emptyMetrics(selectedPeriod));
      }
    } catch (e) {
      if (isStale()) return;
      console.error("[useSeoIntelligence] Error loading SEO data", e);
      setStorageError(e instanceof Error ? e.message : "Chargement des données SEO impossible.");
    } finally {
      if (!isStale()) setLoading(false);
    }
    // shop est lu uniquement pour le domaine affiché des anciens audits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, selectedPeriod]);

  useEffect(() => {
    loadSeoData();
  }, [loadSeoData]);

  // Les mesures PageSpeed appartiennent à une boutique : on les efface quand elle change
  useEffect(() => {
    setMobilePageSpeed(null);
    setDesktopPageSpeed(null);
  }, [shopId]);

  /** Lance l'audit technique. `data` permet d'auditer des données fraîchement rechargées. */
  const runAudit = async (data?: SeoShopData) => {
    const targetShop = data?.shop ?? shop;
    const targetProducts = data?.products ?? products;
    if (!targetShop) return;

    try {
      setIsAuditing(true);
      toast.info("Analyse SEO technique en cours...");

      const audit = await SeoAuditService.runRealTechnicalAudit(targetShop, targetProducts, DEFAULT_SEO_WEIGHTS, {
        mobile: mobilePageSpeed,
        desktop: desktopPageSpeed,
      });

      let saved = false;
      if (targetShop.id) {
        const { data: inserted, error } = await seoDb
          .from("shop_seo_audits")
          .insert({
            shop_id: targetShop.id,
            overall_score: audit.overallScore,
            technical_score: audit.technicalScore,
            performance_score: audit.performanceScore,
            content_score: audit.contentScore,
            indexability_score: audit.indexabilityScore,
            metadata_score: audit.metadataScore,
            mobile_score: audit.mobileScore,
            issues_critical: audit.issuesCriticalCount,
            issues_important: audit.issuesImportantCount,
            issues_optimization: audit.issuesOptimizationCount,
            audit_data: { issues: audit.issues },
            scanned_domain: audit.scannedDomain,
          })
          .select("id")
          .maybeSingle();

        if (error) {
          console.error("[useSeoIntelligence] Audit non enregistré", error);
        } else {
          saved = true;
          audit.id = inserted?.id;
        }
      }

      setCurrentAudit(audit);
      if (saved) setAuditHistory((prev) => [audit, ...prev].slice(0, 10));

      if (saved) {
        toast.success(`Audit terminé ! Score SEO Ecomfy : ${audit.overallScore}/100`);
      } else {
        toast.warning(`Audit terminé (${audit.overallScore}/100) mais non enregistré dans l'historique.`);
      }
    } catch (err) {
      console.error("[useSeoIntelligence] Audit failed", err);
      toast.error("Erreur lors de l'exécution de l'audit technique.");
    } finally {
      setIsAuditing(false);
    }
  };

  /** Analyse PageSpeed Insights (mobile + desktop) de la page d'accueil. */
  const runPageSpeedAnalysis = async () => {
    if (!shop) return;
    const url = getShopHomeUrl(shop);
    try {
      setIsAnalyzingPageSpeed(true);
      toast.info("Analyse PageSpeed Insights (Mobile & Desktop) en cours...");

      const [mob, desk] = await Promise.all([
        PageSpeedService.analyzeUrl(url, "mobile"),
        PageSpeedService.analyzeUrl(url, "desktop"),
      ]);

      setMobilePageSpeed(mob);
      setDesktopPageSpeed(desk);

      if (mob.performanceScore === null && desk.performanceScore === null) {
        toast.error(mob.error || desk.error || "Impossible de récupérer les métriques PageSpeed.");
      } else {
        toast.success(
          `PageSpeed Mobile : ${mob.performanceScore ?? "N/A"}/100 | Desktop : ${desk.performanceScore ?? "N/A"}/100. Relancez l'audit pour l'intégrer au score.`
        );
      }
    } catch {
      toast.error("Impossible de récupérer les métriques PageSpeed.");
    } finally {
      setIsAnalyzingPageSpeed(false);
    }
  };

  /** Recharge boutique + produits puis relance l'audit sur les données fraîches. */
  const refreshAfterChange = async () => {
    const fresh = onDataChanged ? await onDataChanged() : undefined;
    await runAudit(fresh || undefined);
  };

  /** Applique la correction automatique d'une anomalie. */
  const applyFix = async (issue: SeoIssue): Promise<boolean> => {
    if (!shop?.id) return false;
    try {
      setIsApplyingFix(true);
      await SeoFixService.applyFix(issue, shop, products);
      toast.success("Correction appliquée avec succès !");
      await refreshAfterChange();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "La correction n'a pas pu être appliquée.");
      return false;
    } finally {
      setIsApplyingFix(false);
    }
  };

  /** Enregistre le titre et la description SEO saisis dans l'éditeur de balises. */
  const saveMeta = async (seoTitle: string, seoDescription: string): Promise<boolean> => {
    if (!shop?.id) return false;
    try {
      setIsApplyingFix(true);
      await SeoFixService.saveShopMeta(shop.id, { seo_title: seoTitle, seo_description: seoDescription });
      toast.success("Configuration SEO enregistrée avec succès !");
      await refreshAfterChange();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
      return false;
    } finally {
      setIsApplyingFix(false);
    }
  };

  /** Importe les données Search Console de la période sélectionnée, puis recharge l'affichage. */
  const syncGsc = async () => {
    if (!shop?.id) return;
    try {
      setIsSyncingGsc(true);
      const res = await GscService.sync(shop.id, selectedPeriod);
      toast.success(`Synchronisation terminée : ${res.queries} mots-clés, ${res.pages} pages.`);
      await loadSeoData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Synchronisation Search Console impossible.");
    } finally {
      setIsSyncingGsc(false);
    }
  };

  /** Démarre l'autorisation Google (redirection). */
  const connectGsc = async () => {
    if (!shop?.id) return;
    try {
      window.location.assign(await GscService.getAuthUrl(shop.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connexion Google impossible.");
    }
  };

  const disconnectGsc = async () => {
    if (!shop?.id) return;
    try {
      await GscService.disconnect(shop.id);
      toast.success("Search Console déconnecté.");
      await loadSeoData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Déconnexion impossible.");
    }
  };

  /** Valide la propriété choisie après l'autorisation, puis lance une première synchronisation. */
  const selectGscProperty = async (siteUrl: string): Promise<boolean> => {
    if (!shop?.id) return false;
    try {
      await GscService.setProperty(shop.id, siteUrl);
      toast.success("Search Console connecté.");
      await loadSeoData();
      await GscService.sync(shop.id, selectedPeriod).catch(() => undefined);
      await loadSeoData();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Propriété refusée.");
      return false;
    }
  };

  const exportPdfReport = () => {
    if (!shop) return;
    const ok = SeoReportService.generatePdfReport(
      getShopName(shop),
      getShopDomain(shop),
      currentAudit,
      gscMetrics,
      mobilePageSpeed
    );
    if (!ok) toast.error("Autorisez les fenêtres pop-up pour générer le rapport PDF.");
  };

  const exportCsvQueries = () => {
    if (!SeoReportService.exportQueriesToCsv(queries)) {
      toast.info("Aucun mot-clé à exporter pour le moment.");
    }
  };

  return {
    loading,
    isAuditing,
    isAnalyzingPageSpeed,
    isApplyingFix,
    isSyncingGsc,
    storageError,
    currentAudit,
    auditHistory,
    gscMetrics,
    queries,
    pages,
    opportunities,
    mobilePageSpeed,
    desktopPageSpeed,
    selectedPeriod,
    setSelectedPeriod,
    gscConnection,
    runAudit: () => runAudit(),
    runPageSpeedAnalysis,
    applyFix,
    saveMeta,
    syncGsc,
    connectGsc,
    disconnectGsc,
    selectGscProperty,
    exportPdfReport,
    exportCsvQueries,
    refreshData: loadSeoData,
  };
}
