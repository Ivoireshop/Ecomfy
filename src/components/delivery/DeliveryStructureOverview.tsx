import { useState } from "react";
import { Card } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { activityRows, overviewCounts, type DeliveryCompanyOverview } from "@/lib/deliveryOverview";

// Tableau de bord de la structure (cahier §3.1) : compteurs par état et activité quotidienne, comptés par la base.

const dayLabel = (day: string) => {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" });
};

interface Props {
  /** null tant que les totaux ne sont pas lus (ou s'ils sont illisibles) : on affiche « — », jamais zéro. */
  overview: DeliveryCompanyOverview | null;
  activeDrivers: number;
}

export function DeliveryStructureOverview({ overview, activeDrivers }: Props) {
  const [days, setDays] = useState<7 | 14 | 30>(7);

  const counts = overview ? overviewCounts(overview.by_status) : null;
  const rows = overview ? activityRows(overview.daily, days) : [];

  const totals = rows.reduce((a, r) => ({
    received: a.received + r.received, delivered: a.delivered + r.delivered, failed: a.failed + r.failed, returned: a.returned + r.returned,
  }), { received: 0, delivered: 0, failed: 0, returned: 0 });
  const max = Math.max(1, ...rows.map((r) => Math.max(r.received, r.delivered, r.failed, r.returned)));

  const cards: { label: string; value: number | undefined; tone: string }[] = [
    { label: "Commandes reçues", value: counts?.total, tone: "text-white" },
    { label: "Nouvelles en attente", value: counts?.fresh, tone: "text-rose-400" },
    { label: "Acceptées", value: counts?.accepted, tone: "text-amber-400" },
    { label: "En cours de livraison", value: counts?.inProgress, tone: "text-blue-400" },
    { label: "Livrées", value: counts?.delivered, tone: "text-emerald-400" },
    { label: "Échouées", value: counts?.failed, tone: "text-red-400" },
    { label: "Retournées", value: counts?.returned, tone: "text-orange-400" },
    { label: "Livreurs actifs", value: activeDrivers, tone: "text-sky-400" },
  ];

  return (
    <section className="space-y-3" aria-label="Vue d'ensemble de la structure">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className="bg-slate-900 border-slate-800 p-4 space-y-1">
            <span className="text-xs text-slate-400">{c.label}</span>
            <div className={`text-2xl font-bold ${c.tone}`}>{c.value ?? "—"}</div>
          </Card>
        ))}
      </div>

      <Card className="bg-slate-900 border-slate-800 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" /> Activité quotidienne
          </h2>
          <div className="flex gap-1" role="group" aria-label="Période de l'activité">
            {([7, 14, 30] as const).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={days === n}
                onClick={() => setDays(n)}
                className={`px-2.5 py-1 rounded-md text-xs border ${days === n ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300" : "bg-slate-950 border-slate-700 text-slate-400"}`}
              >
                {n} jours
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-400">
          {overview ? (
            <>
              Sur {days} jours : {totals.received} reçue{totals.received > 1 ? "s" : ""}, {totals.delivered} livrée{totals.delivered > 1 ? "s" : ""},{" "}
              {totals.failed} échouée{totals.failed > 1 ? "s" : ""}, {totals.returned} retournée{totals.returned > 1 ? "s" : ""}.
            </>
          ) : "Activité en cours de lecture…"}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] text-xs whitespace-nowrap">
            <thead>
              <tr className="text-slate-400 text-left">
                <th className="py-1 pr-3 font-medium">Jour</th>
                <th className="py-1 px-2 font-medium text-right">Reçues</th>
                <th className="py-1 px-2 font-medium text-right">Livrées</th>
                <th className="py-1 px-2 font-medium text-right">Échouées</th>
                <th className="py-1 px-2 font-medium text-right">Retournées</th>
                <th className="py-1 pl-3 font-medium w-1/3"><span className="sr-only">Volume</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.day} className="border-t border-slate-800 text-slate-200">
                  <td className="py-1 pr-3 capitalize">{dayLabel(r.day)}</td>
                  <td className="py-1 px-2 text-right tabular-nums">{r.received}</td>
                  <td className="py-1 px-2 text-right tabular-nums text-emerald-400">{r.delivered}</td>
                  <td className="py-1 px-2 text-right tabular-nums text-red-400">{r.failed}</td>
                  <td className="py-1 px-2 text-right tabular-nums text-orange-400">{r.returned}</td>
                  <td className="py-1 pl-3">
                    <div className="h-2 rounded bg-slate-800 overflow-hidden" aria-hidden="true">
                      <div className="h-full bg-emerald-500" style={{ width: `${(r.delivered / max) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

export default DeliveryStructureOverview;
