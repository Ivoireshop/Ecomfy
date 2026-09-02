// src/hooks/useSeoIntelligence.ts
// Custom React Hook managing ECOMFY SEO INTELLIGENCE state, audit runs, GSC sync, and PageSpeed Insights.

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SeoAuditResult, GscMetricData, PageSpeedResult, GscQueryRow, GscPageRow, GscOpportunity, SeoIssue } from "@/types/seoIntelligence";
import { SeoAuditService, DEFAULT_SEO_WEIGHTS } from "@/services/seoAuditService";
import { GscService } from "@/services/gscService";
import { PageSpeedService } from "@/services/pageSpeedService";
import { SeoReportService } from "@/services/seoReportService";
import { toast } from "sonner";

export function useSeoIntelligence(shop: any, products: any[] = []) {
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [isSyncingGsc, setIsSyncingGsc] = useState<boolean>(false);
  const [isAnalyzingPageSpeed, setIsAnalyzingPageSpeed] = useState<boolean>(false);

  const [currentAudit, setCurrentAudit] = useState<SeoAuditResult | null>(null);
  const [auditHistory, setAuditHistory] = useState<SeoAuditResult[]>([]);
  const [gscMetrics, setGscMetrics] = useState<GscMetricData>({
    clicks: null,
    impressions: null,
    ctr: null,
    position: null,
    source: 'Google Search Console',
    lastSyncedAt: null,
    period: '28d',
  });

  const [queries, setQueries] = useState<GscQueryRow[]>([]);
  const [pages, setPages] = useState<GscPageRow[]>([]);
  const [opportunities, setOpportunities] = useState<GscOpportunity[]>([]);
  const [mobilePageSpeed, setMobilePageSpeed] = useState<PageSpeedResult | null>(null);
  const [desktopPageSpeed, setDesktopPageSpeed] = useState<PageSpeedResult | null>(null);

  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '28d' | '3m' | '6m' | '12m'>('28d');
  const [gscConnection, setGscConnection] = useState<{
    isConnected: boolean;
    propertyId: string | null;
    lastSyncedAt: string | null;
  }>({ isConnected: false, propertyId: null, lastSyncedAt: null });

  // Load existing audits & GSC state from Supabase
  const loadSeoData = useCallback(async () => {
    if (!shop?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // 1. Fetch Connection state
      const conn = await GscService.getConnectionStatus(shop.id);
      setGscConnection({
        isConnected: conn.isConnected,
        propertyId: conn.propertyId,
        lastSyncedAt: conn.lastSyncedAt,
      });

      // 2. Fetch Latest Audit
      const { data: auditData } = await supabase
        .from("shop_seo_audits")
        .select("*")
        .eq("shop_id", shop.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (auditData && auditData.length > 0) {
        const latest = auditData[0];
        const parsed: SeoAuditResult = {
          id: latest.id,
          shopId: latest.shop_id,
          scannedDomain: latest.scanned_domain || `${shop.slug || 'boutique'}.ecomfy.cloud`,
          overallScore: latest.overall_score,
          technicalScore: latest.technical_score,
          performanceScore: latest.performance_score,
          contentScore: latest.content_score,
          indexabilityScore: latest.indexability_score,
          metadataScore: latest.metadata_score,
          mobileScore: latest.mobile_score,
          issuesCriticalCount: latest.issues_critical,
          issuesImportantCount: latest.issues_important,
          issuesOptimizationCount: latest.issues_optimization,
          issues: (latest.audit_data?.issues as SeoIssue[]) || [],
          auditedAt: latest.created_at,
          source: 'Algorithme Ecomfy',
        };
        setCurrentAudit(parsed);
      }

      // 3. Fetch GSC Cached Queries if connected
      if (conn.isConnected) {
        const { data: cachedQueries } = await supabase
          .from("shop_seo_queries_cache")
          .select("query, clicks, impressions, ctr, position")
          .eq("shop_id", shop.id)
          .eq("period", selectedPeriod)
          .order("clicks", { ascending: false });

        if (cachedQueries && cachedQueries.length > 0) {
          setQueries(cachedQueries);
          const opps = GscService.extractOpportunities(cachedQueries);
          setOpportunities(opps);
        }

        const metrics = await GscService.getGscMetrics(shop.id, selectedPeriod);
        setGscMetrics(metrics);
      } else {
        setGscMetrics({
          clicks: null,
          impressions: null,
          ctr: null,
          position: null,
          source: 'Google Search Console',
          lastSyncedAt: null,
          period: selectedPeriod,
        });
      }
    } catch (e) {
      console.error("[useSeoIntelligence] Error loading SEO data", e);
    } finally {
      setLoading(false);
    }
  }, [shop?.id, selectedPeriod]);

  useEffect(() => {
    loadSeoData();
  }, [loadSeoData]);

  // Run Real Technical Audit
  const runAudit = async () => {
    if (!shop) return;
    try {
      setIsAuditing(true);
      toast.info("Analyse SEO technique en cours...");

      const audit = await SeoAuditService.runRealTechnicalAudit(shop, products, DEFAULT_SEO_WEIGHTS);
      setCurrentAudit(audit);

      // Save audit to DB
      if (shop.id) {
        await supabase.from("shop_seo_audits").insert({
          shop_id: shop.id,
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
        });
      }

      toast.success(`Audit terminé ! Score SEO Ecomfy : ${audit.overallScore}/100`);
    } catch (err: any) {
      toast.error("Erreur lors de l'exécution de l'audit technique.");
    } finally {
      setIsAuditing(false);
    }
  };

  // Run PageSpeed Insights Analysis
  const runPageSpeedAnalysis = async () => {
    const domain = shop?.custom_domain || `${shop?.slug || 'boutique'}.ecomfy.cloud`;
    try {
      setIsAnalyzingPageSpeed(true);
      toast.info("Analyse PageSpeed Insights (Mobile & Desktop) en cours...");

      const [mob, desk] = await Promise.all([
        PageSpeedService.analyzeUrl(domain, 'mobile'),
        PageSpeedService.analyzeUrl(domain, 'desktop'),
      ]);

      setMobilePageSpeed(mob);
      setDesktopPageSpeed(desk);

      if (mob.performanceScore !== null) {
        toast.success(`PageSpeed Mobile : ${mob.performanceScore}/100 | Desktop : ${desk.performanceScore || 'N/A'}/100`);
      } else {
        toast.info("Analyse PageSpeed terminée.");
      }
    } catch {
      toast.error("Impossible de récupérer les métriques PageSpeed.");
    } finally {
      setIsAnalyzingPageSpeed(false);
    }
  };

  // Export PDF Report
  const exportPdfReport = () => {
    const domain = shop?.custom_domain || `${shop?.slug || 'boutique'}.ecomfy.cloud`;
    SeoReportService.generatePdfReport(
      shop?.name || "Ma Boutique",
      domain,
      currentAudit,
      gscMetrics,
      mobilePageSpeed
    );
  };

  // Export CSV Queries
  const exportCsvQueries = () => {
    SeoReportService.exportQueriesToCsv(queries);
  };

  return {
    loading,
    isAuditing,
    isSyncingGsc,
    isAnalyzingPageSpeed,
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
    runAudit,
    runPageSpeedAnalysis,
    exportPdfReport,
    exportCsvQueries,
    refreshData: loadSeoData,
  };
}
