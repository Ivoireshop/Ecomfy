import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Banknote, Download, Loader2, RefreshCw, ShieldAlert, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { deliveryService } from "@/lib/deliveryService";
import {
  FEE_KIND_LABELS,
  FEE_PAYMENT_STATUS_LABELS,
  type DeliveryCompanyFinance,
  type DeliveryFinanceAmount,
  type DeliveryFinanceSummary,
} from "@/types/delivery";

const fmtDay = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const money = (n: number, cur: string) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n)} ${cur}`;
const field = "bg-slate-950 border-slate-800 text-white placeholder:text-slate-500";
const secondaryBtn = "bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700 text-xs";

type Preset = "7" | "30" | "90" | "all" | "custom";
const PRESET_LABELS: Record<Preset, string> = { "7": "7 jours", "30": "30 jours", "90": "90 jours", all: "Tout", custom: "Personnalisée" };

/** Montants regroupés par devise : on n'additionne jamais des devises différentes. */
function byCurrency(rows: DeliveryFinanceAmount[]): Array<{ currency: string; amount: number; count: number }> {
  const map = new Map<string, { currency: string; amount: number; count: number }>();
  for (const r of rows) {
    const cur = map.get(r.currency) ?? { currency: r.currency, amount: 0, count: 0 };
    cur.amount += Number(r.amount);
    cur.count += Number(r.count);
    map.set(r.currency, cur);
  }
  return [...map.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Une cellule qui commencerait par = + - @ serait interprétée comme une formule par un tableur.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
  const text = [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function AmountList({ rows, empty = "—" }: { rows: Array<{ currency: string; amount: number; count?: number }>; empty?: string }) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <div className="space-y-0.5">
      {rows.map((r) => (
        <p key={r.currency} className="text-lg font-extrabold text-emerald-300">
          {money(r.amount, r.currency)}
          {r.count !== undefined && <span className="ml-2 text-[11px] font-normal text-slate-400">({r.count})</span>}
        </p>
      ))}
    </div>
  );
}

/** Gestion financière de l'administration (cahier des charges §11.3) : encaissements, cautions, Premium, renouvellements, attentes, restitutions, historique par structure. */
export default function DeliveryAdminFinancePage() {
  const { toast } = useToast();
  const [preset, setPreset] = useState<Preset>("30");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [summary, setSummary] = useState<DeliveryFinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<DeliveryCompanyFinance | null>(null);
  const [detailLoading, setDetailLoading] = useState<string | null>(null);

  const range = useMemo((): { from: Date | null; to: Date | null; valid: boolean } => {
    if (preset === "all") return { from: null, to: null, valid: true };
    if (preset === "custom") {
      const from = custom.from ? new Date(`${custom.from}T00:00:00`) : null;
      const to = custom.to ? new Date(`${custom.to}T23:59:59`) : null;
      return { from, to, valid: !(from && to && from > to) };
    }
    return { from: new Date(Date.now() - Number(preset) * 86_400_000), to: null, valid: true };
  }, [preset, custom]);

  const load = useCallback(async () => {
    if (!range.valid) {
      setSummary(null);
      setLoading(false);
      setError("La date de début est après la date de fin.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setSummary(await deliveryService.getFinanceSummary(range.from, range.to));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (companyId: string) => {
    setDetailLoading(companyId);
    try {
      setDetail(await deliveryService.getCompanyFinance(companyId));
    } catch (e) {
      toast({ variant: "destructive", title: "Historique indisponible", description: e instanceof Error ? e.message : undefined });
    } finally {
      setDetailLoading(null);
    }
  };

  const exportStructures = () => {
    if (!summary) return;
    downloadCsv(
      `finances-livraison-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Structure", "Devise", "Cotisations encaissées", "Caution détenue", "Caution restituée", "Premium encaissé", "En attente", "Dernier paiement"],
      summary.by_company.map((r) => [r.company_name, r.currency, r.membership, r.deposit_held, r.deposit_refunded, r.premium, r.pending, r.last_payment_at ? r.last_payment_at.slice(0, 10) : ""]),
    );
  };

  const exportDetail = () => {
    if (!detail) return;
    downloadCsv(
      `historique-${detail.company_name.replace(/[^a-zA-Z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Date", "Nature", "Formule", "Montant", "Devise", "Statut", "Mode", "Référence", "Début de période", "Fin de période", "Décision / motif", "Restituée le", "Modalités de restitution"],
      detail.payments.map((p) => [
        p.created_at.slice(0, 10), FEE_KIND_LABELS[p.kind], p.plan_label ?? "", p.amount, p.currency, FEE_PAYMENT_STATUS_LABELS[p.status], p.method, p.reference ?? "",
        p.period_start ? p.period_start.slice(0, 10) : "", p.period_end ? p.period_end.slice(0, 10) : "", p.decision_note ?? "", p.refunded_at ? p.refunded_at.slice(0, 10) : "", p.refund_note ?? "",
      ]),
    );
  };

  const collectedByKind = (kind: "membership" | "deposit" | "premium") => summary?.collected.filter((r) => r.kind === kind) ?? [];
  const alerts = summary ? summary.premium_expiring_30d + summary.membership_expiring_30d : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="border-b border-slate-800 pb-5">
          <Link to="/delivery-admin" className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline">
            <ArrowLeft className="w-3.5 h-3.5" /> Back-office Livraison
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-2 flex items-center gap-2">
            <Banknote className="w-7 h-7 text-emerald-400" /> Finances Livraison
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Cotisations, cautions, abonnements Premium, renouvellements, paiements en attente et restitutions. Les montants sont donnés par devise, jamais additionnés entre devises.
          </p>
        </div>

        {/* Période */}
        <Card className="bg-slate-900 border-slate-800 p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Période">
              {(Object.keys(PRESET_LABELS) as Preset[]).map((p) => (
                <Button
                  key={p}
                  size="sm"
                  aria-pressed={preset === p}
                  onClick={() => setPreset(p)}
                  className={preset === p ? "bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 text-xs" : secondaryBtn}
                >
                  {PRESET_LABELS[p]}
                </Button>
              ))}
            </div>
            {preset === "custom" && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="fin-from" className="text-xs text-slate-300">Du</Label>
                  <Input id="fin-from" type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className={field} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fin-to" className="text-xs text-slate-300">Au</Label>
                  <Input id="fin-to" type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className={field} />
                </div>
              </div>
            )}
            <Button size="sm" onClick={() => void load()} className={secondaryBtn}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Actualiser
            </Button>
          </div>
          <p className="text-[11px] text-slate-400">
            La période porte sur les encaissements, renouvellements et restitutions. Caution détenue, paiements en attente et échéances reflètent l'état à l'instant.
          </p>
        </Card>

        {error && (
          <div role="alert" className="p-3 rounded-xl bg-red-950/40 border border-red-900 text-xs text-red-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        {loading && !summary && <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</div>}

        {summary && (
          <>
            {/* Encaissements de la période */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(["membership", "deposit", "premium"] as const).map((k) => (
                <Card key={k} className="bg-slate-900 border-slate-800 p-4 space-y-1">
                  <h2 className="text-sm font-bold text-white">{k === "membership" ? "Cotisations encaissées" : k === "deposit" ? "Cautions encaissées" : "Abonnements Premium"}</h2>
                  <AmountList rows={collectedByKind(k)} empty="Aucun encaissement sur la période." />
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-slate-900 border-slate-800 p-4 space-y-1">
                <h2 className="text-sm font-bold text-white">Renouvellements</h2>
                <AmountList rows={byCurrency(summary.renewals)} empty="Aucun renouvellement sur la période." />
                <p className="text-[11px] text-slate-400">Cotisations et Premium payés par une structure déjà abonnée.</p>
              </Card>
              <Card className="bg-slate-900 border-slate-800 p-4 space-y-1">
                <h2 className="text-sm font-bold text-white">Paiements en attente</h2>
                <AmountList rows={byCurrency(summary.pending)} empty="Aucun paiement en attente." />
                <Link to="/delivery-admin/fees" className="text-[11px] text-emerald-400 hover:underline">Contrôler les paiements</Link>
              </Card>
              <Card className="bg-slate-900 border-slate-800 p-4 space-y-1">
                <h2 className="text-sm font-bold text-white">Cautions détenues</h2>
                <AmountList rows={summary.deposits_held} empty="Aucune caution détenue." />
                <p className="text-[11px] text-slate-400">À cet instant, hors cautions restituées.</p>
              </Card>
              <Card className="bg-slate-900 border-slate-800 p-4 space-y-1">
                <h2 className="text-sm font-bold text-white">Cautions restituées</h2>
                <AmountList rows={summary.refunded} empty="Aucune restitution sur la période." />
              </Card>
            </div>

            <Card className="bg-slate-900 border-slate-800 p-4 space-y-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-sm font-bold text-white">Abonnements et échéances</h2>
                <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px]">{summary.premium_active} Premium actif{summary.premium_active > 1 ? "s" : ""}</Badge>
                <Badge className={`border text-[10px] ${alerts > 0 ? "bg-red-500/15 text-red-300 border-red-500/30" : "bg-slate-800 text-slate-300 border-slate-700"}`}>
                  {alerts > 0 ? `${alerts} échéance${alerts > 1 ? "s" : ""} sous 30 jours` : "Aucune échéance sous 30 jours"}
                </Badge>
              </div>
              <p className="text-xs text-slate-300">
                {summary.premium_expiring_30d} abonnement{summary.premium_expiring_30d > 1 ? "s" : ""} Premium et {summary.membership_expiring_30d} cotisation{summary.membership_expiring_30d > 1 ? "s" : ""} arrivent à échéance dans les 30 prochains jours.
              </p>
            </Card>

            {/* Par structure */}
            <Card className="bg-slate-900 border-slate-800 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-white">Par structure</h2>
                <Button size="sm" onClick={exportStructures} disabled={summary.by_company.length === 0} className={secondaryBtn}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Exporter en CSV
                </Button>
              </div>
              {summary.by_company.length === 0 ? (
                <p className="text-xs text-slate-500">Aucun mouvement financier enregistré.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-xs whitespace-nowrap">
                    <thead>
                      <tr className="text-left text-slate-400 border-b border-slate-800">
                        <th className="py-2 pr-3 font-medium">Structure</th>
                        <th className="py-2 pr-3 font-medium">Devise</th>
                        <th className="py-2 pr-3 font-medium text-right">Cotisations</th>
                        <th className="py-2 pr-3 font-medium text-right">Caution détenue</th>
                        <th className="py-2 pr-3 font-medium text-right">Restituée</th>
                        <th className="py-2 pr-3 font-medium text-right">Premium</th>
                        <th className="py-2 pr-3 font-medium text-right">En attente</th>
                        <th className="py-2 pr-3 font-medium">Dernier paiement</th>
                        <th className="py-2 font-medium"><span className="sr-only">Historique</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {summary.by_company.map((r) => (
                        <tr key={`${r.company_id}-${r.currency}`}>
                          <td className="py-2 pr-3 font-semibold text-white">{r.company_name}</td>
                          <td className="py-2 pr-3 text-slate-300">{r.currency}</td>
                          <td className="py-2 pr-3 text-right text-slate-200">{money(r.membership, "")}</td>
                          <td className="py-2 pr-3 text-right text-slate-200">{money(r.deposit_held, "")}</td>
                          <td className="py-2 pr-3 text-right text-slate-200">{money(r.deposit_refunded, "")}</td>
                          <td className="py-2 pr-3 text-right text-slate-200">{money(r.premium, "")}</td>
                          <td className={`py-2 pr-3 text-right ${r.pending > 0 ? "text-sky-300" : "text-slate-200"}`}>{money(r.pending, "")}</td>
                          <td className="py-2 pr-3 text-slate-300">{fmtDay(r.last_payment_at)}</td>
                          <td className="py-2 text-right">
                            <Button size="sm" disabled={detailLoading === r.company_id} onClick={() => void openDetail(r.company_id)} aria-label={`Historique de ${r.company_name}`} className={secondaryBtn}>
                              {detailLoading === r.company_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Historique"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}

        {/* Historique d'une structure */}
        {detail && (
          <Card className="bg-slate-900 border-emerald-500/30 p-4 space-y-3" aria-label={`Historique financier de ${detail.company_name}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-white">Historique financier · {detail.company_name}</h2>
                <p className="text-[11px] text-slate-400">
                  {detail.city} · {detail.profile_type === "manager" ? "Structure" : "Livreur indépendant"}
                  {detail.premium?.active ? ` · Premium jusqu'au ${fmtDay(detail.premium.paid_until)}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={exportDetail} disabled={detail.payments.length === 0} className={secondaryBtn}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Exporter en CSV
                </Button>
                <Button size="sm" onClick={() => setDetail(null)} aria-label="Fermer l'historique" className={secondaryBtn}><X className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
            {detail.totals.length > 0 && (
              <p className="text-xs text-slate-300">
                Total encaissé : {detail.totals.map((t) => `${FEE_KIND_LABELS[t.kind!]} ${money(t.amount, t.currency)}`).join(" · ")}
              </p>
            )}
            {detail.payments.length === 0 ? (
              <p className="text-xs text-slate-500">Aucun paiement enregistré.</p>
            ) : (
              <ul className="divide-y divide-slate-800">
                {detail.payments.map((p) => (
                  <li key={p.id} className="py-2.5 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-white">
                        {FEE_KIND_LABELS[p.kind]}{p.plan_label ? ` · ${p.plan_label}` : ""} · {money(p.amount, p.currency)}
                      </span>
                      <Badge className="bg-slate-800 text-slate-200 border border-slate-700 text-[10px]">{FEE_PAYMENT_STATUS_LABELS[p.status]}</Badge>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {p.method}{p.reference ? ` · réf. ${p.reference}` : ""} · {p.source === "admin" ? "enregistré par l'administration" : "déclaré"} le {fmtDay(p.created_at)}
                      {p.status === "confirmed" && p.period_end ? ` · valable jusqu'au ${fmtDay(p.period_end)}` : ""}
                      {p.status === "refunded" ? ` · restituée le ${fmtDay(p.refunded_at)}${p.refund_note ? ` (${p.refund_note})` : ""}` : ""}
                    </div>
                    {p.status === "rejected" && p.decision_note && <div className="text-[11px] text-red-300">Motif : {p.decision_note}</div>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
