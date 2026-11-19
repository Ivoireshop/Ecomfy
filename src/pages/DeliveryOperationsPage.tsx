import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, BarChart3, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { deliveryService } from "@/lib/deliveryService";
import { DeliveryAdminOperations } from "@/types/delivery";

const PERIODS = [
  { days: 7, label: "7 jours" },
  { days: 30, label: "30 jours" },
  { days: 90, label: "90 jours" },
];

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

/** Contrôle des opérations de livraison par l'administration Ecomfy (cahier des charges §11.2). */
export default function DeliveryOperationsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<DeliveryAdminOperations | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await deliveryService.getAdminOperations(days));
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  const t = data?.totals;
  const kpis = t ? [
    { label: "Transmises", value: t.transmitted, tone: "text-white" },
    { label: "Acceptées", value: t.accepted, tone: "text-sky-400" },
    { label: "En cours", value: t.in_progress, tone: "text-amber-400" },
    { label: "Livrées", value: t.delivered, tone: "text-emerald-400" },
    { label: "Échouées / retournées", value: t.failed + t.returned, tone: "text-red-400" },
    { label: "Refusées / annulées", value: t.refused + t.cancelled, tone: "text-slate-300" },
  ] : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <Link to="/delivery-admin" className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline">
              <ArrowLeft className="w-3.5 h-3.5" /> Back-office Livraison
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-2 flex items-center gap-2">
              <BarChart3 className="w-7 h-7 text-emerald-400" /> Contrôle des opérations
            </h1>
            <p className="text-xs text-slate-400">Volumes, performances des structures, litiges et incidents sur la période choisie.</p>
          </div>
          <div className="flex items-center gap-2">
            {PERIODS.map((p) => (
              <Button
                key={p.days}
                size="sm"
                variant={days === p.days ? "default" : "outline"}
                className={days === p.days ? "bg-emerald-500 text-slate-950 hover:bg-emerald-600" : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-900 hover:text-white"}
                onClick={() => setDays(p.days)}
              >
                {p.label}
              </Button>
            ))}
            <Button size="sm" variant="outline" className="bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-900 hover:text-white" onClick={() => void load()} aria-label="Actualiser">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {error && <Card className="bg-slate-900 border-red-500/40 p-4 text-sm text-red-300">{error}</Card>}

        {data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              {kpis.map((k) => (
                <Card key={k.label} className="bg-slate-900 border-slate-800 p-4">
                  <p className="text-[11px] text-slate-400">{k.label}</p>
                  <p className={`text-2xl font-bold ${k.tone}`}>{k.value}</p>
                </Card>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Montant à encaisser sur les livraisons réussies : {Number(t?.cod_total ?? 0).toLocaleString("fr-FR")} XOF.
            </p>

            <Card className="bg-slate-900 border-slate-800 p-4 space-y-3">
              <h2 className="text-lg font-bold text-white">Performances des structures</h2>
              {data.companies.length === 0 ? (
                <p className="text-sm text-slate-500">Aucune commande transmise sur cette période.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-slate-500">
                      <tr>
                        {["Structure", "Transmises", "Acceptées", "Refusées", "Livrées", "Échecs", "Réussite", "Livreurs actifs"].map((h) => (
                          <th key={h} className="py-2 pr-3 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="text-slate-200">
                      {data.companies.map((c) => (
                        <tr key={c.company_id} className="border-t border-slate-800">
                          <td className="py-2 pr-3 font-semibold">
                            {c.company_name}
                            {c.verification_status !== "approved" && (
                              <Badge className="ml-2 bg-amber-500/20 text-amber-300 text-[10px]">{c.verification_status}</Badge>
                            )}
                          </td>
                          <td className="py-2 pr-3">{c.transmitted}</td>
                          <td className="py-2 pr-3">{c.accepted}</td>
                          <td className="py-2 pr-3">{c.refused}</td>
                          <td className="py-2 pr-3 text-emerald-400">{c.delivered}</td>
                          <td className="py-2 pr-3 text-red-400">{c.failed}</td>
                          <td className="py-2 pr-3">{c.success_rate === null ? "—" : `${c.success_rate} %`}</td>
                          <td className="py-2">{c.active_drivers}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <div className="grid lg:grid-cols-2 gap-4">
              <Card className="bg-slate-900 border-slate-800 p-4 space-y-3">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" /> Litiges ouverts ({data.disputes.length})
                </h2>
                {data.disputes.length === 0 ? (
                  <p className="text-sm text-slate-500">Aucun litige ouvert.</p>
                ) : (
                  data.disputes.map((d) => (
                    <div key={d.dispatch_id} className="rounded-lg border border-slate-800 p-3 text-xs space-y-1">
                      <p className="font-semibold text-slate-100">{d.company_name} · {d.shop_name ?? "Boutique"} · {d.recipient_name}</p>
                      <p className="text-slate-400">{Number(d.cod_amount).toLocaleString("fr-FR")} {d.currency} · signalé le {formatDate(d.raised_at)}</p>
                      {d.reason && <p className="text-red-300">{d.reason}</p>}
                    </div>
                  ))
                )}
              </Card>
              <Card className="bg-slate-900 border-slate-800 p-4 space-y-3">
                <h2 className="text-lg font-bold text-white">Livraisons échouées ({data.incidents.length})</h2>
                {data.incidents.length === 0 ? (
                  <p className="text-sm text-slate-500">Aucune livraison échouée sur la période.</p>
                ) : (
                  data.incidents.map((i) => (
                    <div key={i.dispatch_id} className="rounded-lg border border-slate-800 p-3 text-xs space-y-1">
                      <p className="font-semibold text-slate-100">{i.company_name} · {i.recipient_name} · {i.city}</p>
                      <p className="text-slate-400">{formatDate(i.failed_at)}</p>
                      {i.reason && <p className="text-red-300">{i.reason}</p>}
                    </div>
                  ))
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
