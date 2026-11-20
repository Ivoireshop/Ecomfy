import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CalendarClock, CheckCircle2, ClipboardCheck, Loader2, MapPin, RefreshCw, ShieldAlert, UserPlus, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { deliveryService } from "@/lib/deliveryService";
import {
  FIELD_STATUS_LABELS,
  VISIT_CHECKS,
  VISIT_OUTCOME_LABELS,
  VISIT_STATUS_LABELS,
  type DeliveryFieldAgent,
  type DeliveryFieldVisitAdmin,
  type DeliveryPendingVerification,
} from "@/types/delivery";

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const fmtDay = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—");

const FILTERS: Array<{ id: string; label: string }> = [
  { id: "all", label: "Toutes" },
  { id: "scheduled", label: "Programmées" },
  { id: "in_progress", label: "En cours" },
  { id: "completed", label: "Terminées" },
  { id: "cancelled", label: "Annulées" },
];

const field = "bg-slate-950 border-slate-800 text-white placeholder:text-slate-500";
const secondaryBtn = "bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700 text-xs";

/** Visites de vérification physique des structures (cahier des charges §5) : agents, programmation, rapports. */
export default function DeliveryFieldVisitsPage() {
  const { toast } = useToast();
  const [agents, setAgents] = useState<DeliveryFieldAgent[]>([]);
  const [pending, setPending] = useState<DeliveryPendingVerification[]>([]);
  const [visits, setVisits] = useState<DeliveryFieldVisitAdmin[]>([]);
  const [requireVisit, setRequireVisit] = useState(false);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [agentForm, setAgentForm] = useState({ email: "", fullName: "", phone: "" });
  const [planFor, setPlanFor] = useState<string | null>(null);
  const [plan, setPlan] = useState({ agentId: "", when: "", instructions: "" });
  const [openReport, setOpenReport] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [cancelFor, setCancelFor] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, p, v, r] = await Promise.all([
        deliveryService.getFieldAgents(),
        deliveryService.getPendingVerifications(),
        deliveryService.getFieldVisits(filter === "all" ? undefined : filter),
        deliveryService.getRequireVisit(),
      ]);
      setAgents(a);
      setPending(p);
      setVisits(v);
      setRequireVisit(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, [filter]);
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, action: () => Promise<void>, success: string) => {
    setBusy(key);
    try {
      await action();
      toast({ title: success });
      await load();
      return true;
    } catch (e) {
      toast({ variant: "destructive", title: "Action impossible", description: e instanceof Error ? e.message : "Erreur inconnue." });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const toggleReport = async (v: DeliveryFieldVisitAdmin) => {
    if (openReport === v.id) return setOpenReport(null);
    setOpenReport(v.id);
    if (v.photos.length > 0) {
      try {
        const urls = await deliveryService.getVisitPhotoUrls(v.photos);
        setPhotoUrls((prev) => ({ ...prev, ...urls }));
      } catch (e) {
        toast({ variant: "destructive", title: "Photos indisponibles", description: e instanceof Error ? e.message : undefined });
      }
    }
  };

  const activeAgents = agents.filter((a) => a.is_active);
  const minWhen = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <Link to="/delivery-admin" className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline">
              <ArrowLeft className="w-3.5 h-3.5" /> Back-office Livraison
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-2 flex items-center gap-2">
              <ClipboardCheck className="w-7 h-7 text-emerald-400" /> Visites terrain
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Vérification physique des locaux : désignez des agents, programmez les visites, lisez les rapports. La décision d'approuver se prend dans le dossier.
            </p>
          </div>
          <Button type="button" onClick={() => void load()} disabled={loading} className={secondaryBtn}>
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </Button>
        </div>

        {error && (
          <div role="alert" className="p-3 rounded-xl bg-red-950/40 border border-red-900 text-xs text-red-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* Règle d'approbation */}
        <Card className="bg-slate-900 border-slate-800 p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={requireVisit}
              disabled={busy === "setting"}
              onChange={(e) =>
                void run("setting", () => deliveryService.setRequireVisit(e.target.checked), e.target.checked ? "Visite terrain exigée avant approbation" : "Visite terrain non exigée")
              }
              className="mt-1 accent-emerald-500"
            />
            <span>
              <span className="text-sm font-semibold text-white block">Exiger une visite concluante avant d'approuver une structure</span>
              <span className="text-xs text-slate-400 block mt-0.5">
                {requireVisit
                  ? "Activé : une structure ne peut être approuvée que si une visite concluante a eu lieu depuis sa dernière demande de vérification. Un changement d'adresse impose une nouvelle visite."
                  : "Désactivé : l'administration peut approuver sur dossier. Les livreurs indépendants ne sont jamais concernés."}
              </span>
            </span>
          </label>
        </Card>

        {/* Agents */}
        <Card className="bg-slate-900 border-slate-800 p-4 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-400" /> Agents terrain
          </h2>
          <form
            className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run("agent", () => deliveryService.setFieldAgent(agentForm), "Agent enregistré");
              if (ok) setAgentForm({ email: "", fullName: "", phone: "" });
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="ag-email" className="text-xs text-slate-300">E-mail du compte eComfy</Label>
              <Input id="ag-email" type="email" required value={agentForm.email} onChange={(e) => setAgentForm({ ...agentForm, email: e.target.value })} className={field} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ag-name" className="text-xs text-slate-300">Nom complet</Label>
              <Input id="ag-name" required minLength={2} value={agentForm.fullName} onChange={(e) => setAgentForm({ ...agentForm, fullName: e.target.value })} className={field} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ag-phone" className="text-xs text-slate-300">Téléphone</Label>
              <Input id="ag-phone" inputMode="tel" value={agentForm.phone} onChange={(e) => setAgentForm({ ...agentForm, phone: e.target.value })} className={field} />
            </div>
            <Button type="submit" disabled={busy === "agent"} className="bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400">
              {busy === "agent" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Désigner l'agent"}
            </Button>
          </form>
          {agents.length === 0 ? (
            <p className="text-xs text-slate-500">Aucun agent. La personne doit d'abord avoir un compte eComfy ; saisissez son e-mail pour la désigner.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {agents.map((a) => (
                <li key={a.user_id} className="py-2.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-white">{a.full_name}</span>{" "}
                    {!a.is_active && <Badge className="bg-slate-700 text-slate-300 border-slate-600 text-[10px] py-0">Désactivé</Badge>}
                    <div className="text-[11px] text-slate-400">
                      {a.email}{a.phone ? ` · ${a.phone}` : ""} · {a.open_visits} mission(s) ouverte(s) · {a.completed_visits} terminée(s)
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy === `ag-${a.user_id}`}
                    onClick={() =>
                      void run(`ag-${a.user_id}`, () => deliveryService.setFieldAgent({ email: a.email ?? "", fullName: a.full_name, phone: a.phone ?? "", active: !a.is_active }),
                        a.is_active ? "Agent désactivé (ses missions non commencées sont annulées)" : "Agent réactivé")
                    }
                    className={secondaryBtn}
                  >
                    {a.is_active ? "Désactiver" : "Réactiver"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Dossiers à visiter */}
        <Card className="bg-slate-900 border-slate-800 p-4 space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-400" /> Dossiers à visiter <span className="text-xs font-normal text-slate-400">({pending.length})</span>
          </h2>
          {pending.length === 0 && <p className="text-xs text-slate-500">Aucun dossier en attente sans visite ouverte.</p>}
          <ul className="space-y-2">
            {pending.map((p) => (
              <li key={p.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-white">{p.company_name}</span>{" "}
                    <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[10px] py-0">{FIELD_STATUS_LABELS[p.field_status]}</Badge>
                    {p.profile_type === "driver" && <Badge className="ml-1 bg-slate-700/60 text-slate-200 border-slate-600 text-[10px] py-0">Indépendant</Badge>}
                    <div className="text-[11px] text-slate-400">
                      {p.address}, {p.city}
                      {p.last_visit_outcome ? ` · dernière visite : ${VISIT_OUTCOME_LABELS[p.last_visit_outcome].toLowerCase()}` : ""}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={activeAgents.length === 0}
                    onClick={() => {
                      setPlanFor(planFor === p.id ? null : p.id);
                      setPlan({ agentId: activeAgents[0]?.user_id ?? "", when: "", instructions: "" });
                    }}
                    className="bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 text-xs disabled:opacity-50"
                  >
                    <CalendarClock className="w-3.5 h-3.5 mr-1.5" /> Programmer une visite
                  </Button>
                </div>
                {planFor === p.id && (
                  <form
                    className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const ok = await run(
                        "plan",
                        () => deliveryService.scheduleVisit({ companyId: p.id, agentId: plan.agentId, scheduledFor: new Date(plan.when).toISOString(), instructions: plan.instructions }),
                        "Visite programmée : l'agent et la structure sont notifiés",
                      );
                      if (ok) setPlanFor(null);
                    }}
                  >
                    <div className="space-y-1">
                      <Label htmlFor={`pl-agent-${p.id}`} className="text-xs text-slate-300">Agent</Label>
                      <select id={`pl-agent-${p.id}`} value={plan.agentId} onChange={(e) => setPlan({ ...plan, agentId: e.target.value })}
                        className="w-full h-10 rounded-md px-3 text-sm bg-slate-950 border border-slate-800 text-white">
                        {activeAgents.map((a) => <option key={a.user_id} value={a.user_id}>{a.full_name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`pl-when-${p.id}`} className="text-xs text-slate-300">Date et heure</Label>
                      <Input id={`pl-when-${p.id}`} type="datetime-local" required min={minWhen} value={plan.when} onChange={(e) => setPlan({ ...plan, when: e.target.value })} className={field} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor={`pl-ins-${p.id}`} className="text-xs text-slate-300">Consignes pour l'agent (facultatif)</Label>
                      <Textarea id={`pl-ins-${p.id}`} rows={2} maxLength={1000} value={plan.instructions} onChange={(e) => setPlan({ ...plan, instructions: e.target.value })} className={field} placeholder="Point de repère, personne à contacter…" />
                    </div>
                    <div className="sm:col-span-2 flex justify-end gap-2">
                      <Button type="button" onClick={() => setPlanFor(null)} className={secondaryBtn}>Annuler</Button>
                      <Button type="submit" disabled={busy === "plan" || !plan.agentId || !plan.when} className="bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 text-xs">
                        {busy === "plan" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Programmer"}
                      </Button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
          {activeAgents.length === 0 && pending.length > 0 && <p className="text-[11px] text-amber-300">Désignez d'abord un agent terrain pour programmer une visite.</p>}
        </Card>

        {/* Visites */}
        <Card className="bg-slate-900 border-slate-800 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-white">Visites</h2>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer les visites">
              {FILTERS.map((f) => (
                <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
                  className={`px-3 py-1.5 rounded-full text-xs border ${filter === f.id ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 font-semibold" : "bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500"}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          {!loading && visits.length === 0 && <p className="text-xs text-slate-500">Aucune visite pour ce filtre.</p>}
          <ul className="space-y-2">
            {visits.map((v) => (
              <li key={v.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-white">{v.company_name}</span>{" "}
                    <Badge className={`text-[10px] py-0 ${v.status === "completed" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : v.status === "cancelled" ? "bg-slate-700 text-slate-300 border-slate-600" : "bg-sky-500/15 text-sky-300 border-sky-500/30"}`}>
                      {VISIT_STATUS_LABELS[v.status]}
                    </Badge>
                    {v.outcome && (
                      <Badge className={`ml-1 text-[10px] py-0 ${v.outcome === "passed" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : v.outcome === "failed" ? "bg-red-500/15 text-red-300 border-red-500/30" : "bg-amber-500/15 text-amber-300 border-amber-500/30"}`}>
                        {VISIT_OUTCOME_LABELS[v.outcome]}
                      </Badge>
                    )}
                    <div className="text-[11px] text-slate-400">
                      {v.company_address}, {v.company_city} · Agent : {v.agent_name} · Prévue le {fmt(v.scheduled_for)}
                      {v.visited_on ? ` · Visite du ${fmtDay(v.visited_on)}` : ""}
                    </div>
                    <div className="text-[11px] text-slate-500">Statut de vérification : {FIELD_STATUS_LABELS[v.field_status]}</div>
                  </div>
                  <div className="flex gap-2">
                    {v.status === "completed" && (
                      <Button type="button" size="sm" onClick={() => void toggleReport(v)} className={secondaryBtn}>
                        {openReport === v.id ? "Masquer le rapport" : "Lire le rapport"}
                      </Button>
                    )}
                    {(v.status === "scheduled" || v.status === "in_progress") && (
                      <Button type="button" size="sm" onClick={() => { setCancelFor(cancelFor === v.id ? null : v.id); setCancelReason(""); }} className={secondaryBtn}>
                        Annuler la visite
                      </Button>
                    )}
                  </div>
                </div>

                {v.instructions && v.status !== "completed" && <p className="text-[11px] text-slate-400">Consignes : {v.instructions}</p>}
                {v.status === "cancelled" && v.cancelled_reason && <p className="text-[11px] text-slate-400">Motif d'annulation : {v.cancelled_reason}</p>}

                {cancelFor === v.id && (
                  <form className="flex flex-col sm:flex-row gap-2" onSubmit={async (e) => { e.preventDefault(); const ok = await run("cancel", () => deliveryService.cancelVisit(v.id, cancelReason), "Visite annulée : l'agent et la structure sont prévenus"); if (ok) setCancelFor(null); }}>
                    <Input aria-label="Motif de l'annulation" required minLength={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Motif de l'annulation" className={field} />
                    <Button type="submit" disabled={busy === "cancel"} className="bg-red-600 text-white hover:bg-red-500 text-xs">Confirmer l'annulation</Button>
                  </form>
                )}

                {openReport === v.id && v.status === "completed" && (
                  <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 space-y-3 text-xs">
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {VISIT_CHECKS.map((c) => {
                        const val = v.checks[c.key];
                        return (
                          <li key={c.key} className="flex items-center gap-2 text-slate-300">
                            {val === true ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-label="Oui" /> : val === false ? <XCircle className="w-4 h-4 text-red-400 shrink-0" aria-label="Non" /> : <span className="w-4 h-4 shrink-0 text-slate-600 text-center" aria-label="Non renseigné">–</span>}
                            {c.label}
                          </li>
                        );
                      })}
                    </ul>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Observations de l'agent</div>
                      <p className="whitespace-pre-line text-slate-200">{v.observations || "—"}</p>
                    </div>
                    {v.photos.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {v.photos.map((path) =>
                          photoUrls[path] ? (
                            <a key={path} href={photoUrls[path]} target="_blank" rel="noopener noreferrer">
                              <img src={photoUrls[path]} alt="Photo de la visite" loading="lazy" className="w-full h-24 object-cover rounded-lg border border-slate-700" />
                            </a>
                          ) : (
                            <div key={path} className="h-24 rounded-lg border border-slate-800 bg-slate-950 flex items-center justify-center text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /></div>
                          ),
                        )}
                      </div>
                    )}
                    <div className="flex justify-end">
                      <Button asChild size="sm" className="bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 text-xs">
                        <Link to="/delivery-admin">Décider dans le dossier</Link>
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
