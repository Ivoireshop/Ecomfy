import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Camera, CheckCircle2, ClipboardList, Loader2, MapPin, Phone, Play, RefreshCw, ShieldAlert, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { deliveryService } from "@/lib/deliveryService";
import {
  VISIT_CHECKS,
  VISIT_OUTCOME_LABELS,
  VISIT_STATUS_LABELS,
  type DeliveryAgentVisit,
  type DeliveryVisitOutcome,
  type VisitCheckKey,
  type VisitChecks,
} from "@/types/delivery";

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const field = "bg-slate-950 border-slate-800 text-white placeholder:text-slate-500";
const secondaryBtn = "bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700 text-xs";

const OUTCOMES: Array<{ id: DeliveryVisitOutcome; label: string; hint: string }> = [
  { id: "passed", label: "Concluante", hint: "Tout est conforme : locaux, adresse, activité." },
  { id: "failed", label: "Non concluante", hint: "Un contrôle échoue : décrivez pourquoi." },
  { id: "info_needed", label: "Informations à compléter", hint: "Il manque des éléments pour décider." },
];

function ReportForm({ visit, onDone }: { visit: DeliveryAgentVisit; onDone: () => Promise<void> }) {
  const { toast } = useToast();
  const [checks, setChecks] = useState<VisitChecks>({});
  const [outcome, setOutcome] = useState<DeliveryVisitOutcome | null>(null);
  const [observations, setObservations] = useState("");
  const [photos, setPhotos] = useState<Array<{ path: string; url: string }>>([]);
  const [visitedOn, setVisitedOn] = useState(today());
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const missing = VISIT_CHECKS.filter((c) => c.required && checks[c.key] !== true).map((c) => c.label);
  const problem =
    !outcome ? "Choisissez le résultat de la visite."
    : outcome === "passed" && missing.length > 0 ? `Pour une visite concluante, confirmez : ${missing.join(" ; ").toLowerCase()}.`
    : outcome === "passed" && photos.length === 0 ? "Ajoutez au moins une photo des locaux."
    : outcome !== "passed" && observations.trim().length < 10 ? "Décrivez vos observations (10 caractères minimum)."
    : null;

  const addPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (photos.length >= 12) break;
        const path = await deliveryService.uploadVisitPhoto(file);
        setPhotos((prev) => [...prev, { path, url: URL.createObjectURL(file) }]);
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Photo refusée", description: e instanceof Error ? e.message : undefined });
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (problem || !outcome) return;
    setSaving(true);
    try {
      const full: VisitChecks = {};
      for (const c of VISIT_CHECKS) full[c.key] = checks[c.key] === true;
      await deliveryService.submitVisit({ visitId: visit.id, outcome, checks: full, observations: observations.trim(), photos: photos.map((p) => p.path), visitedOn });
      toast({ title: "Rapport envoyé", description: "L'administration est notifiée et prendra la décision." });
      await onDone();
    } catch (e) {
      toast({ variant: "destructive", title: "Envoi impossible", description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 border-t border-slate-800 pt-4">
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-slate-200 mb-1">Contrôles réalisés sur place</legend>
        {VISIT_CHECKS.map((c) => (
          <label key={c.key} className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer p-2 rounded-lg bg-slate-950 border border-slate-800">
            <input type="checkbox" checked={checks[c.key as VisitCheckKey] === true}
              onChange={(e) => setChecks({ ...checks, [c.key]: e.target.checked })} className="w-4 h-4 accent-emerald-500" />
            <span>{c.label}{!c.required && <span className="text-[11px] text-slate-500"> (selon besoin)</span>}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-slate-200 mb-1">Résultat de la visite</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {OUTCOMES.map((o) => (
            <label key={o.id} className={`p-3 rounded-xl border cursor-pointer text-sm ${outcome === o.id ? "border-emerald-500 bg-emerald-950/40" : "border-slate-800 bg-slate-950 hover:border-slate-600"}`}>
              <input type="radio" name={`outcome-${visit.id}`} className="sr-only" checked={outcome === o.id} onChange={() => setOutcome(o.id)} />
              <span className="font-semibold text-white block">{o.label}</span>
              <span className="text-[11px] text-slate-400">{o.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1">
        <Label htmlFor={`obs-${visit.id}`} className="text-xs text-slate-300">Observations{outcome && outcome !== "passed" ? " (obligatoires)" : ""}</Label>
        <Textarea id={`obs-${visit.id}`} rows={4} maxLength={4000} value={observations} onChange={(e) => setObservations(e.target.value)} className={field}
          placeholder="Ce que vous avez constaté : locaux, équipements, personnes rencontrées, écarts avec le dossier…" />
      </div>

      <div className="space-y-2">
        <div className="text-xs text-slate-300">Photos des locaux ({photos.length}/12)</div>
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <div key={p.path} className="relative">
              <img src={p.url} alt="Photo ajoutée" className="w-20 h-20 object-cover rounded-lg border border-slate-700" />
              <button type="button" aria-label="Retirer la photo" onClick={() => setPhotos((prev) => prev.filter((x) => x.path !== p.path))}
                className="absolute -top-1.5 -right-1.5 bg-slate-900 border border-slate-600 rounded-full p-0.5 text-slate-300"><X className="w-3 h-3" /></button>
            </div>
          ))}
          {photos.length < 12 && (
            <label htmlFor={`ph-${visit.id}`} className="w-20 h-20 rounded-lg border border-dashed border-slate-600 bg-slate-950 flex flex-col items-center justify-center text-[10px] text-slate-300 cursor-pointer hover:border-emerald-500">
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5 mb-0.5" />}
              Ajouter
            </label>
          )}
        </div>
        <input id={`ph-${visit.id}`} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple className="sr-only" disabled={uploading}
          onChange={(e) => { void addPhotos(e.target.files); e.target.value = ""; }} />
      </div>

      <div className="space-y-1 max-w-xs">
        <Label htmlFor={`day-${visit.id}`} className="text-xs text-slate-300">Date de la visite</Label>
        <Input id={`day-${visit.id}`} type="date" max={today()} value={visitedOn} onChange={(e) => setVisitedOn(e.target.value)} className={field} />
      </div>

      {problem && <p role="status" className="text-xs text-amber-300">{problem}</p>}
      <div className="flex justify-end">
        <Button type="button" disabled={!!problem || saving || uploading} onClick={() => void submit()} className="bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Envoyer le rapport
        </Button>
      </div>
    </div>
  );
}

/** Missions de vérification physique de l'agent terrain (cahier des charges §5.1). */
export default function DeliveryAgentPage() {
  const { toast } = useToast();
  const [visits, setVisits] = useState<DeliveryAgentVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setVisits(await deliveryService.getAgentVisits());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const start = async (id: string) => {
    setStarting(id);
    try {
      await deliveryService.startVisit(id);
      await load();
    } catch (e) {
      toast({ variant: "destructive", title: "Démarrage impossible", description: e instanceof Error ? e.message : undefined });
    } finally {
      setStarting(null);
    }
  };

  const open = visits.filter((v) => v.status === "scheduled" || v.status === "in_progress");
  const done = visits.filter((v) => v.status === "completed" || v.status === "cancelled");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-5">
          <div>
            <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline">
              <ArrowLeft className="w-3.5 h-3.5" /> Accueil
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-2 flex items-center gap-2">
              <ClipboardList className="w-7 h-7 text-emerald-400" /> Missions terrain
            </h1>
            <p className="text-xs text-slate-400 mt-1">Rendez-vous sur place, contrôlez, photographiez, puis envoyez votre rapport à l'administration eComfy.</p>
          </div>
          <Button type="button" onClick={() => void load()} disabled={loading} className={secondaryBtn}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} aria-label="Actualiser" />
          </Button>
        </div>

        {error && (
          <div role="alert" className="p-3 rounded-xl bg-red-950/40 border border-red-900 text-xs text-red-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        {!loading && !error && open.length === 0 && (
          <Card className="bg-slate-900 border-slate-800 p-6 text-center text-sm text-slate-400">Aucune mission en cours. Vous serez notifié dès qu'une visite vous est confiée.</Card>
        )}

        {open.map((v) => (
          <Card key={v.id} className="bg-slate-900 border-slate-800 p-4 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-white">{v.company.name}</h2>
                <p className="text-xs text-slate-400">{v.company.profile_type === "driver" ? "Livreur indépendant" : "Structure de livraison"} · {fmt(v.scheduled_for)}</p>
              </div>
              <Badge className={`text-[10px] ${v.status === "in_progress" ? "bg-amber-500/15 text-amber-300 border-amber-500/30" : "bg-sky-500/15 text-sky-300 border-sky-500/30"}`}>
                {VISIT_STATUS_LABELS[v.status]}
              </Badge>
            </div>
            <ul className="text-sm text-slate-300 space-y-1.5">
              <li className="flex items-start gap-2"><MapPin className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" /> {v.company.address}, {v.company.city}</li>
              <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-500 shrink-0" />
                {v.company.manager_name} · <a className="text-emerald-400 hover:underline" href={`tel:${v.company.manager_phone.replace(/[^\d+]/g, "")}`}>{v.company.manager_phone}</a>
              </li>
              {v.company.covered_cities.length > 0 && <li className="text-xs text-slate-400">Zones annoncées : {v.company.covered_cities.join(", ")}</li>}
              {v.company.description && <li className="text-xs text-slate-400 whitespace-pre-line">« {v.company.description} »</li>}
              {v.instructions && <li className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">Consignes : {v.instructions}</li>}
            </ul>
            {v.status === "scheduled" ? (
              <div className="flex justify-end">
                <Button type="button" disabled={starting === v.id} onClick={() => void start(v.id)} className="bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400">
                  {starting === v.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />} Démarrer la visite
                </Button>
              </div>
            ) : (
              <ReportForm visit={v} onDone={load} />
            )}
          </Card>
        ))}

        {done.length > 0 && (
          <Card className="bg-slate-900 border-slate-800 p-4 space-y-2">
            <h2 className="text-sm font-bold text-white">Terminées ou annulées récemment</h2>
            <ul className="divide-y divide-slate-800 text-sm">
              {done.map((v) => (
                <li key={v.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-slate-200">{v.company.name} <span className="text-[11px] text-slate-500">· {v.company.city}</span></span>
                  <span className="text-xs text-slate-400">
                    {v.status === "completed" && v.outcome ? VISIT_OUTCOME_LABELS[v.outcome] : VISIT_STATUS_LABELS[v.status]}
                    {v.visited_on ? ` · ${new Date(v.visited_on).toLocaleDateString("fr-FR")}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
