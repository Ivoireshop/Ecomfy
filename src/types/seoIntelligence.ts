// src/types/seoIntelligence.ts
// Complete TypeScript definitions for ECOMFY SEO INTELLIGENCE module.

export type SeoMetricSource = 
  | 'Google Search Console'
  | 'Algorithme Ecomfy'
  | 'PageSpeed Insights'
  | 'Fournisseur Externe';

export type SeoIssueSeverity = 'critical' | 'important' | 'optimization' | 'ok';

export interface SeoIssue {
  id: string;
  category: 'technical' | 'performance' | 'content' | 'indexability' | 'metadata' | 'mobile';
  severity: SeoIssueSeverity;
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  affectedUrl?: string;
  canAutoFix: boolean;
  fixActionKey?: string;
  beforeSnippet?: string;
  afterSnippet?: string;
}

export interface SeoAuditWeights {
  technical: number; // default 25
  performance: number; // default 20
  content: number; // default 20
  indexability: number; // default 15
  metadata: number; // default 10
  mobile: number; // default 10
}

export interface SeoAuditResult {
  id?: string;
  shopId: string;
  scannedDomain: string;
  overallScore: number;
  technicalScore: number;
  performanceScore: number;
  contentScore: number;
  indexabilityScore: number;
  metadataScore: number;
  mobileScore: number;
  issuesCriticalCount: number;
  issuesImportantCount: number;
  issuesOptimizationCount: number;
  issues: SeoIssue[];
  auditedAt: string;
  source: 'Algorithme Ecomfy';
}

export interface GscMetricData {
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  position: number | null;
  source: 'Google Search Console';
  lastSyncedAt: string | null;
  period: '7d' | '28d' | '3m' | '6m' | '12m';
}

export interface GscQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscPageRow {
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscProperty {
  siteUrl: string;
  permissionLevel: string;
  isCompatible: boolean;
}

export interface GscOpportunity {
  type: 'high_impressions_low_ctr' | 'striking_distance' | 'emerging_keyword' | 'top_performer';
  title: string;
  query: string;
  pageUrl?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  suggestion: string;
}

export interface CoreWebVitals {
  lcp: number | null; // ms
  fcp: number | null; // ms
  cls: number | null;
  inp: number | null; // ms
  ttfb: number | null; // ms
}

export interface PageSpeedResult {
  device: 'mobile' | 'desktop';
  performanceScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  seoScore: number | null;
  webVitals: CoreWebVitals;
  source: 'PageSpeed Insights';
  analyzedAt: string | null;
}

export interface UrlInspectionResult {
  inspectUrl: string;
  verdict: 'INDEXED' | 'NOT_INDEXED' | 'NEUTRAL' | 'UNAVAILABLE';
  coverageState: string;
  indexingState: string;
  canonicalUrl?: string;
  googleCanonicalUrl?: string;
  lastCrawlTime?: string;
  source: 'Google Search Console URL Inspection API';
}

export interface StructuredDataPreview {
  type: 'Product' | 'Organization' | 'BreadcrumbList' | 'FAQPage';
  isValid: boolean;
  jsonLdSnippet: string;
  detectedFields: string[];
  missingFields: string[];
}

export interface PlatformSeoGlobalStats {
  totalConnectedShops: number;
  totalAuditedDomains: number;
  avgPlatformSeoScore: number;
  totalCriticalIssues: number;
  avgMobilePerformance: number;
  shopsNeedingAttentionCount: number;
}
