import { useEffect, useState } from "react";
import { History, Lock } from "lucide-react";
import { deliveryService } from "@/lib/deliveryService";
import { REJECTION_REASON_LABELS, type DeliveryAuditEntry } from "@/types/delivery";

const ACTION_LABELS: Record<string, string> = {
  submitted: "Dossier soumis",
  resubmitted: "Dossier resoumis",
  reverification_required: "Nouvelle vérification requise (pièces modifiées)",
  status_changed: "Décision sur le dossier",
  documents_updated: "Documents mis à jour",
  identity_recorded: "Identité du responsable enregistrée",
  identity_updated: "Identité du responsable modifiée",
  note_added: "Note interne",
  driver_added: "Livreur ajouté",
  driver_status_changed: "Décision sur un livreur",
  driver_documents_updated: "Pièces ou permis d'un livreur modifiés",
  driver_activated: "Livreur activé",
  driver_deactivated: "Livreur désactivé",
};

const STATUS_LABELS: Record<string, string> = {
  pending_verification: "en attente",
  under_review: "en examen",
  action_required: "complément demandé",
  approved: "approuvé",
  rejected: "refusé",
  suspended: "suspendu",
  pending: "en attente",
};

const ACTOR_LABELS: Record<string, string> = { owner: "Candidat", admin: "Équipe Ecomfy", system: "Système" };

const FIELD_LABELS: Record<string, string> = {
  manager_id_photo_url: "pièce d'identité",
  manager_selfie_with_id_url: "selfie",
  manager_photo_url: "photo",
  owner_photo_url: "photo",
  tax_document_url: "document fiscal",
  trade_register_document_url: "extrait RCCM",
  tax_id_number: "NIF",
  trade_register_number: "RCCM",
  company_name: "nom de la structure",
  manager_name: "nom du responsable",
  national_id_photo_url: "pièce d'identité",
  license_photo_url: "photo du permis",
  license_categories: "catégories du permis",
  license_expiry: "expiration du permis",
  license_number: "numéro du permis",
  vehicle_type: "véhicule",
  id_expiry: "expiration de la pièce",
  id_number: "numéro de pièce",
  date_of_birth: "date de naissance",
  selfie_with_id_url: "selfie",
  photo_url: "photo",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function describe(e: DeliveryAuditEntry): string {
  const parts: string[] = [];
  const driver = typeof e.details?.driver === "string" ? e.details.driver : null;
  if (driver) parts.push(driver);
  if (e.from_status || e.to_status) {
    const from = e.from_status ? STATUS_LABELS[e.from_status] ?? e.from_status : null;
    const to = e.to_status ? STATUS_LABELS[e.to_status] ?? e.to_status : null;
    if (to && from !== to) parts.push(from ? `${from} → ${to}` : to);
  }
  const changed = Array.isArray(e.details?.changed) ? (e.details.changed as string[]) : [];
  if (changed.length) parts.push(`modifié : ${Array.from(new Set(changed.map((c) => FIELD_LABELS[c] ?? c))).join(", ")}`);
  return parts.join(" · ");
}

/**
 * Historique des décisions et modifications d'un dossier (table delivery_verification_audit, écrite par la base).
 * Le candidat ne reçoit que les lignes qui le concernent ; les notes internes n'apparaissent que pour un administrateur.
 */
export function DeliveryAuditTimeline({ companyId, refreshKey = 0, className = "" }: { companyId: string; refreshKey?: number; className?: string }) {
  const [entries, setEntries] = useState<DeliveryAuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setEntries(null);
    setError(null);
    deliveryService
      .getAuditLog(companyId)
      .then((list) => active && setEntries(list))
      .catch((e) => active && setError(e instanceof Error ? e.message : "Historique indisponible."));
    return () => {
      active = false;
    };
  }, [companyId, refreshKey]);

  return (
    <div className={`p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 ${className}`}>
      <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2"><History className="w-4 h-4" /> Historique du dossier</h3>
      {error ? (
        <p className="text-xs text-rose-300">{error}</p>
      ) : entries === null ? (
        <p className="text-xs text-slate-500">Chargement…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-slate-500">Aucun événement enregistré.</p>
      ) : (
        <ol className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {entries.map((e) => (
            <li key={e.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              <div className="flex items-start justify-between gap-3">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  {e.visibility === "internal" && <Lock className="w-3 h-3 text-amber-400" aria-label="Interne" />}
                  {ACTION_LABELS[e.action] ?? e.action}
                </span>
                <time className="text-[10px] font-mono text-slate-500 shrink-0" dateTime={e.created_at}>{when(e.created_at)}</time>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">{ACTOR_LABELS[e.actor_kind] ?? e.actor_kind}</p>
              {describe(e) && <p className="text-[11px] text-slate-300 mt-1">{describe(e)}</p>}
              {e.reason_code && <p className="text-[11px] text-rose-300 mt-1">{REJECTION_REASON_LABELS[e.reason_code] ?? e.reason_code}</p>}
              {e.reason && <p className="text-[11px] text-slate-300 mt-0.5">{e.reason}</p>}
              {e.note && <p className="text-[11px] text-amber-200 mt-1 italic">« {e.note} »</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
