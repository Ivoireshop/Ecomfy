// src/services/seoReportService.ts
// PDF and CSV report generator for ECOMFY SEO INTELLIGENCE.

import { GscMetricData, PageSpeedResult, SeoAuditResult } from "@/types/seoIntelligence";

export class SeoReportService {
  /**
   * Export SEO Queries as CSV.
   */
  public static exportQueriesToCsv(queries: any[]): void {
    if (!queries || queries.length === 0) return;

    const headers = ["Mot-cle", "Clics", "Impressions", "CTR (%)", "Position"];
    const rows = queries.map(q => [
      `"${q.query.replace(/"/g, '""')}"`,
      q.clicks,
      q.impressions,
      q.ctr,
      q.position
    ]);

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `rapport-mots-cles-seo-ecomfy-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Print / Generate PDF Report window.
   */
  public static generatePdfReport(
    shopName: string,
    domain: string,
    audit: SeoAuditResult | null,
    gsc: GscMetricData,
    mobileSpeed: PageSpeedResult | null
  ): void {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const dateStr = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

    const html = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Rapport SEO Intelligence - ${shopName}</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0f172a; margin: 40px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0e7c66; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { font-size: 24px; font-weight: 800; color: #0e7c66; }
          .badge { background: #e6f4f1; color: #0e7c66; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
          .score-card { background: #0f172a; color: white; padding: 24px; border-radius: 16px; margin-bottom: 30px; }
          .score-number { font-size: 48px; font-weight: 900; color: #10b981; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
          .card { border: 1px solid #e2e8f0; padding: 16px; border-radius: 12px; }
          .title { font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: bold; }
          .val { font-size: 24px; font-weight: 800; margin-top: 4px; }
          .footer { border-top: 1px solid #e2e8f0; pt: 20px; margin-top: 40px; font-size: 11px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">ECOMFY SEO INTELLIGENCE</div>
            <div style="font-size:14px; color:#64748b; margin-top:4px;">Rapport d'analyse SEO pour <strong>${shopName}</strong> (${domain})</div>
          </div>
          <div class="badge">Généré le ${dateStr}</div>
        </div>

        <div class="score-card">
          <div style="font-size:14px; opacity:0.8;">SCORE SEO ECOMFY</div>
          <div class="score-number">${audit?.overallScore ?? 'N/A'}<span style="font-size:24px; color:#94a3b8;">/100</span></div>
          <div style="font-size:12px; opacity:0.7; margin-top:8px;">Source : Algorithme d'audit technique Ecomfy</div>
        </div>

        <h3 style="font-size:16px; margin-bottom:12px;">1. Performance Google Search Console</h3>
        <div class="grid">
          <div class="card">
            <div class="title">Clics Google</div>
            <div class="val">${gsc.clicks !== null ? gsc.clicks.toLocaleString() : 'Non connecté'}</div>
            <div style="font-size:11px; color:#64748b; margin-top:4px;">Source : Google Search Console</div>
          </div>
          <div class="card">
            <div class="title">Impressions</div>
            <div class="val">${gsc.impressions !== null ? gsc.impressions.toLocaleString() : 'Non connecté'}</div>
            <div style="font-size:11px; color:#64748b; margin-top:4px;">Source : Google Search Console</div>
          </div>
          <div class="card">
            <div class="title">CTR Moyen</div>
            <div class="val">${gsc.ctr !== null ? gsc.ctr + ' %' : 'N/A'}</div>
            <div style="font-size:11px; color:#64748b; margin-top:4px;">Source : Google Search Console</div>
          </div>
          <div class="card">
            <div class="title">Position Moyenne</div>
            <div class="val">${gsc.position !== null ? gsc.position : 'N/A'}</div>
            <div style="font-size:11px; color:#64748b; margin-top:4px;">Source : Google Search Console</div>
          </div>
        </div>

        <h3 style="font-size:16px; margin-bottom:12px;">2. Audit Technique & Problèmes Détectés</h3>
        <div style="margin-bottom:30px;">
          ${(audit?.issues || []).slice(0, 5).map(issue => `
            <div style="border-left: 4px solid ${issue.severity === 'critical' ? '#ef4444' : issue.severity === 'important' ? '#f59e0b' : '#3b82f6'}; padding-left: 12px; margin-bottom: 12px;">
              <strong style="font-size:14px;">${issue.title}</strong>
              <div style="font-size:12px; color:#475569; margin-top:2px;">${issue.description}</div>
            </div>
          `).join('')}
        </div>

        <div class="footer">
          Rapport généré automatiquement par la plateforme Ecomfy (ecomfy.cloud) — Transparence et métriques réelles sans extrapolation.
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
}
