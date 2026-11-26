import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Truck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deliveryService } from "@/lib/deliveryService";
import { DeliveryDispatch, DeliveryDispatchHistoryEntry } from "@/types/delivery";

export const DISPATCH_STATUS_LABELS: Record<string, string> = {
  transmitted: "Transmise", accepted: "Acceptée", refused: "Refusée", preparing: "En préparation",
  pending_assignment: "À affecter", assigned: "Confiée à un livreur", picked_up: "Colis récupéré", in_transit: "En livraison",
  delivered: "Livrée", failed: "Échec", returned: "Retournée", cod_collected: "Encaissée",
  deposit_pending: "Reversement en attente", completed: "Terminée", cancelled: "Annulée", disputed: "Litige",
};

const ACTOR_LABELS: Record<string, string> = {
  seller: "Vous", company: "La structure", admin: "Ecomfy", system: "Système", other: "—",
};

// Regroupement du §7.1 du cahier des charges : ce que le commerçant veut voir d'un coup d'œil.
const GROUPS: { id: string; label: string; statuses: string[] }[] = [
  { id: "waiting", label: "En attente", statuses: ["transmitted"] },
  { id: "accepted", label: "Acceptées", statuses: ["accepted", "preparing", "pending_assignment"] },
  { id: "courier", label: "Chez un livreur", statuses: ["assigned", "picked_up", "in_transit"] },
  { id: "delivered", label: "Livrées", statuses: ["delivered", "cod_collected", "deposit_pending", "completed"] },
  { id: "failed", label: "Échouées", statuses: ["failed", "disputed"] },
  { id: "returned", label: "Retournées", statuses: ["returned"] },
  { id: "closed", label: "Refusées / annulées", statuses: ["refused", "cancelled"] },
];

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

function HistoryTimeline({ dispatchId }: { dispatchId: string }) {
  const [rows, setRows] = useState<DeliveryDispatchHistoryEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    deliveryService.getDispatchHistory(dispatchId).then((r) => { if (!cancelled) setRows(r); });
    return () => { cancelled = true; };
  }, [dispatchId]);

  if (rows === null) return <p className="text-xs text-muted-foreground">Chargement de l'historique…</p>;
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">Aucun événement enregistré.</p>;

  return (
    <ol className="space-y-2 border-l border-border pl-4">
      {rows.map((h) => (
        <li key={h.id} className="text-xs">
          <span className="font-semibold">{h.to_status ? (DISPATCH_STATUS_LABELS[h.to_status] ?? h.to_status) : h.event}</span>
          <span className="text-muted-foreground"> · {formatDate(h.created_at)} · {ACTOR_LABELS[h.actor_kind] ?? "—"}</span>
          {(h.reason || h.note) && <p className="text-muted-foreground mt-0.5">{h.reason || h.note}</p>}
        </li>
      ))}
    </ol>
  );
}

/** Suivi, côté commerçant, des commandes transmises aux structures de livraison (cahier des charges §7.1, §7.3, §10). */
export default function DispatchTrackingBoard({ dispatches, loading, onRefresh }: {
  dispatches: DeliveryDispatch[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [group, setGroup] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const g of GROUPS) out[g.id] = dispatches.filter((d) => g.statuses.includes(d.status)).length;
    return out;
  }, [dispatches]);

  const visible = useMemo(() => {
    if (group === "all") return dispatches;
    const g = GROUPS.find((x) => x.id === group);
    return g ? dispatches.filter((d) => g.statuses.includes(d.status)) : dispatches;
  }, [dispatches, group]);

  if (loading) return <Card className="p-12 text-center text-sm text-muted-foreground">Chargement des livraisons…</Card>;

  if (dispatches.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-1">Aucune livraison transmise</h3>
        <p className="text-sm text-muted-foreground">Depuis l'onglet Commandes, utilisez « Transmettre à une structure ».</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Suivi des livraisons transmises ({dispatches.length})</h3>
        </div>
        <Button size="sm" variant="ghost" className="h-8" onClick={onRefresh} aria-label="Actualiser">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={group === "all" ? "default" : "outline"} className="h-8 text-xs" onClick={() => setGroup("all")}>
          Toutes ({dispatches.length})
        </Button>
        {GROUPS.filter((g) => counts[g.id] > 0).map((g) => (
          <Button key={g.id} size="sm" variant={group === g.id ? "default" : "outline"} className="h-8 text-xs" onClick={() => setGroup(g.id)}>
            {g.label} ({counts[g.id]})
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {visible.map((d) => (
          <div key={d.id} className="rounded-lg border p-3 text-sm space-y-2">
            <button type="button" className="w-full flex flex-wrap items-center justify-between gap-2 text-left" onClick={() => setExpanded(expanded === d.id ? null : d.id)}>
              <div className="min-w-0">
                <p className="font-semibold truncate">{d.recipient_name} <span className="text-muted-foreground font-normal">· {d.city}</span></p>
                <p className="text-xs text-muted-foreground">
                  {d.company?.company_name ?? "Structure"}
                  {d.driver?.full_name ? ` · Livreur : ${d.driver.full_name}` : ""} · Transmise le {formatDate(d.transmitted_at ?? d.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">{Number(d.cod_amount).toLocaleString("fr-FR")} {d.currency}</span>
                <Badge variant="secondary" className="text-[11px]">{DISPATCH_STATUS_LABELS[d.status] ?? d.status}</Badge>
              </div>
            </button>
            {(d.refusal_reason || d.failure_reason) && (
              <p className="text-xs text-destructive">{d.refusal_reason || d.failure_reason}</p>
            )}
            {expanded === d.id && <HistoryTimeline dispatchId={d.id} />}
          </div>
        ))}
      </div>
    </Card>
  );
}
