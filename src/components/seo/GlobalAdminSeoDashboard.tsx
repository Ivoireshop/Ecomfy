// src/components/seo/GlobalAdminSeoDashboard.tsx
// Global Admin Dashboard for ECOMFY SEO INTELLIGENCE.
// Provides platform-wide visibility on connected GSC accounts, average SEO scores, critical alerts, and shop health.

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Shield, Globe, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw, BarChart3, Users, ExternalLink } from "lucide-react";
import { seoDb } from "@/lib/seoShop";
import { PlatformSeoGlobalStats } from "@/types/seoIntelligence";

export function GlobalAdminSeoDashboard() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stats, setStats] = useState<PlatformSeoGlobalStats>({
    totalConnectedShops: 0,
    totalAuditedDomains: 0,
    avgPlatformSeoScore: null,
    totalCriticalIssues: 0,
    avgMobilePerformance: null,
    shopsNeedingAttentionCount: 0,
  });

  const loadPlatformStats = async () => {
    try {
      setLoading(true);
      setLoadError(null);

      // Boutiques avec Search Console connecté
      const { count: connectedCount, error: connError } = await seoDb
        .from("shop_seo_connections")
        .select("id", { count: "exact", head: true })
        .eq("gsc_connected", true);
      if (connError) throw new Error(connError.message);

      // Un audit par boutique : le plus récent
      const { data: audits, error: auditsError } = await seoDb
        .from("shop_seo_audits")
        .select("shop_id, overall_score, issues_critical, mobile_score, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (auditsError) throw new Error(auditsError.message);

      const latestByShop = new Map<string, any>();
      (audits || []).forEach((a: any) => {
        if (!latestByShop.has(a.shop_id)) latestByShop.set(a.shop_id, a);
      });
      const latest = Array.from(latestByShop.values());

      const avg = (values: number[]) =>
        values.length > 0 ? Math.round(values.reduce((acc, v) => acc + v, 0) / values.length) : null;

      const mobileScores = latest.map((a) => a.mobile_score).filter((v) => v !== null && v !== undefined).map(Number);

      setStats({
        totalConnectedShops: connectedCount || 0,
        totalAuditedDomains: latest.length,
        avgPlatformSeoScore: avg(latest.map((a) => Number(a.overall_score) || 0)),
        totalCriticalIssues: latest.reduce((acc, a) => acc + (Number(a.issues_critical) || 0), 0),
        avgMobilePerformance: avg(mobileScores),
        shopsNeedingAttentionCount: latest.filter(
          (a) => (Number(a.overall_score) || 0) < 60 || (Number(a.issues_critical) || 0) > 0
        ).length,
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Chargement des statistiques impossible.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlatformStats();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-space font-extrabold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" /> GLOBAL SEO INTELLIGENCE — Vue Administrateur
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Surveillance globale du référencement naturel de toutes les boutiques Ecomfy.</p>
        </div>

        <Button onClick={loadPlatformStats} size="sm" variant="outline" className="border-slate-800 text-xs text-slate-300 rounded-xl gap-2">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </Button>
      </div>

      {loadError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 font-mono break-words">{loadError}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/90 border-slate-800 p-5 rounded-2xl space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Boutiques avec GSC Connecté</span>
          <div className="text-3xl font-space font-bold text-emerald-400">{stats.totalConnectedShops}</div>
          <span className="text-[10px] text-slate-500 font-mono">Source : Google Search Console API</span>
        </Card>

        <Card className="bg-slate-900/90 border-slate-800 p-5 rounded-2xl space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Score SEO Moyen Plateforme</span>
          <div className="text-3xl font-space font-bold text-white">{stats.avgPlatformSeoScore ?? "—"} <span className="text-xs text-slate-500">/ 100</span></div>
          <span className="text-[10px] text-slate-500 font-mono">Source : Algorithme Ecomfy</span>
        </Card>

        <Card className="bg-slate-900/90 border-slate-800 p-5 rounded-2xl space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Alertes Critiques Globales</span>
          <div className="text-3xl font-space font-bold text-red-400">{stats.totalCriticalIssues}</div>
          <span className="text-[10px] text-slate-500 font-mono">Source : Audits Réels Ecomfy</span>
        </Card>

        <Card className="bg-slate-900/90 border-slate-800 p-5 rounded-2xl space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Boutiques Nécessitant Action</span>
          <div className="text-3xl font-space font-bold text-amber-400">{stats.shopsNeedingAttentionCount}</div>
          <span className="text-[10px] text-slate-500 font-mono">Source : Score &lt; 60 ou Erreurs Critiques</span>
        </Card>
      </div>
    </div>
  );
}
