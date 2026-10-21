// src/pages/SeoIntelligencePage.tsx
// Module ECOMFY SEO INTELLIGENCE v2.0 — Multi-tab SEO Analysis, Google Search Console, PageSpeed Insights & Technical Auto-fixes.
// Design clean, responsive font scaling, green glowing pulse dots, and 100% real-time data integrity.

import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Search, Shield, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw,
  Globe, BarChart3, TrendingUp, FileText, Download, Settings, Zap, Key,
  Eye, Code, Smartphone, Monitor, Info, ChevronLeft, ChevronRight, Loader2, Store
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSeoIntelligence } from "@/hooks/useSeoIntelligence";
import { useSeoShop, SeoShopOption } from "@/hooks/useSeoShop";
import { SeoAuditService, DEFAULT_SEO_WEIGHTS } from "@/services/seoAuditService";
import { GscService } from "@/services/gscService";
import { SEO_LIMITS, getEffectiveShopDescription, getEffectiveShopTitle, getProductUrl, getShopDomain, getShopHomeUrl, getShopName } from "@/lib/seoShop";
import { GscProperty, SeoIssue, UrlInspectionResult, PageSpeedResult } from "@/types/seoIntelligence";
import { toast } from "sonner";

const PERIODS: { id: "7d" | "28d" | "3m" | "6m" | "12m"; label: string }[] = [
  { id: "7d", label: "7 jours" },
  { id: "28d", label: "28 jours" },
  { id: "3m", label: "3 mois" },
  { id: "6m", label: "6 mois" },
  { id: "12m", label: "12 mois" },
];

const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function SeoIntelligencePage() {
  const navigate = useNavigate();
  const { shops, shop, products, loading, error, reload, selectShop } = useSeoShop();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingGsc, setPendingGsc] = useState<{ shopId: string; sites: GscProperty[] } | null>(null);
  const oauthHandled = useRef(false);

  // Retour de Google : ?code=...&state=... (le code n'est utilisable qu'une fois)
  useEffect(() => {
    if (oauthHandled.current) return;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const googleError = searchParams.get("error");

    if (googleError) {
      oauthHandled.current = true;
      toast.error("Autorisation Google refusée.");
      setSearchParams({}, { replace: true });
      return;
    }
    if (!code || !state) return;

    oauthHandled.current = true;
    (async () => {
      try {
        const res = await GscService.exchangeCode(code, state);
        setPendingGsc(res);
        setSearchParams({ shop: res.shopId }, { replace: true });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Connexion Google impossible.");
        setSearchParams({}, { replace: true });
      }
    })();
  }, [searchParams, setSearchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090D16] text-slate-100">
        <Header />
        <div className="flex items-center justify-center py-32 gap-3 text-slate-400 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" /> Chargement de votre boutique...
        </div>
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="min-h-screen bg-[#090D16] text-slate-100">
        <Header />
        <div className="max-w-xl mx-auto px-4 py-24 text-center space-y-4">
          <Store className="w-10 h-10 mx-auto text-slate-500" />
          <h1 className="text-xl font-space font-bold text-white">
            {error ? "Impossible de charger votre boutique" : "Aucune boutique à analyser"}
          </h1>
          <p className="text-sm text-slate-400">
            {error || "Créez votre première boutique pour accéder à l'analyse SEO et à la visibilité Google."}
          </p>
          <Button onClick={() => navigate("/shop-manager")} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl">
            Aller à mes boutiques
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SeoDashboard
      key={shop.id}
      shop={shop}
      products={products}
      shops={shops}
      onSelectShop={selectShop}
      onReload={reload}
      pendingGsc={pendingGsc?.shopId === shop.id ? pendingGsc : null}
      onPendingGscDone={() => setPendingGsc(null)}
    />
  );
}

interface SeoDashboardProps {
  shop: any;
  products: any[];
  shops: SeoShopOption[];
  onSelectShop: (id: string) => void;
  onReload: ReturnType<typeof useSeoShop>["reload"];
  /** Propriétés Search Console à choisir après l'autorisation Google. */
  pendingGsc: { shopId: string; sites: GscProperty[] } | null;
  onPendingGscDone: () => void;
}

function SeoDashboard({ shop: currentShop, products, shops, onSelectShop, onReload, pendingGsc, onPendingGscDone }: SeoDashboardProps) {
  const {
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
    runAudit,
    runPageSpeedAnalysis,
    applyFix,
    saveMeta,
    syncGsc,
    connectGsc,
    disconnectGsc,
    selectGscProperty,
    exportPdfReport,
    exportCsvQueries,
  } = useSeoIntelligence(currentShop, products, onReload);

  const [activeTab, setActiveTab] = useState(pendingGsc ? "gsc" : "overview");
  const [isSelectingProperty, setIsSelectingProperty] = useState(false);
  const [searchQueryFilter, setSearchQueryFilter] = useState("");
  const [inspectUrlInput, setInspectUrlInput] = useState("");
  const [inspectionResult, setInspectionResult] = useState<UrlInspectionResult | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);

  // Pagination state for keywords
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Technical Meta Editor state (valeurs réellement servies par la boutique)
  const [customMetaTitle, setCustomMetaTitle] = useState(getEffectiveShopTitle(currentShop));
  const [customMetaDesc, setCustomMetaDesc] = useState(getEffectiveShopDescription(currentShop));

  // Re-synchronise l'éditeur quand la boutique est rechargée (après une correction automatique)
  useEffect(() => {
    setCustomMetaTitle(getEffectiveShopTitle(currentShop));
    setCustomMetaDesc(getEffectiveShopDescription(currentShop));
  }, [currentShop.seo_title, currentShop.seo_description, currentShop.business_name, currentShop.business_description]);

  // Auto-Fix preview modal state
  const [previewFixIssue, setPreviewFixIssue] = useState<SeoIssue | null>(null);

  const domainName = getShopDomain(currentShop);
  const shopName = getShopName(currentShop);

  const handleInspectUrl = async () => {
    const target = inspectUrlInput.trim();
    if (!target) {
      toast.error("Veuillez saisir une URL à inspecter");
      return;
    }
    if (/^https?:\/\//i.test(target)) {
      try {
        const host = new URL(target).hostname.replace(/^www\./, "");
        const allowed = [getShopDomain(currentShop), "ecomfy.cloud"];
        if (currentShop.custom_domain) allowed.push(currentShop.custom_domain);
        if (!allowed.some((d) => host === d || host.endsWith("." + d))) {
          toast.error("Cette URL n'appartient pas à votre boutique.");
          return;
        }
      } catch {
        toast.error("URL invalide.");
        return;
      }
    }
    setIsInspecting(true);
    try {
      const res = await GscService.inspectUrl(domainName, target);
      setInspectionResult(res);
      if (res.verdict === "UNAVAILABLE") {
        toast.info("Inspection indisponible pour le moment.");
      } else {
        toast.success("Inspection d'URL effectuée avec succès");
      }
    } catch {
      toast.error("L'inspection d'URL a échoué.");
    } finally {
      setIsInspecting(false);
    }
  };

  const filteredQueries = queries.filter(q =>
    q.query.toLowerCase().includes(searchQueryFilter.toLowerCase())
  );

  const totalPagesCount = Math.ceil(filteredQueries.length / itemsPerPage) || 1;
  const safePage = Math.min(currentPage, totalPagesCount);
  const paginatedQueries = filteredQueries.slice(
    (safePage - 1) * itemsPerPage,
    safePage * itemsPerPage
  );

  // Liste des pages : données Search Console uniquement si elles ont été synchronisées
  const gscPageStats = (url: string) => {
    const row = pages.find((r) => r.url.replace(/\/$/, "") === url.replace(/\/$/, ""));
    return row ? { clicks: row.clicks, impressions: row.impressions } : null;
  };

  const homeUrl = getShopHomeUrl(currentShop);
  const homeStats = gscPageStats(homeUrl);
  const pagesList = [
    {
      url: homeUrl,
      name: "Page d'accueil",
      type: "Accueil",
      hasMetaTitle: !!getEffectiveShopTitle(currentShop),
      hasMetaDesc: getEffectiveShopDescription(currentShop).length >= SEO_LIMITS.descMin,
      clicks: homeStats ? homeStats.clicks : null,
      impressions: homeStats ? homeStats.impressions : null,
    },
    ...products
      .filter((p) => p.is_published !== false)
      .map(p => {
        const url = getProductUrl(currentShop, p);
        const stats = gscPageStats(url);
        return {
          url,
          name: p.name,
          type: "Fiche Produit",
          hasMetaTitle: !!(p.name && p.name.length >= 10),
          hasMetaDesc: String(p.short_description || p.description || "").trim().length >= SEO_LIMITS.productDescMin,
          clicks: stats ? stats.clicks : null,
          impressions: stats ? stats.impressions : null,
        };
      })
  ];

  const metaTitleDirty = customMetaTitle.trim() !== getEffectiveShopTitle(currentShop);
  const metaDescDirty = customMetaDesc.trim() !== getEffectiveShopDescription(currentShop);

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 font-inter selection:bg-[#0E7C66] selection:text-white">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Banner Hero */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 backdrop-blur-xl shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#0E7C66]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="bg-[#0E7C66]/20 text-emerald-400 border border-[#0E7C66]/40 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  <span>ECOMFY SEO INTELLIGENCE v2.0</span>
                </Badge>

                {gscConnection.isConnected ? (
                  <Badge className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Google Search Console Connecté</span>
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <span>Search Console Non Connecté</span>
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-space font-extrabold text-white tracking-tight leading-tight">
                {shopName} — Visibilité & SEO Google
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span className="font-mono text-slate-300 font-medium">{domainName}</span>
              </p>
              {shops.length > 1 && (
                <select
                  value={currentShop.id}
                  onChange={(e) => onSelectShop(e.target.value)}
                  aria-label="Boutique analysée"
                  className="mt-1 bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl h-9 px-3"
                >
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={runAudit}
                disabled={isAuditing}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl gap-2 shadow-lg shadow-emerald-900/30 px-5 py-2.5 text-xs sm:text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${isAuditing ? 'animate-spin' : ''}`} />
                <span>{isAuditing ? "Analyse en cours..." : "ANALYSER MA BOUTIQUE"}</span>
              </Button>

              <Button
                onClick={exportPdfReport}
                variant="outline"
                className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-2xl gap-2 text-xs sm:text-sm px-4 py-2.5"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>RAPPORT PDF</span>
              </Button>
            </div>
          </div>
        </div>

        {storageError && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">L'historique des audits et les données Google ne sont pas accessibles.</span>
              <span className="text-red-200/80 font-mono break-words">{storageError}</span>
              <span className="block text-red-200/80">Vous pouvez lancer un audit, mais il ne sera pas enregistré tant que le problème persiste.</span>
            </div>
          </div>
        )}

        {/* Sub-Navigation Tabs Header */}
        <div className="overflow-x-auto pb-2 scrollbar-thin">
          <div className="flex items-center gap-2 min-w-max border-b border-slate-800 pb-3">
            {[
              { id: "overview", label: "Vue d'ensemble", icon: BarChart3 },
              { id: "audit", label: "Audit SEO", icon: Shield },
              { id: "gsc", label: "Google Search Console", icon: Key },
              { id: "keywords", label: "Mots-clés", icon: Search },
              { id: "pages", label: "Pages", icon: FileText },
              { id: "indexation", label: "Indexation & Inspection", icon: Eye },
              { id: "performance", label: "Performance", icon: Zap },
              { id: "technical", label: "SEO Technique", icon: Code },
              { id: "opportunities", label: "Opportunités", icon: TrendingUp },
              { id: "reports", label: "Historique & Rapports", icon: Download },
              { id: "settings", label: "Paramètres", icon: Settings },
            ].map(tab => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-[#0E7C66] text-white shadow-md shadow-[#0E7C66]/30"
                      : "bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* TAB 1: VUE D'ENSEMBLE */}
        {activeTab === "overview" && (
          <div className="space-y-8 animate-in fade-in duration-300">

            {/* Période des données Google */}
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Période des données Google">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Période Google</span>
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPeriod(p.id)}
                  aria-pressed={selectedPeriod === p.id}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedPeriod === p.id
                      ? "bg-[#0E7C66] text-white"
                      : "bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-500 ml-2" />}
              {gscConnection.isConnected && (
                <Button
                  onClick={syncGsc}
                  disabled={isSyncingGsc}
                  size="sm"
                  variant="outline"
                  className="ml-auto border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs rounded-xl gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGsc ? 'animate-spin' : ''}`} />
                  {isSyncingGsc ? "Synchronisation..." : "Synchroniser Google"}
                </Button>
              )}
            </div>

            {/* Top Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              
              {/* Card 1: Score Ecomfy */}
              <Card className="bg-slate-900/90 border-slate-800 p-5 rounded-2xl space-y-3 relative overflow-hidden flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Score SEO Ecomfy</span>
                  <Tooltip text="Score calculé à partir de l'audit technique réel Ecomfy (sur 100)." />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-space font-extrabold text-emerald-400">
                    {currentAudit?.overallScore ?? "--"}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">/ 100</span>
                </div>
                <div className="space-y-1">
                  <Progress value={currentAudit?.overallScore || 0} className="h-2 bg-slate-800 text-emerald-500" />
                  <span className="text-[10px] text-slate-400 block font-mono">
                    Source : Algorithme Ecomfy{currentAudit ? ` · ${formatDate(currentAudit.auditedAt)}` : " · aucun audit"}
                  </span>
                </div>
              </Card>

              {/* Card 2: Clics Google */}
              <Card className="bg-slate-900/90 border-slate-800 p-5 rounded-2xl space-y-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Clics Google</span>
                  <Tooltip text="Nombre réel de clics provenant des résultats de recherche Google." />
                </div>
                <div className="text-2xl sm:text-3xl font-space font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">
                  {gscMetrics.clicks !== null ? (
                    gscMetrics.clicks.toLocaleString()
                  ) : (
                    <span className="text-xs sm:text-sm font-semibold text-slate-400 font-sans tracking-tight leading-none inline-block whitespace-nowrap">Données indisponibles</span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 block font-mono">Source : Google Search Console</span>
              </Card>

              {/* Card 3: Impressions */}
              <Card className="bg-slate-900/90 border-slate-800 p-5 rounded-2xl space-y-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Impressions</span>
                  <Tooltip text="Nombre réel de fois où votre boutique a été affichée dans Google." />
                </div>
                <div className="text-2xl sm:text-3xl font-space font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">
                  {gscMetrics.impressions !== null ? (
                    gscMetrics.impressions.toLocaleString()
                  ) : (
                    <span className="text-xs sm:text-sm font-semibold text-slate-400 font-sans tracking-tight leading-none inline-block whitespace-nowrap">Données indisponibles</span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 block font-mono">Source : Google Search Console</span>
              </Card>

              {/* Card 4: CTR Moyen */}
              <Card className="bg-slate-900/90 border-slate-800 p-5 rounded-2xl space-y-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">CTR Moyen</span>
                  <Tooltip text="Taux de clics (Clics / Impressions * 100)." />
                </div>
                <div className="text-2xl sm:text-3xl font-space font-bold text-emerald-400 whitespace-nowrap overflow-hidden text-ellipsis">
                  {gscMetrics.ctr !== null ? (
                    `${gscMetrics.ctr} %`
                  ) : (
                    <span className="text-xs sm:text-sm font-semibold text-slate-400 font-sans tracking-tight leading-none inline-block whitespace-nowrap">Données indisponibles</span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 block font-mono">Source : Google Search Console</span>
              </Card>

              {/* Card 5: Position Moyenne */}
              <Card className="bg-slate-900/90 border-slate-800 p-5 rounded-2xl space-y-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Position Moyenne</span>
                  <Tooltip text="Position moyenne dans les résultats Google." />
                </div>
                <div className="text-2xl sm:text-3xl font-space font-bold text-blue-400 whitespace-nowrap overflow-hidden text-ellipsis">
                  {gscMetrics.position !== null ? (
                    gscMetrics.position
                  ) : (
                    <span className="text-xs sm:text-sm font-semibold text-slate-400 font-sans tracking-tight leading-none inline-block whitespace-nowrap">Données indisponibles</span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 block font-mono">Source : Google Search Console</span>
              </Card>

            </div>

            {/* Notice if GSC Not Connected */}
            {!gscConnection.isConnected && (
              <div className="p-6 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-sm sm:text-base text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" /> Connectez Google Search Console pour afficher vos vraies métriques de visibilité
                  </h3>
                  <p className="text-xs text-amber-200/80 leading-relaxed">
                    Ecomfy n'affiche aucune donnée fictive. Connectez votre compte Google en 1-clic pour suivre vos vrais clics, impressions et mots-clés.
                  </p>
                </div>
                <Button 
                  onClick={() => setActiveTab("gsc")} 
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl px-4 py-2 shrink-0"
                >
                  Connecter Search Console
                </Button>
              </div>
            )}

            {/* Audit Issues Breakdown Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <Card className="bg-slate-900/90 border-slate-800 p-6 rounded-3xl space-y-4">
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0" /> Alertes Critiques ({currentAudit?.issuesCriticalCount || 0})
                </h3>
                <p className="text-xs text-slate-400">Problèmes majeurs bloquant l'indexation ou pénalisant fortement votre classement Google.</p>
                <div className="space-y-2">
                  {currentAudit?.issues.filter(i => i.severity === 'critical').map(issue => (
                    <div key={issue.id} className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-1">
                      <span className="text-xs font-bold text-red-300">{issue.title}</span>
                      <p className="text-[11px] text-slate-300 leading-tight">{issue.description}</p>
                    </div>
                  ))}
                  {!currentAudit && (
                    <div className="p-4 text-center text-xs text-slate-500 font-medium">Lancez un audit pour détecter les problèmes.</div>
                  )}
                  {currentAudit && currentAudit.issuesCriticalCount === 0 && (
                    <div className="p-4 text-center text-xs text-slate-500 font-medium">Aucun problème critique détecté</div>
                  )}
                </div>
              </Card>

              <Card className="bg-slate-900/90 border-slate-800 p-6 rounded-3xl space-y-4">
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" /> Problèmes Importants ({currentAudit?.issuesImportantCount || 0})
                </h3>
                <p className="text-xs text-slate-400">Éléments pouvant dégrader votre positionnement sur les mots-clés concurrentiels.</p>
                <div className="space-y-2">
                  {currentAudit?.issues.filter(i => i.severity === 'important').map(issue => (
                    <div key={issue.id} className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1">
                      <span className="text-xs font-bold text-amber-300">{issue.title}</span>
                      <p className="text-[11px] text-slate-300 leading-tight">{issue.description}</p>
                    </div>
                  ))}
                  {!currentAudit && (
                    <div className="p-4 text-center text-xs text-slate-500 font-medium">Lancez un audit pour détecter les problèmes.</div>
                  )}
                  {currentAudit && currentAudit.issuesImportantCount === 0 && (
                    <div className="p-4 text-center text-xs text-slate-500 font-medium">Aucun problème important détecté.</div>
                  )}
                </div>
              </Card>

              <Card className="bg-slate-900/90 border-slate-800 p-6 rounded-3xl space-y-4">
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)] shrink-0" /> Optimisations Recommandées ({currentAudit?.issuesOptimizationCount || 0})
                </h3>
                <p className="text-xs text-slate-400">Pistes d'amélioration pour capter davantage de trafic résiduel de longue traîne.</p>
                <div className="space-y-2">
                  {currentAudit?.issues.filter(i => i.severity === 'optimization').map(issue => (
                    <div key={issue.id} className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 space-y-1">
                      <span className="text-xs font-bold text-blue-300">{issue.title}</span>
                      <p className="text-[11px] text-slate-300 leading-tight">{issue.description}</p>
                    </div>
                  ))}
                  {!currentAudit && (
                    <div className="p-4 text-center text-xs text-slate-500 font-medium">Lancez un audit pour détecter les problèmes.</div>
                  )}
                  {currentAudit && currentAudit.issuesOptimizationCount === 0 && (
                    <div className="p-4 text-center text-xs text-slate-500 font-medium">Toutes les optimisations sont valides !</div>
                  )}
                </div>
              </Card>

            </div>

          </div>
        )}

        {/* TAB 2: AUDIT SEO */}
        {activeTab === "audit" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <Card className="bg-slate-900/90 border-slate-800 p-6 sm:p-8 rounded-3xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-xl font-space font-bold text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-emerald-400 shrink-0" /> Scanner & Audit Technique Ecomfy
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Scannez la structure HTML, les balises Meta, le sitemap, HTTPS et les données structurées de votre boutique.</p>
                </div>
                <Button onClick={runAudit} disabled={isAuditing} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs gap-2">
                  <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
                  <span>{isAuditing ? "Audit en cours..." : "Re-lancer l'audit"}</span>
                </Button>
              </div>

              {!currentAudit && (
                <div className="p-10 text-center text-xs text-slate-500">
                  Aucun audit enregistré pour cette boutique. Cliquez sur « Re-lancer l'audit » pour analyser vos balises, vos produits et vos images.
                </div>
              )}

              {currentAudit && (
                <div className="space-y-6">
                  {/* Detailed Scores Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <ScoreBox title="Technique" score={currentAudit.technicalScore} weight={`${DEFAULT_SEO_WEIGHTS.technical}%`} />
                    <ScoreBox title="Performance" score={currentAudit.performanceScore} weight={`${DEFAULT_SEO_WEIGHTS.performance}%`} />
                    <ScoreBox title="Contenu" score={currentAudit.contentScore} weight={`${DEFAULT_SEO_WEIGHTS.content}%`} />
                    <ScoreBox title="Indexabilité" score={currentAudit.indexabilityScore} weight={`${DEFAULT_SEO_WEIGHTS.indexability}%`} />
                    <ScoreBox title="Métadonnées" score={currentAudit.metadataScore} weight={`${DEFAULT_SEO_WEIGHTS.metadata}%`} />
                    <ScoreBox title="Mobile" score={currentAudit.mobileScore} weight={`${DEFAULT_SEO_WEIGHTS.mobile}%`} />
                  </div>
                  {(currentAudit.performanceScore === null || currentAudit.mobileScore === null) && (
                    <p className="text-[11px] text-slate-500">
                      « Non mesuré » : lancez l'analyse PageSpeed (onglet Performance) puis relancez l'audit pour intégrer ces catégories au score.
                    </p>
                  )}

                  {/* Issues List with Action Buttons */}
                  <div className="space-y-3 pt-4">
                    <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">Toutes les anomalies détectées ({currentAudit.issues.length})</h3>
                    {currentAudit.issues.length === 0 && (
                      <div className="p-6 text-center text-xs text-slate-500">Aucune anomalie détectée. Bravo !</div>
                    )}
                    {currentAudit.issues.map((issue) => (
                      <div key={issue.id} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge className={
                              issue.severity === 'critical' ? 'bg-red-500/20 text-red-400 border-red-500/40 text-[10px]' :
                              issue.severity === 'important' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 text-[10px]' :
                              'bg-blue-500/20 text-blue-400 border-blue-500/40 text-[10px]'
                            }>
                              {issue.severity.toUpperCase()}
                            </Badge>
                            <span className="font-bold text-sm text-white">{issue.title}</span>
                          </div>
                          <p className="text-xs text-slate-300">{issue.description}</p>
                          <p className="text-[11px] text-slate-400 font-mono">💡 Recommandation : {issue.recommendation}</p>
                        </div>

                        {issue.canAutoFix && (
                          <Button
                            onClick={() => setPreviewFixIssue(issue)}
                            size="sm"
                            className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 rounded-xl text-xs font-bold shrink-0 gap-1.5"
                          >
                            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Aperçu Fix</span>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* TAB 3: GOOGLE SEARCH CONSOLE OAUTH */}
        {activeTab === "gsc" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <Card className="bg-slate-900/90 border-slate-800 p-6 sm:p-8 rounded-3xl space-y-6">
              <div className="space-y-2 border-b border-slate-800 pb-4">
                <h2 className="text-xl font-space font-bold text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-emerald-400 shrink-0" /> Connexion Google Search Console (OAuth 2.0)
                </h2>
                <p className="text-xs text-slate-400">
                  Associez votre propriété Google Search Console officielle pour importer vos données de recherche sans partager de mot de passe.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Statut de la connexion</span>
                    <span className="text-sm font-bold text-white flex items-center gap-2">
                      {gscConnection.isConnected ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Connecté (Propriété : <code className="text-emerald-400 font-mono">{gscConnection.propertyId || domainName}</code>)
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" /> Non connecté
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {gscConnection.isConnected && (
                      <>
                        <Button
                          onClick={syncGsc}
                          disabled={isSyncingGsc}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs px-4 py-2.5 gap-2"
                        >
                          <RefreshCw className={`w-4 h-4 ${isSyncingGsc ? 'animate-spin' : ''}`} />
                          <span>{isSyncingGsc ? "Synchronisation..." : "Synchroniser maintenant"}</span>
                        </Button>
                        <Button
                          onClick={disconnectGsc}
                          variant="outline"
                          className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-xl text-xs px-4 py-2.5"
                        >
                          Déconnecter
                        </Button>
                      </>
                    )}
                    <Button
                      onClick={connectGsc}
                      variant={gscConnection.isConnected ? "outline" : "default"}
                      className={gscConnection.isConnected
                        ? "border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-xl text-xs px-4 py-2.5 gap-2"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs px-5 py-2.5 gap-2"}
                    >
                      <Key className="w-4 h-4" />
                      <span>{gscConnection.isConnected ? "Re-connecter Google" : "Connecter Google Search Console"}</span>
                    </Button>
                  </div>
                </div>
              </div>

              {gscConnection.isConnected && (
                <p className="text-xs text-slate-400">Dernière synchronisation : {formatDate(gscConnection.lastSyncedAt)}</p>
              )}

              {pendingGsc && (
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-emerald-500/30 space-y-3">
                  <h3 className="text-sm font-bold text-white">Choisissez la propriété Search Console de cette boutique</h3>
                  {pendingGsc.sites.length === 0 ? (
                    <p className="text-xs text-amber-300">
                      Aucune propriété trouvée sur ce compte Google. Ajoutez et vérifiez votre site dans Search Console, puis reconnectez-vous.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {pendingGsc.sites.map((site) => {
                        const matches = GscService.verifyDomainMatch(domainName, site.siteUrl);
                        return (
                          <button
                            key={site.siteUrl}
                            disabled={!site.isCompatible || isSelectingProperty}
                            onClick={async () => {
                              setIsSelectingProperty(true);
                              const ok = await selectGscProperty(site.siteUrl);
                              setIsSelectingProperty(false);
                              if (ok) onPendingGscDone();
                            }}
                            className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 disabled:opacity-50 text-left"
                          >
                            <span className="font-mono text-xs text-slate-200 break-all">{site.siteUrl}</span>
                            <span className="flex items-center gap-2 shrink-0">
                              {matches && <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px]">Recommandé</Badge>}
                              {!site.isCompatible && <Badge className="bg-red-500/20 text-red-300 border border-red-500/40 text-[10px]">Non vérifiée</Badge>}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Scope info */}
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs text-slate-400 space-y-1">
                <span className="font-bold text-slate-300 block">🔒 Sécurité & Scope de Lecture Seule :</span>
                <p>Ecomfy utilise exclusivement le scope officiel <code className="text-emerald-400">webmasters.readonly</code>. Les jetons Google restent côté serveur et ne sont jamais envoyés au navigateur.</p>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 4: MOTS-CLÉS */}
        {activeTab === "keywords" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <Card className="bg-slate-900/90 border-slate-800 p-6 sm:p-8 rounded-3xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-xl font-space font-bold text-white flex items-center gap-2">
                    <Search className="w-5 h-5 text-emerald-400 shrink-0" /> Mots-clés Google Réels
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Requêtes réelles ayant généré des impressions et clics sur Google.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    placeholder="Filtrer un mot-clé..."
                    value={searchQueryFilter}
                    onChange={(e) => {
                      setSearchQueryFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-slate-950 border-slate-800 text-xs h-9 w-48 rounded-xl"
                  />
                  <Button onClick={exportCsvQueries} variant="outline" size="sm" className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs rounded-xl gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Exporter CSV
                  </Button>
                </div>
              </div>

              {paginatedQueries.length > 0 ? (
                <div className="space-y-4">
                  <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-slate-300 font-bold border-b border-slate-800">
                        <tr>
                          <th className="p-3.5">Mot-clé</th>
                          <th className="p-3.5">Clics</th>
                          <th className="p-3.5">Impressions</th>
                          <th className="p-3.5">CTR (%)</th>
                          <th className="p-3.5">Position Moyenne</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {paginatedQueries.map((q) => (
                          <tr key={q.query} className="hover:bg-slate-900/50">
                            <td className="p-3.5 font-sans font-bold text-white">{q.query}</td>
                            <td className="p-3.5 text-emerald-400 font-bold">{q.clicks}</td>
                            <td className="p-3.5 text-slate-300">{q.impressions.toLocaleString()}</td>
                            <td className="p-3.5 text-slate-300">{q.ctr} %</td>
                            <td className="p-3.5 text-blue-400 font-bold">{q.position}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Control */}
                  <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
                    <span>Page {safePage} sur {totalPagesCount} ({filteredQueries.length} mots-clés au total)</span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={safePage === 1}
                        aria-label="Page précédente"
                        onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                        className="h-8 w-8 p-0 border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={safePage >= totalPagesCount}
                        aria-label="Page suivante"
                        onClick={() => setCurrentPage(Math.min(totalPagesCount, safePage + 1))}
                        className="h-8 w-8 p-0 border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-xs text-slate-500 space-y-2">
                  <Search className="w-8 h-8 mx-auto text-slate-600" />
                  <p>
                    {!gscConnection.isConnected
                      ? "Aucune requête trouvée. Connectez Google Search Console pour charger vos vrais mots-clés."
                      : searchQueryFilter
                        ? "Aucun mot-clé ne correspond à ce filtre."
                        : "Aucune donnée Google synchronisée pour cette période."}
                  </p>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* TAB 5: PAGES */}
        {activeTab === "pages" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <Card className="bg-slate-900/90 border-slate-800 p-6 sm:p-8 rounded-3xl space-y-6">
              <div className="space-y-1 border-b border-slate-800 pb-4">
                <h2 className="text-xl font-space font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-400 shrink-0" /> Visibilité & Audit par Page ({pagesList.length})
                </h2>
                <p className="text-xs text-slate-400">Analyse de la structure SEO et des métadonnées pour chaque URL de votre boutique.</p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-300 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3.5">Nom de la Page</th>
                      <th className="p-3.5">Type</th>
                      <th className="p-3.5">Meta Title</th>
                      <th className="p-3.5">Meta Description</th>
                      <th className="p-3.5">Clics / Impressions</th>
                      <th className="p-3.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {pagesList.map((p) => (
                      <tr key={p.url} className="hover:bg-slate-900/50">
                        <td className="p-3.5 font-bold text-white max-w-xs truncate">{p.name}</td>
                        <td className="p-3.5"><Badge variant="outline" className="text-[10px] border-slate-700 text-slate-300">{p.type}</Badge></td>
                        <td className="p-3.5">
                          {p.hasMetaTitle ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Présent</span>
                          ) : (
                            <span className="text-red-400 font-bold flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Manquant</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          {p.hasMetaDesc ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Présent</span>
                          ) : (
                            <span className="text-amber-400 font-bold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Trop courte</span>
                          )}
                        </td>
                        <td className="p-3.5 font-mono text-slate-300">
                          {p.clicks !== null ? `${p.clicks} clics / ${p.impressions} impr.` : <span className="text-slate-500 font-sans text-[11px]">Données indisponibles</span>}
                        </td>
                        <td className="p-3.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(p.url, "_blank", "noopener,noreferrer")}
                            className="h-7 text-[11px] text-emerald-400 hover:text-white hover:bg-emerald-600/20 px-2 rounded-lg gap-1"
                          >
                            <span>Voir l'URL</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 6: INDEXATION & INSPECTION D'URL */}
        {activeTab === "indexation" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <Card className="bg-slate-900/90 border-slate-800 p-6 sm:p-8 rounded-3xl space-y-6">
              <div className="space-y-1 border-b border-slate-800 pb-4">
                <h2 className="text-xl font-space font-bold text-white flex items-center gap-2">
                  <Eye className="w-5 h-5 text-emerald-400 shrink-0" /> Inspection d'URL Google
                </h2>
                <p className="text-xs text-slate-400">Vérifiez l'état d'indexation d'une URL de votre boutique sur Google.</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  placeholder={`${getShopHomeUrl(currentShop)}`}
                  value={inspectUrlInput}
                  onChange={(e) => setInspectUrlInput(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-xs h-10 rounded-xl font-mono flex-1 text-slate-100"
                />
                <Button onClick={handleInspectUrl} disabled={isInspecting} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs gap-2">
                  <Search className="w-4 h-4" />
                  <span>{isInspecting ? "Inspection..." : "INSPECTER L'URL"}</span>
                </Button>
              </div>

              {inspectionResult && (
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Résultat d'Inspection</span>
                    <Badge className={
                      inspectionResult.verdict === "INDEXED" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px]" :
                      inspectionResult.verdict === "NOT_INDEXED" ? "bg-red-500/20 text-red-400 border border-red-500/40 text-[10px]" :
                      "bg-slate-500/20 text-slate-300 border border-slate-500/40 text-[10px]"
                    }>
                      {inspectionResult.verdict === "UNAVAILABLE" ? "INDISPONIBLE" : inspectionResult.verdict}
                    </Badge>
                  </div>
                  <div className="text-xs space-y-1 font-mono text-slate-300">
                    <div>URL inspectée : <span className="text-white break-all">{inspectionResult.inspectUrl}</span></div>
                    <div>État d'indexation : <span className="text-emerald-400">{inspectionResult.coverageState}</span></div>
                    {inspectionResult.googleCanonicalUrl && (
                      <div>Canonique Google : <span className="text-blue-400 break-all">{inspectionResult.googleCanonicalUrl}</span></div>
                    )}
                  </div>
                  {inspectionResult.message && (
                    <p className="text-xs text-amber-200/90 leading-relaxed">{inspectionResult.message}</p>
                  )}
                  <span className="text-[10px] text-slate-500 block font-mono">Source : {inspectionResult.source}</span>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* TAB 7: PERFORMANCE (PAGESPEED INSIGHTS) */}
        {activeTab === "performance" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <Card className="bg-slate-900/90 border-slate-800 p-6 sm:p-8 rounded-3xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-xl font-space font-bold text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-emerald-400 shrink-0" /> Analyse PageSpeed Insights & Core Web Vitals
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Mesures réelles de vitesse Lighthouse sur Mobile et Desktop.</p>
                </div>
                <Button onClick={runPageSpeedAnalysis} disabled={isAnalyzingPageSpeed} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs gap-2">
                  <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzingPageSpeed ? 'animate-spin' : ''}`} />
                  <span>Lancer l'analyse PageSpeed</span>
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <SpeedCard title="Performance Mobile" icon={<Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />} valueClass="text-emerald-400" result={mobilePageSpeed} />
                <SpeedCard title="Performance Desktop" icon={<Monitor className="w-4 h-4 text-blue-400 shrink-0" />} valueClass="text-blue-400" result={desktopPageSpeed} />

              </div>
            </Card>
          </div>
        )}

        {/* TAB 8: SEO TECHNIQUE & SCHEMA BUILDER */}
        {activeTab === "technical" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <Card className="bg-slate-900/90 border-slate-800 p-6 sm:p-8 rounded-3xl space-y-6">
              <div className="space-y-1 border-b border-slate-800 pb-4">
                <h2 className="text-xl font-space font-bold text-white flex items-center gap-2">
                  <Code className="w-5 h-5 text-emerald-400 shrink-0" /> Éditeur de Balises Meta & Données Structurées (JSON-LD)
                </h2>
                <p className="text-xs text-slate-400">Configurez le titre principal et la description de votre boutique avec prévisualisation des longueurs recommandées.</p>
              </div>

              {/* Interactive Meta Title & Description Form */}
              <div className="space-y-4 p-5 rounded-2xl bg-slate-950/80 border border-slate-800">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-bold text-white">Titre SEO Principal (Meta Title)</label>
                    <span className={`font-mono text-[11px] ${customMetaTitle.trim().length >= SEO_LIMITS.titleMin && customMetaTitle.trim().length <= SEO_LIMITS.titleMax ? 'text-emerald-400 font-bold' : 'text-amber-400'}`}>
                      {customMetaTitle.trim().length} caractères (recommandé : {SEO_LIMITS.titleMin}-{SEO_LIMITS.titleMax})
                    </span>
                  </div>
                  <Input
                    value={customMetaTitle}
                    onChange={(e) => setCustomMetaTitle(e.target.value)}
                    placeholder="Ex: Ma Boutique Mode & Accessoires | Ecomfy"
                    className="bg-slate-900 border-slate-800 text-xs text-white h-10 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-bold text-white">Description SEO Principale (Meta Description)</label>
                    <span className={`font-mono text-[11px] ${customMetaDesc.trim().length >= SEO_LIMITS.descMin && customMetaDesc.trim().length <= SEO_LIMITS.descMax ? 'text-emerald-400 font-bold' : 'text-amber-400'}`}>
                      {customMetaDesc.trim().length} caractères (recommandé : {SEO_LIMITS.descMin}-{SEO_LIMITS.descMax})
                    </span>
                  </div>
                  <Textarea
                    value={customMetaDesc}
                    onChange={(e) => setCustomMetaDesc(e.target.value)}
                    placeholder="Ex: Découvrez notre vaste catalogue d'articles originaux sur Ecomfy. Livraison rapide et paiement sécurisé Mobile Money."
                    className="bg-slate-900 border-slate-800 text-xs text-white min-h-[90px] rounded-xl"
                  />
                </div>

                <Button
                  onClick={() => saveMeta(customMetaTitle, customMetaDesc)}
                  disabled={isApplyingFix || (!metaTitleDirty && !metaDescDirty)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl px-5 py-2"
                >
                  {isApplyingFix ? "Enregistrement..." : "Enregistrer mes balises SEO"}
                </Button>
              </div>

              {/* JSON-LD Schema Code Preview */}
              {products.length > 0 && (
                <div className="space-y-4">
                  <Label className="text-xs font-semibold text-slate-300">Schéma JSON-LD Product généré pour : <span className="text-emerald-400 font-bold">{products[0]?.name}</span></Label>
                  {(() => {
                    const preview = SeoAuditService.generateProductJsonLd(products[0], currentShop);
                    return (
                      <>
                        <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto">
                          {preview.jsonLdSnippet}
                        </pre>
                        {preview.missingFields.length > 0 && (
                          <p className="text-[11px] text-amber-300">Champs recommandés manquants : {preview.missingFields.join(", ")}</p>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* TAB 9: OPPORTUNITÉS SEO */}
        {activeTab === "opportunities" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <Card className="bg-slate-900/90 border-slate-800 p-6 sm:p-8 rounded-3xl space-y-6">
              <div className="space-y-1 border-b border-slate-800 pb-4">
                <h2 className="text-xl font-space font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400 shrink-0" /> Opportunités de Croissance SEO
                </h2>
                <p className="text-xs text-slate-400">Mots-clés à fort potentiel d'optimisation basés sur vos données Google réelles.</p>
              </div>

              {opportunities.length > 0 ? (
                <div className="space-y-3">
                  {opportunities.map((opp, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-start justify-between gap-4">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">{opp.title}</span>
                        <h4 className="text-sm font-bold text-white">Mot-clé : <code className="text-emerald-400">{opp.query}</code></h4>
                        <p className="text-xs text-slate-300">💡 Conseil : {opp.suggestion}</p>
                      </div>
                      <div className="text-right font-mono text-xs text-slate-400 shrink-0">
                        <div>Clics : <span className="text-white font-bold">{opp.clicks}</span></div>
                        <div>Impressions : <span className="text-white font-bold">{opp.impressions}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-500">
                  Aucune opportunité détectée pour le moment. Connectez Google Search Console pour charger les mots-clés émergents.
                </div>
              )}
            </Card>
          </div>
        )}

        {/* TAB 10: RAPPORTS & HISTORIQUE */}
        {activeTab === "reports" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <Card className="bg-slate-900/90 border-slate-800 p-6 sm:p-8 rounded-3xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-xl font-space font-bold text-white flex items-center gap-2">
                    <Download className="w-5 h-5 text-emerald-400 shrink-0" /> Exportation de Rapports SEO
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Téléchargez vos synthèses et données au format PDF imprimable ou CSV.</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={exportPdfReport} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs gap-2">
                    <Download className="w-4 h-4" /> Export PDF
                  </Button>
                  <Button onClick={exportCsvQueries} variant="outline" className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs rounded-xl gap-2">
                    <Download className="w-4 h-4" /> Export Mots-clés CSV
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">Historique des audits ({auditHistory.length})</h3>
                {auditHistory.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">Aucun audit enregistré pour le moment.</div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-slate-300 font-bold border-b border-slate-800">
                        <tr>
                          <th className="p-3.5">Date</th>
                          <th className="p-3.5">Score</th>
                          <th className="p-3.5">Critiques</th>
                          <th className="p-3.5">Importants</th>
                          <th className="p-3.5">Optimisations</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {auditHistory.map((a, idx) => (
                          <tr key={a.id || `${a.auditedAt}-${idx}`} className="hover:bg-slate-900/50">
                            <td className="p-3.5 text-slate-300">{formatDate(a.auditedAt)}</td>
                            <td className="p-3.5 text-emerald-400 font-bold">{a.overallScore} / 100</td>
                            <td className="p-3.5 text-red-300">{a.issuesCriticalCount}</td>
                            <td className="p-3.5 text-amber-300">{a.issuesImportantCount}</td>
                            <td className="p-3.5 text-blue-300">{a.issuesOptimizationCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 11: PARAMÈTRES */}
        {activeTab === "settings" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <Card className="bg-slate-900/90 border-slate-800 p-6 sm:p-8 rounded-3xl space-y-6">
              <div className="space-y-1 border-b border-slate-800 pb-4">
                <h2 className="text-xl font-space font-bold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-emerald-400 shrink-0" /> Pondérations du Score Ecomfy
                </h2>
                <p className="text-xs text-slate-400">Répartition des facteurs dans l'algorithme d'audit technique Ecomfy. Les catégories non mesurées (performance, mobile) sont exclues du calcul.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {[
                  { label: "SEO Technique", weight: DEFAULT_SEO_WEIGHTS.technical },
                  { label: "Performance (Vitesse)", weight: DEFAULT_SEO_WEIGHTS.performance },
                  { label: "Contenu & Images", weight: DEFAULT_SEO_WEIGHTS.content },
                  { label: "Indexabilité & Sitemap", weight: DEFAULT_SEO_WEIGHTS.indexability },
                  { label: "Métadonnées", weight: DEFAULT_SEO_WEIGHTS.metadata },
                  { label: "Optimisation Mobile", weight: DEFAULT_SEO_WEIGHTS.mobile },
                ].map((w) => (
                  <div key={w.label} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                    <span>{w.label}</span>
                    <span className="font-bold font-mono text-emerald-400">{w.weight} %</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

      </main>

      {/* Auto-Fix Preview Modal */}
      {previewFixIssue && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" /> Prévisualisation de la Correction Automatique
              </h3>
              <Button size="icon" variant="ghost" onClick={() => setPreviewFixIssue(null)} aria-label="Fermer" className="h-8 w-8 text-slate-400">✕</Button>
            </div>

            <p className="text-xs text-slate-300">{previewFixIssue.title}</p>

            {previewFixIssue.beforeSnippet && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">AVANT :</span>
                <pre className="p-3 rounded-xl bg-red-950/40 border border-red-900/50 text-[11px] font-mono text-red-300 whitespace-pre-wrap break-words">
                  {previewFixIssue.beforeSnippet}
                </pre>
              </div>
            )}

            {previewFixIssue.afterSnippet && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">APRÈS :</span>
                <pre className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-900/50 text-[11px] font-mono text-emerald-300 whitespace-pre-wrap break-words">
                  {previewFixIssue.afterSnippet}
                </pre>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setPreviewFixIssue(null)} disabled={isApplyingFix} className="text-xs text-slate-400">Annuler</Button>
              <Button
                disabled={isApplyingFix}
                onClick={async () => {
                  const ok = await applyFix(previewFixIssue);
                  if (ok) setPreviewFixIssue(null);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl px-4"
              >
                {isApplyingFix ? "APPLICATION..." : "APPLIQUER LA CORRECTION"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponents
function ScoreBox({ title, score, weight }: { title: string; score: number | null; weight: string }) {
  return (
    <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{title} ({weight})</span>
      {score === null ? (
        <div className="text-sm font-semibold text-slate-500 pt-1.5">Non mesuré</div>
      ) : (
        <div className="text-2xl font-space font-bold text-emerald-400">{score} <span className="text-xs text-slate-500">/ 100</span></div>
      )}
    </div>
  );
}

function SpeedCard({ title, icon, valueClass, result }: { title: string; icon: React.ReactNode; valueClass: string; result: PageSpeedResult | null }) {
  const vitals = result?.webVitals;
  const items: { label: string; value: string | null }[] = [
    { label: "LCP", value: vitals?.lcp != null ? `${(vitals.lcp / 1000).toFixed(1)} s` : null },
    { label: "FCP", value: vitals?.fcp != null ? `${(vitals.fcp / 1000).toFixed(1)} s` : null },
    { label: "CLS", value: vitals?.cls != null ? String(vitals.cls) : null },
    { label: "TTFB", value: vitals?.ttfb != null ? `${vitals.ttfb} ms` : null },
    { label: "INP", value: vitals?.inp != null ? `${vitals.inp} ms` : null },
  ];

  return (
    <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
      <h3 className="font-bold text-sm text-white flex items-center gap-2">{icon} {title}</h3>
      <div className={`text-2xl sm:text-3xl font-space font-bold whitespace-nowrap ${valueClass}`}>
        {result?.performanceScore != null ? (
          `${result.performanceScore} / 100`
        ) : (
          <span className="text-xs sm:text-sm font-semibold text-slate-400 font-sans tracking-tight leading-none inline-block whitespace-nowrap">
            {result?.error ? "Analyse échouée" : "Données indisponibles"}
          </span>
        )}
      </div>
      {result?.error && <p className="text-[11px] text-amber-300">{result.error}</p>}
      {result?.performanceScore != null && (
        <div className="grid grid-cols-5 gap-2 text-center">
          {items.map((i) => (
            <div key={i.label} className="rounded-lg bg-slate-900 border border-slate-800 py-2">
              <div className="text-[10px] text-slate-500 font-bold">{i.label}</div>
              <div className="text-[11px] text-slate-200 font-mono">{i.value ?? "—"}</div>
            </div>
          ))}
        </div>
      )}
      <span className="text-[10px] text-slate-400 block font-mono">
        Source : PageSpeed Insights API{result?.analyzedAt ? ` · ${formatDate(result.analyzedAt)}` : ""}
      </span>
    </div>
  );
}

function Tooltip({ text }: { text: string }) {
  return (
    <div className="group relative inline-block">
      <Info className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 cursor-pointer" />
      <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 rounded-xl bg-slate-800 border border-slate-700 text-[10px] text-slate-200 shadow-xl z-20">
        {text}
      </div>
    </div>
  );
}
