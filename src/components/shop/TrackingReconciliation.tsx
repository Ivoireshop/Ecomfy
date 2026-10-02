import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Activity, ArrowDownRight, ArrowUpRight, CheckCircle2, AlertTriangle, 
  RefreshCw, ShieldCheck, Zap, BarChart2, Layers, Target, EyeOff 
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from "recharts";

interface TrackingReconciliationProps {
  shopId: string;
}

export function TrackingReconciliation({ shopId }: TrackingReconciliationProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState<7 | 30>(7);
  const [report, setReport] = useState<any>(null);

  const fetchReconciliation = async (periodDays: 7 | 30 = days) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("reconcile-tracking", {
        body: { shop_id: shopId, days: periodDays },
      });

      if (error) throw error;
      if (data?.success) {
        setReport(data.report);
      } else {
        throw new Error(data?.error || "Erreur lors du calcul de la réconciliation");
      }
    } catch (err: any) {
      toast({
        title: "Échec du calcul automatique",
        description: err.message || "Impossible de contacter l'Edge Function reconcile-tracking",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (shopId) {
      fetchReconciliation(days);
    }
  }, [shopId, days]);

  const kpis = report?.kpis;
  const ref = report?.ecomfy_reference;
  const meta = report?.meta_telemetry;
  const daily = report?.daily_breakdown || [];
  const sample = report?.sample_orders || [];
  const summary = report?.final_summary;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-2xl text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
            <h2 className="text-xl font-bold tracking-tight">Réconciliation Automatique Ecomfy vs Meta</h2>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
              Procédure 22 BIS Activée
            </Badge>
          </div>
          <p className="text-sm text-slate-300">
            Comparaison chiffrée automatique entre les commandes Supabase DB et les événements Meta Purchase.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setDays(7)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                days === 7 ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              7 Derniers Jours
            </button>
            <button
              onClick={() => setDays(30)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                days === 30 ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              30 Derniers Jours
            </button>
          </div>

          <Button
            onClick={() => fetchReconciliation(days)}
            disabled={loading}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold gap-2 rounded-xl shadow-lg hover:shadow-emerald-500/20"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Calcul en cours..." : "Re-synchroniser"}
          </Button>
        </div>
      </div>

      {/* Main KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 border border-slate-100 shadow-sm rounded-2xl bg-white relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Taux de Couverture</span>
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="text-3xl font-black text-slate-900">{kpis.tracking_coverage_pct}%</div>
            <p className="text-xs text-slate-500 mt-1">
              Purchase Meta reçus / Commandes Ecomfy de référence
            </p>
            <div className="mt-3 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, kpis.tracking_coverage_pct)}%` }}
              />
            </div>
          </Card>

          <Card className="p-5 border border-slate-100 shadow-sm rounded-2xl bg-white relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Taux de Perte Apparente</span>
              <EyeOff className="w-5 h-5 text-rose-500" />
            </div>
            <div className="text-3xl font-black text-rose-600">{kpis.loss_rate_pct}%</div>
            <p className="text-xs text-slate-500 mt-1">
              {kpis.loss_count_abs} commande(s) non retrouvée(s)
            </p>
            <div className="mt-3 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-rose-500 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, kpis.loss_rate_pct)}%` }}
              />
            </div>
          </Card>

          <Card className="p-5 border border-slate-100 shadow-sm rounded-2xl bg-white relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Taux de Doublon</span>
              <Layers className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-3xl font-black text-slate-900">{kpis.duplicate_rate_pct}%</div>
            <p className="text-xs text-slate-500 mt-1">
              {kpis.duplicate_count_abs} Purchase en excès détecté(s)
            </p>
            <div className="mt-3 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, kpis.duplicate_rate_pct)}%` }}
              />
            </div>
          </Card>

          <Card className="p-5 border border-slate-100 shadow-sm rounded-2xl bg-white relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Taux d'Attribution Meta</span>
              <Target className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="text-3xl font-black text-indigo-600">{kpis.attribution_rate_pct}%</div>
            <p className="text-xs text-slate-500 mt-1">
              Purchase attribués aux campagnes Meta Ads
            </p>
            <div className="mt-3 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, kpis.attribution_rate_pct)}%` }}
              />
            </div>
          </Card>
        </div>
      )}

      {/* Daily Comparison Chart & Table */}
      <Card className="p-6 border border-slate-200/80 shadow-sm rounded-2xl bg-white space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h3 className="font-bold text-lg text-slate-900">Analyse Quotidienne Ecomfy vs Meta</h3>
            <p className="text-xs text-slate-500">Comparaison jour par jour sur les {days} derniers jours</p>
          </div>
          <Badge variant="outline" className="text-slate-600">
            {report?.period?.startDate?.split("T")[0]} au {report?.period?.endDate?.split("T")[0]} (UTC)
          </Badge>
        </div>

        {daily.length > 0 && (
          <div className="h-[280px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748B" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0F172A", color: "#FFF", borderRadius: "12px", border: "none" }}
                />
                <Legend />
                <Bar dataKey="ecomfy_orders" name="Commandes Ecomfy" fill="#4F46E5" radius={[6, 6, 0, 0]} />
                <Bar dataKey="meta_purchases" name="Purchase Meta Reçus" fill="#10B981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="meta_attributed" name="Attribués Meta Ads" fill="#F59E0B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Daily Breakdown Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider border-b">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Commandes Ecomfy</th>
                <th className="py-3 px-4 text-right">Purchase Meta</th>
                <th className="py-3 px-4 text-right">Écart Absolu</th>
                <th className="py-3 px-4 text-right">Écart %</th>
                <th className="py-3 px-4 text-right">Attribués Meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {daily.map((row: any) => (
                <tr key={row.date} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 font-semibold text-slate-900">{row.date}</td>
                  <td className="py-2.5 px-4 text-right font-bold text-indigo-600">{row.ecomfy_orders}</td>
                  <td className="py-2.5 px-4 text-right font-bold text-emerald-600">{row.meta_purchases}</td>
                  <td className={`py-2.5 px-4 text-right font-semibold ${row.delta_abs > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {row.delta_abs}
                  </td>
                  <td className="py-2.5 px-4 text-right">{row.delta_pct}%</td>
                  <td className="py-2.5 px-4 text-right font-semibold text-amber-600">{row.meta_attributed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Sample Verification Table */}
      {sample.length > 0 && (
        <Card className="p-6 border border-slate-200/80 shadow-sm rounded-2xl bg-white space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="font-bold text-base text-slate-900">Échantillon de Vérification par Commande (22 BIS.12)</h3>
              <p className="text-xs text-slate-500">Contrôle de bout en bout de l'event_id et de la catégorie d'attribution</p>
            </div>
            <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200">
              {sample.length} Commandes Vérifiées
            </Badge>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-xs text-left text-slate-700">
              <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider border-b">
                <tr>
                  <th className="py-3 px-4">Commande</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Montant</th>
                  <th className="py-3 px-4">Event ID</th>
                  <th className="py-3 px-4">Catégorie de Réconciliation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sample.map((s: any) => (
                  <tr key={s.order_number} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{s.order_number}</td>
                    <td className="py-2.5 px-4 text-slate-500">{new Date(s.date).toLocaleString("fr-FR")}</td>
                    <td className="py-2.5 px-4 font-semibold">{s.montant?.toLocaleString("fr-FR")} {s.currency}</td>
                    <td className="py-2.5 px-4 font-mono text-xs text-indigo-600 bg-indigo-50/50 rounded px-1.5 py-0.5 w-fit">
                      {s.event_id}
                    </td>
                    <td className="py-2.5 px-4 font-semibold">
                      <Badge
                        className={
                          s.category.startsWith("A")
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : s.category.startsWith("B")
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }
                      >
                        {s.category}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Final Summary Card (22 BIS.16 & 22 BIS.17) */}
      {summary && (
        <Card className="p-6 border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-50/30 via-white to-purple-50/30 shadow-lg rounded-2xl space-y-4">
          <div className="flex items-center gap-2 text-indigo-950 font-bold text-lg border-b border-indigo-100 pb-3">
            <CheckCircle2 className="w-5 h-5 text-indigo-600" />
            Conclusion Chiffrée Formelle (22 BIS.17)
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-600">Commandes Ecomfy de référence :</span>
                <span className="font-bold text-slate-900">{summary.reference_orders}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-600">Purchase Meta identifiables :</span>
                <span className="font-bold text-emerald-600">{summary.purchases_identifiable}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-600">Commandes non retrouvées (perte) :</span>
                <span className="font-bold text-rose-600">{summary.purchases_untracked}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-600">Doublons potentiels détectés :</span>
                <span className="font-bold text-amber-600">{summary.purchases_duplicates}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-600">Purchase attribués Meta Ads :</span>
                <span className="font-bold text-indigo-600">{summary.purchases_attributed}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-600">Niveau de Confiance Diagnostic :</span>
                <Badge className="bg-emerald-600 text-white font-bold">{summary.diagnostic_confidence}</Badge>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
