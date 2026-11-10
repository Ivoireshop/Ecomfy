import { AlertTriangle, CheckCircle2, Circle, Clock, MapPin, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { allDossierGaps, idNeedsBackSide, statusSteps, type StatusStep } from "@/lib/deliveryDossier";
import type { DeliveryCompany } from "@/types/delivery";

const formatDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

function StepIcon({ state }: { state: StatusStep["state"] }) {
  if (state === "done") return <CheckCircle2 className="w-5 h-5 text-emerald-400" aria-hidden />;
  if (state === "current") return <Clock className="w-5 h-5 text-amber-400 animate-pulse" aria-hidden />;
  if (state === "blocked") return <XCircle className="w-5 h-5 text-rose-400" aria-hidden />;
  return <Circle className="w-5 h-5 text-slate-600" aria-hidden />;
}

/**
 * Avancement de la demande (reçu, examen, décision) et pièces du dossier, avec ce qui manque encore.
 * Affiché sur la page de statut pour que le candidat sache toujours où en est son dossier.
 */
export function DeliveryApplicationProgress({ company }: { company: DeliveryCompany }) {
  const steps = statusSteps(company.verification_status);
  const gaps = allDossierGaps(company);
  const isManager = company.profile_type === "manager";
  const needsBack = idNeedsBackSide(company.kyc?.id_type);
  const approved = company.verification_status === "approved";
  const canComplete = !approved && company.verification_status !== "suspended";

  const rows: Array<{ ok: boolean; label: string }> = [
    { ok: !!company.manager_id_photo_url, label: needsBack ? "Pièce d'identité — recto" : "Passeport — page photo" },
    ...(needsBack ? [{ ok: !!company.manager_id_back_photo_url, label: "Pièce d'identité — verso" }] : []),
    { ok: !!company.manager_selfie_with_id_url, label: "Selfie avec la pièce d'identité" },
    ...(isManager
      ? [
          { ok: !!company.warehouse_photo_url, label: "Photo de l'entrepôt" },
          { ok: !!company.location, label: "Localisation de l'entrepôt" },
        ]
      : []),
  ];

  return (
    <Card className="bg-slate-900/90 border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold text-white">Avancement de votre demande</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <ol className="grid grid-cols-3 gap-2 text-center" aria-label="Étapes de la demande">
          {steps.map((s) => (
            <li key={s.key} aria-current={s.state === "current" ? "step" : undefined}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 ${
                s.state === "done" ? "bg-emerald-950/30 border-emerald-500/30"
                : s.state === "current" ? "bg-amber-950/30 border-amber-500/40"
                : s.state === "blocked" ? "bg-rose-950/30 border-rose-500/40"
                : "bg-slate-950 border-slate-800"
              }`}>
              <StepIcon state={s.state} />
              <span className="text-[11px] font-semibold text-slate-200 leading-tight">{s.label}</span>
            </li>
          ))}
        </ol>

        <p className="text-[11px] text-slate-400">
          Dossier déposé le {formatDateTime(company.created_at)}
          {company.verification_requested_at && company.verification_requested_at !== company.created_at
            ? ` · dernier envoi à l'équipe le ${formatDateTime(company.verification_requested_at)}`
            : ""}
          {company.verified_at ? ` · approuvé le ${formatDateTime(company.verified_at)}` : ""}
        </p>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-200 flex items-center gap-1.5">
                {r.label.startsWith("Localisation") && <MapPin className="w-3.5 h-3.5 text-slate-500" aria-hidden />}
                {r.label}
              </span>
              {r.ok
                ? <span className="flex items-center gap-1 text-emerald-300"><CheckCircle2 className="w-4 h-4" aria-hidden /> Fourni</span>
                : <span className="flex items-center gap-1 text-rose-300"><XCircle className="w-4 h-4" aria-hidden /> Manquant</span>}
            </li>
          ))}
        </ul>

        {gaps.length > 0 && !approved && (
          <div role="status" className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs space-y-1.5">
            <p className="font-bold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Votre dossier est incomplet. À ajouter :</p>
            {gaps.map((g) => <p key={g.label}>• {g.label}</p>)}
            {canComplete && (
              <p className="pt-1">
                <Link to="/delivery/resubmit" className="font-semibold underline hover:text-amber-100">Compléter mon dossier</Link>
                {isManager && company.drivers?.length ? " (les pièces d'un livreur se corrigent dans la liste « Livreurs » ci-dessous)." : "."}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
