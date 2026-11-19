import { useEffect, useState } from "react";
import { Bike, RefreshCw } from "lucide-react";
import { deliveryService } from "@/lib/deliveryService";
import { DeliveryDriverStats } from "@/types/delivery";

/** Performances individuelles des livreurs (cahier des charges §9) : en cours, livrées, échecs, taux de réussite, délai moyen. */
export function DeliveryDriverStatsPanel({ companyId, refreshKey }: { companyId: string; refreshKey?: string }) {
  const [rows, setRows] = useState<DeliveryDriverStats[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    deliveryService.getDriverStats(companyId).then((r) => { if (!cancelled) setRows(r); });
    return () => { cancelled = true; };
  }, [companyId, refreshKey]);

  if (rows === null) {
    return <div className="flex justify-center py-6"><RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" /></div>;
  }
  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">
        <Bike className="w-5 h-5 text-emerald-400" /> Performances des livreurs
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="text-slate-500">
            <tr>
              <th className="py-2 pr-3 font-medium">Livreur</th>
              <th className="py-2 pr-3 font-medium">En cours</th>
              <th className="py-2 pr-3 font-medium">Livrées</th>
              <th className="py-2 pr-3 font-medium">Échecs</th>
              <th className="py-2 pr-3 font-medium">Réussite</th>
              <th className="py-2 font-medium">Délai moyen</th>
            </tr>
          </thead>
          <tbody className="text-slate-200">
            {rows.map((r) => (
              <tr key={r.driver_id} className="border-t border-slate-800">
                <td className="py-2 pr-3 font-semibold">
                  {r.full_name}
                  {!r.is_active && <span className="ml-2 text-[10px] text-slate-500">inactif</span>}
                </td>
                <td className="py-2 pr-3">{r.in_progress}</td>
                <td className="py-2 pr-3 text-emerald-400">{r.delivered}</td>
                <td className="py-2 pr-3 text-red-400">{r.failed}</td>
                <td className="py-2 pr-3">{r.success_rate === null ? "—" : `${r.success_rate} %`}</td>
                <td className="py-2">{r.avg_delivery_minutes === null ? "—" : `${r.avg_delivery_minutes} min`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
