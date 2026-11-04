import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Layers, RefreshCw, ShieldCheck, Target, Zap } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

interface TrackingReconciliationProps {
  shopId: string;
}

interface DeliveryRow {
  provider: string;
  pixel_id: string;
  last_ok: boolean;
  last_http_status: number | null;
  last_error: string | null;
  last_error_code: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  consecutive_failures: number;
}

const PROVIDER_LABEL: Record<string, string> = { meta: "Meta", tiktok: "TikTok", snapchat: "Snapchat", ga4: "Google Analytics 4" };

// Explication en clair des refus les plus courants de l'API Meta.
function explainDeliveryError(row: DeliveryRow): string {
  if (row.provider === "meta") {
    if (row.last_error_code === "190") return "Le jeton d'accès Meta est expiré ou invalide. Générez-en un nouveau dans le Gestionnaire d'événements (Paramètres > API de conversions) et collez-le dans les réglages de la boutique.";
    if (row.last_error_code === "100") return "Meta refuse la requête : vérifiez que l'identifiant du pixel est correct et que le jeton appartient bien à ce pixel.";
    if (row.last_error_code === "200" || row.last_error_code === "10") return "Le jeton n'a pas l'autorisation d'écrire sur ce pixel.";
  }
  return row.last_error || "Envoi refusé par la plateforme.";
}

const NA = "—";
const fmt = (n: number | null | undefined, suffix = "") => (n === null || n === undefined ? NA : `${n}${suffix}`);

export function TrackingReconciliation({ shopId }: TrackingReconciliationProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState<7 | 30>(7);
  const [report, setReport] = useState<any>(null);
  const [delivery, setDelivery] = useState<DeliveryRow[] | null>(null);

  const fetchReconciliation = async (periodDays: 7 | 30 = days) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("reconcile-tracking", {
        body: { shop_id: shopId, days: periodDays },
      });

      if (error) {
        // Le message précis du serveur est dans le corps de la réponse (401/403/500).
        const serverMessage = await (error as any)?.context?.json?.().then((b: any) => b?.error).catch(() => undefined);
        throw new Error(serverMessage || error.message);
      }
      if (data?.success) {
        setReport(data.report);
      } else {
        throw new Error(data?.error || "Erreur lors du calcul de la réconciliation");
      }
    } catch (err: any) {
      toast({
        title: "Échec du calcul",
        description: err.message || "Impossible de contacter la fonction reconcile-tracking",
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

  // État des derniers envois serveur (jeton expiré, pixel refusé…). Table absente tant que la migration n'est pas appliquée : on masque la carte.
  useEffect(() => {
    if (!shopId) return;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("tracking_delivery_status")
        .select("provider, pixel_id, last_ok, last_http_status, last_error, last_error_code, last_success_at, last_failure_at, consecutive_failures")
        .eq("shop_id", shopId)
        .order("provider");
      setDelivery(error ? null : (data as DeliveryRow[]));
    })();
  }, [shopId]);

  const kpis = report?.kpis;
  const ref = report?.ecomfy_reference;
  const meta = report?.meta_telemetry;
  const daily = report?.daily_breakdown || [];
  const sample = report?.sample_orders || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-2xl text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
            <h2 className="text-xl font-bold tracking-tight">Réconciliation Ecomfy vs Meta</h2>
          </div>
          <p className="text-sm text-slate-300">
            Compare vos commandes aux achats que Meta a attribués à vos publicités. Aucune valeur n'est estimée.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            {([7, 30] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  days === d ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                {d} derniers jours
              </button>
            ))}
          </div>

          <Button
            onClick={() => fetchReconciliation(days)}
            disabled={loading}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold gap-2 rounded-xl shadow-lg hover:shadow-emerald-500/20"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Calcul en cours..." : "Actualiser"}
          </Button>
        </div>
      </div>

      {delivery && delivery.length > 0 && (
        <Card className="p-5 border border-slate-200/80 shadow-sm rounded-2xl bg-white space-y-3">
          <div>
            <h3 className="font-bold text-base text-slate-900">État des envois serveur</h3>
            <p className="text-xs text-slate-500">Résultat du dernier envoi de chaque pixel (API de conversions).</p>
          </div>
          <div className="space-y-2">
            {delivery.map((row) => (
              <div
                key={`${row.provider}-${row.pixel_id}`}
                className={`rounded-xl border p-3 text-sm ${row.last_ok ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">
                    {PROVIDER_LABEL[row.provider] || row.provider} · <span className="font-mono text-xs">{row.pixel_id}</span>
                  </span>
                  <Badge className={row.last_ok ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}>
                    {row.last_ok ? "Fonctionne" : `En échec (${row.consecutive_failures})`}
                  </Badge>
                </div>
                {!row.last_ok && <p className="mt-1 text-rose-900">{explainDeliveryError(row)}</p>}
                <p className="mt-1 text-xs text-slate-500">
                  {row.last_success_at ? `Dernier succès : ${new Date(row.last_success_at).toLocaleString("fr-FR")}` : "Aucun succès enregistré"}
                  {row.last_failure_at && !row.last_ok ? ` · Dernier échec : ${new Date(row.last_failure_at).toLocaleString("fr-FR")}` : ""}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {report && !meta?.api_connected && (
        <Card className="p-4 border border-amber-200 bg-amber-50 rounded-2xl flex gap-3 items-start">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Les achats Meta ne sont pas lisibles pour le moment.</p>
            <p className="mt-1">{meta?.error_message || "Liez votre compte publicitaire Meta pour comparer."}</p>
            <p className="mt-1 text-xs text-amber-800">
              Seules les commandes Ecomfy sont affichées ci-dessous. Vérifiez aussi vos événements dans le Gestionnaire d'événements Meta
              avec les identifiants d'événement de la dernière section.
            </p>
          </div>
        </Card>
      )}

      {report && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5 border border-slate-100 shadow-sm rounded-2xl bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Commandes à comptabiliser</span>
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="text-3xl font-black text-slate-900">{ref?.reference_orders_count ?? NA}</div>
            <p className="text-xs text-slate-500 mt-1">
              Sur {ref?.total_orders_recorded ?? 0} commande(s) : hors annulées, échouées et paiements en ligne non payés
            </p>
          </Card>

          <Card className="p-5 border border-slate-100 shadow-sm rounded-2xl bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Achats attribués par Meta</span>
              <Target className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="text-3xl font-black text-indigo-600">{fmt(kpis?.meta_purchases_attributed)}</div>
            <p className="text-xs text-slate-500 mt-1">
              {kpis?.attributed_share_pct === null || kpis?.attributed_share_pct === undefined
                ? "Non disponible"
                : `${kpis.attributed_share_pct}% des commandes à comptabiliser`}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Une commande non attribuée à une publicité, ou venue d'une autre source, n'apparaît pas ici : ce n'est pas forcément une perte.
            </p>
          </Card>

          <Card className="p-5 border border-slate-100 shadow-sm rounded-2xl bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Jours où Meta dépasse Ecomfy</span>
              <Layers className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-3xl font-black text-slate-900">{fmt(kpis?.days_meta_above_ecomfy)}</div>
            <p className="text-xs text-slate-500 mt-1">
              Signe possible d'achats comptés en double, ou d'un décalage de fuseau horaire du compte publicitaire
            </p>
          </Card>
        </div>
      )}

      <Card className="p-6 border border-slate-200/80 shadow-sm rounded-2xl bg-white space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h3 className="font-bold text-lg text-slate-900">Analyse quotidienne</h3>
            <p className="text-xs text-slate-500">
              Jours en UTC pour Ecomfy, fuseau du compte publicitaire pour Meta : un léger décalage est normal
            </p>
          </div>
          <Badge variant="outline" className="text-slate-600">
            {report?.period?.startDate?.split("T")[0]} au {report?.period?.endDate?.split("T")[0]}
          </Badge>
        </div>

        {daily.length > 0 && (
          <div className="h-[280px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748B" }} />
                <Tooltip contentStyle={{ backgroundColor: "#0F172A", color: "#FFF", borderRadius: "12px", border: "none" }} />
                <Legend />
                <Bar dataKey="ecomfy_orders" name="Commandes Ecomfy" fill="#4F46E5" radius={[6, 6, 0, 0]} />
                {meta?.api_connected && (
                  <Bar dataKey="meta_purchases" name="Achats attribués Meta" fill="#10B981" radius={[6, 6, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider border-b">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Commandes Ecomfy</th>
                <th className="py-3 px-4 text-right">Achats Meta</th>
                <th className="py-3 px-4 text-right">Écart</th>
                <th className="py-3 px-4 text-right">Écart %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {daily.map((row: any) => (
                <tr key={row.date} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 font-semibold text-slate-900">{row.date}</td>
                  <td className="py-2.5 px-4 text-right font-bold text-indigo-600">{row.ecomfy_orders}</td>
                  <td className="py-2.5 px-4 text-right font-bold text-emerald-600">{fmt(row.meta_purchases)}</td>
                  <td className="py-2.5 px-4 text-right font-semibold">{fmt(row.delta_abs)}</td>
                  <td className="py-2.5 px-4 text-right">{fmt(row.delta_pct, "%")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {sample.length > 0 && (
        <Card className="p-6 border border-slate-200/80 shadow-sm rounded-2xl bg-white space-y-4">
          <div className="border-b pb-3">
            <h3 className="font-bold text-base text-slate-900">Dernières commandes et identifiant d'événement</h3>
            <p className="text-xs text-slate-500">
              Cherchez cet identifiant dans le Gestionnaire d'événements Meta pour vérifier qu'un achat a bien été reçu (navigateur et serveur).
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-xs text-left text-slate-700">
              <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider border-b">
                <tr>
                  <th className="py-3 px-4">Commande</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Montant</th>
                  <th className="py-3 px-4">Paiement</th>
                  <th className="py-3 px-4">Identifiant d'événement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sample.map((s: any) => (
                  <tr key={s.order_number} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{s.order_number}</td>
                    <td className="py-2.5 px-4 text-slate-500">{new Date(s.date).toLocaleString("fr-FR")}</td>
                    <td className="py-2.5 px-4 font-semibold">{s.montant?.toLocaleString("fr-FR")} {s.currency}</td>
                    <td className="py-2.5 px-4">
                      {s.payment_method || NA} · {s.payment_status || NA}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs text-indigo-600">{s.event_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
