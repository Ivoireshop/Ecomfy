import { useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, ClipboardCheck, Loader2, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deliveryService } from "@/lib/deliveryService";
import { FIELD_STATUS_LABELS, type DeliveryFieldStatus, type DeliveryVisitSummary } from "@/types/delivery";

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("fr-FR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" }) : "—";

const EXPLAIN: Record<DeliveryFieldStatus, string> = {
  not_verified: "Votre structure n'est pas encore vérifiée.",
  requested: "Votre demande est reçue. L'équipe eComfy programmera une visite de vos locaux.",
  info_requested: "L'équipe eComfy attend des informations de votre part : voyez le message sur votre dossier.",
  visit_scheduled: "Un agent eComfy se rendra à votre adresse. Soyez disponible, avec la personne responsable.",
  in_progress: "La vérification est en cours. L'équipe eComfy examine le rapport de visite.",
  verified: "Votre structure est vérifiée : le badge « Vérifiée par eComfy » apparaît sur votre fiche.",
  rejected: "La vérification a été refusée. Consultez le motif sur votre dossier.",
  suspended: "La vérification est suspendue. Contactez l'équipe eComfy.",
};

/** Statut de vérification physique (cahier §5.3) et prochaine visite, côté candidat. Le rapport de l'agent reste interne. */
export function DeliveryVisitCard({ companyId }: { companyId: string }) {
  const [summary, setSummary] = useState<DeliveryVisitSummary | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void deliveryService.getVisitSummary(companyId).then((s) => {
      if (!cancelled) setSummary(s);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  if (summary === undefined) {
    return (
      <Card className="bg-slate-900/90 border-slate-800 p-4 text-xs text-slate-400 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Statut de vérification…
      </Card>
    );
  }
  if (!summary) return null;

  const status = summary.field_status;
  const tone =
    status === "verified" ? "text-emerald-300"
    : status === "rejected" || status === "suspended" ? "text-rose-300"
    : "text-amber-300";
  const Icon = status === "verified" ? CheckCircle2 : status === "rejected" || status === "suspended" ? ShieldAlert : status === "visit_scheduled" ? CalendarClock : ClipboardCheck;
  const v = summary.visit;

  return (
    <Card className="bg-slate-900/90 border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold text-white">Vérification sur le terrain</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className={`flex items-center gap-2 font-semibold ${tone}`}>
          <Icon className="w-5 h-5" aria-hidden /> {FIELD_STATUS_LABELS[status]}
        </div>
        <p className="text-xs text-slate-300">{EXPLAIN[status]}</p>
        {v && (v.status === "scheduled" || v.status === "in_progress") && (
          <p className="text-xs text-slate-200 bg-slate-950 border border-slate-800 rounded-lg p-2.5">
            Visite prévue le <strong>{fmt(v.scheduled_for)}</strong>.
          </p>
        )}
        {v && v.status === "completed" && v.visited_on && (
          <p className="text-xs text-slate-400">Dernière visite effectuée le {new Date(v.visited_on).toLocaleDateString("fr-FR")}.</p>
        )}
        <p className="text-[11px] text-slate-500">
          Un compte créé, un paiement ou un abonnement ne remplacent jamais la vérification physique des locaux.
        </p>
      </CardContent>
    </Card>
  );
}
