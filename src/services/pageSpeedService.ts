// src/services/pageSpeedService.ts
// Service fetching real PageSpeed Insights / Lighthouse API metrics for Mobile & Desktop.

import { PageSpeedResult } from "@/types/seoIntelligence";

export class PageSpeedService {
  /**
   * Fetch PageSpeed Insights performance metrics for a URL.
   */
  public static async analyzeUrl(
    targetUrl: string,
    device: 'mobile' | 'desktop' = 'mobile'
  ): Promise<PageSpeedResult> {
    try {
      const cleanUrl = targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`;
      const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(cleanUrl)}&strategy=${device}&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO`;

      const response = await fetch(apiUrl, { method: "GET" });
      if (!response.ok) {
        throw new Error(`PageSpeed API returned status ${response.status}`);
      }

      const json = await response.json();
      const lighthouse = json?.lighthouseResult;
      const categories = lighthouse?.categories;

      const performanceScore = categories?.performance?.score != null ? Math.round(categories.performance.score * 100) : null;
      const accessibilityScore = categories?.accessibility?.score != null ? Math.round(categories.accessibility.score * 100) : null;
      const bestPracticesScore = categories?.['best-practices']?.score != null ? Math.round(categories['best-practices'].score * 100) : null;
      const seoScore = categories?.seo?.score != null ? Math.round(categories.seo.score * 100) : null;

      const audits = lighthouse?.audits;
      const lcp = audits?.['largest-contentful-paint']?.numericValue != null ? Math.round(audits['largest-contentful-paint'].numericValue) : null;
      const fcp = audits?.['first-contentful-paint']?.numericValue != null ? Math.round(audits['first-contentful-paint'].numericValue) : null;
      const cls = audits?.['cumulative-layout-shift']?.numericValue != null ? Number(audits['cumulative-layout-shift'].numericValue.toFixed(3)) : null;
      const inp = audits?.['interactive']?.numericValue != null ? Math.round(audits['interactive'].numericValue) : null;
      const ttfb = audits?.['server-response-time']?.numericValue != null ? Math.round(audits['server-response-time'].numericValue) : null;

      return {
        device,
        performanceScore,
        accessibilityScore,
        bestPracticesScore,
        seoScore,
        webVitals: { lcp, fcp, cls, inp, ttfb },
        source: 'PageSpeed Insights',
        analyzedAt: new Date().toISOString(),
      };
    } catch {
      return {
        device,
        performanceScore: null,
        accessibilityScore: null,
        bestPracticesScore: null,
        seoScore: null,
        webVitals: { lcp: null, fcp: null, cls: null, inp: null, ttfb: null },
        source: 'PageSpeed Insights',
        analyzedAt: null,
      };
    }
  }
}
