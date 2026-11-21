import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import type { DeliveryDispatch } from "@/types/delivery";

// Tableau de bord de la structure (cahier §3.1) : compteurs par état et activité quotidienne,
// calculés sur les courses déjà chargées par le tableau de bord (aucune requête de plus).

const ACCEPTED = ["accepted", "preparing", "pending_assignment", "assigned"];
const IN_PROGRESS = ["picked_up", "in_transit"];
const DELIVERED = ["delivered", "cod_collected", "deposit_pending", "completed"];

const dayKey = (iso?: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

interface Props {
  dispatches: DeliveryDispatch[];
  activeDrivers: number;
}

export function DeliveryStructureOverview({ dispatches, activeDrivers }: Props) {
  const [days, setDays] = useState<7 | 14 | 30>(7);

  const counts = useMemo(() => ({
    total: dispatches.length,
    fresh: dispatches.filter((d) => d.status === "transmitted").length,
    accepted: dispatches.filter((d) => ACCEPTED.includes(d.status)).length,
    inProgress: dispatches.filter((d) => IN_PROGRESS.includes(d.status)).length,
    delivered: dispatches.filter((d) => DELIVERED.includes(d.status)).length,
    failed: dispatches.filter((d) => d.status === "failed").length,
    returned: dispatches.filter((d) => d.status === "returned").length,
  }), [dispatches]);

  // Activité par jour : reçues (transmission), livrées, échouées, retournées, à la date de l'événement.
  const rows = useMemo(() => {
    const list: { key: string; label: string; received: number; delivered: number; failed: number; returned: number }[] = [];
    const today = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      list.push({
        key: dayKey(d.toISOString())!,
        label: d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" }),
        received: 0, delivered: 0, failed: 0, returned: 0,
      });
    }
    const byKey = new Map(list.map((r) => [r.key, r]));
    for (const d of dispatches) {
      const rec = byKey.get(dayKey(d.transmitted_at ?? d.created_at) ?? ""); if (rec) rec.received += 1;
      const del = byKey.get(dayKey(d.delivered_at) ?? ""); if (del) del.delivered += 1;
      const fail = byKey.get(dayKey(d.failed_at) ?? ""); if (fail) fail.failed += 1;
      const ret = byKey.get(dayKey(d.returned_at) ?? ""); if (ret) ret.returned += 1;
    }
    return list;
  }, [dispatches, days]);

  const totals = rows.reduce((a, r) => ({
    received: a.received + r.received, delivered: a.delivered + r.delivered, failed: a.failed + r.failed, returned: a.returned + r.returned,
  }), { received: 0, delivered: 0, failed: 0, returned: 0 });
  const max = Math.max(1, ...rows.map((r) => Math.max(r.received, r.delivered, r.failed, r.returned)));

  const cards: { label: string; value: number; tone: string }[] = [
    { label: "Commandes reçues", value: counts.total, tone: "text-white" },
    { label: "Nouvelles en attente", value: counts.fresh, tone: "text-rose-400" },
    { label: "Acceptées", value: counts.accepted, tone: "text-amber-400" },
    { label: "En cours de livraison", value: counts.inProgress, tone: "text-blue-400" },
    { label: "Livrées", value: counts.delivered, tone: "text-emerald-400" },
    { label: "Échouées", value: counts.failed, tone: "text-red-400" },
    { label: "Retournées", value: counts.returned, tone: "text-orange-400" },
    { label: "Livreurs actifs", value: activeDrivers, tone: "text-sky-400" },
  ];

  return (
    <section className="space-y-3" aria-label="Vue d'ensemble de la structure">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className="bg-slate-900 border-slate-800 p-4 space-y-1">
            <span className="text-xs text-slate-400">{c.label}</span>
            <div className={`text-2xl font-bold ${c.tone}`}>{c.value}</div>
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
          Sur {days} jours : {totals.received} reçue{totals.received > 1 ? "s" : ""}, {totals.delivered} livrée{totals.delivered > 1 ? "s" : ""},{" "}
          {totals.failed} échouée{totals.failed > 1 ? "s" : ""}, {totals.returned} retournée{totals.returned > 1 ? "s" : ""}.
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
                <tr key={r.key} className="border-t border-slate-800 text-slate-200">
                  <td className="py-1 pr-3 capitalize">{r.label}</td>
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
