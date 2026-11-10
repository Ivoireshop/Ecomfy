import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, RefreshCw, Save, AlertTriangle, History } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useBillingSettings, useInvalidateBillingConfig, useSubscriptionPlans } from "@/hooks/useSubscriptionPlans";
import {
  DEFAULT_BILLING_SETTINGS, annualMonthlyEquivalent, annualSavingsPercent, formatFcfa,
  type BillingSettings, type SubscriptionPlan,
} from "@/lib/subscriptionPlans";

// Les nouvelles tables et fonctions ne sont pas dans types.ts : client sans schéma.
const db = supabase as unknown as SupabaseClient;

interface AuditRow {
  id: string;
  kind: "plan" | "setting";
  key: string;
  old_value: unknown;
  new_value: unknown;
  changed_at: string;
}

interface PlanSnapshot {
  name?: string;
  price_monthly: number;
  price_annual: number | null;
  max_shops: number;
  is_active: boolean;
  is_public: boolean;
}

interface OverviewRow {
  code: string;
  active_accounts: number;
  accounts_over_limit: number;
  shops_on_commission: number;
}

interface Overview {
  success: boolean;
  total_shops: number;
  shops_on_commission: number;
  plans: OverviewRow[];
}

/* ------------------------------------------------------------------------------------------------------------- */
/* Plans                                                                                                         */
/* ------------------------------------------------------------------------------------------------------------- */

interface PlanDraft {
  code: string;
  name: string;
  badge: string;
  description: string;
  price_monthly: string;
  price_annual: string;
  max_shops: string;
  ai_video_quota: string;
  ai_image_quota: string;
  features: string;
  is_active: boolean;
  is_public: boolean;
  sort_order: string;
}

const toDraft = (p: SubscriptionPlan): PlanDraft => ({
  code: p.code,
  name: p.name,
  badge: p.badge ?? "",
  description: p.description ?? "",
  price_monthly: String(p.price_monthly),
  price_annual: p.price_annual === null ? "" : String(p.price_annual),
  max_shops: p.max_shops === null ? "" : String(p.max_shops),
  ai_video_quota: String(p.ai_video_quota),
  ai_image_quota: String(p.ai_image_quota),
  features: p.features.join("\n"),
  is_active: p.is_active,
  is_public: p.is_public,
  sort_order: String(p.sort_order),
});

const emptyDraft = (sortOrder: number): PlanDraft => ({
  code: "", name: "", badge: "", description: "", price_monthly: "", price_annual: "", max_shops: "1",
  ai_video_quota: "0", ai_image_quota: "0", features: "", is_active: true, is_public: true, sort_order: String(sortOrder),
});

const toPayload = (d: PlanDraft) => ({
  code: d.code.trim().toLowerCase(),
  name: d.name.trim(),
  badge: d.badge.trim() || null,
  description: d.description.trim() || null,
  price_monthly: Number(d.price_monthly),
  price_annual: d.price_annual.trim() === "" ? null : Number(d.price_annual),
  max_shops: d.max_shops.trim() === "" ? 1 : Number(d.max_shops),
  ai_video_quota: Number(d.ai_video_quota || 0),
  ai_image_quota: Number(d.ai_image_quota || 0),
  features: d.features.split("\n").map((l) => l.trim()).filter(Boolean),
  is_active: d.is_active,
  is_public: d.is_public,
  sort_order: Number(d.sort_order || 0),
});

/** Contrôles identiques à ceux de la base (founder_save_subscription_plan), pour un message avant l'appel. */
function validateDraft(d: PlanDraft, isNew: boolean): string | null {
  const p = toPayload(d);
  if (isNew && !/^[a-z][a-z0-9_]{1,40}$/.test(p.code)) return "Code du plan : lettres minuscules, chiffres et _ (2 à 41 caractères), commençant par une lettre.";
  if (!p.name) return "Le nom du plan est obligatoire.";
  if (!Number.isInteger(p.price_monthly) || p.price_monthly < 200) return "Le prix mensuel doit être un entier d'au moins 200 FCFA (minimum du prestataire de paiement).";
  if (p.price_annual !== null && (!Number.isInteger(p.price_annual) || p.price_annual < p.price_monthly * 5)) return "Le prix annuel doit être un entier d'au moins 5 fois le prix mensuel (ou laissé vide).";
  if (!Number.isInteger(p.max_shops) || p.max_shops < 0 || p.max_shops > 100) return "Le nombre de boutiques incluses doit être un entier entre 0 et 100.";
  for (const [label, v] of [["vidéos IA", p.ai_video_quota], ["images IA", p.ai_image_quota]] as const) {
    if (!Number.isInteger(v) || v < 0 || v > 10000) return `Quota ${label} : entier entre 0 et 10 000.`;
  }
  if (p.features.length > 30) return "30 fonctionnalités au plus.";
  if (p.features.some((f) => f.length > 200)) return "Une fonctionnalité dépasse 200 caractères.";
  return null;
}

/** Résumé lisible des changements, montré avant l'enregistrement. */
function describePlanChanges(d: PlanDraft, current: SubscriptionPlan | undefined): string[] {
  const p = toPayload(d);
  if (!current) return [`Création du plan « ${p.name} » : ${formatFcfa(p.price_monthly)} FCFA/mois, ${p.max_shops} boutique(s) incluse(s).`];
  const out: string[] = [];
  if (p.name !== current.name) out.push(`Nom : ${current.name} → ${p.name}`);
  if (p.price_monthly !== current.price_monthly) out.push(`Prix mensuel : ${formatFcfa(current.price_monthly)} → ${formatFcfa(p.price_monthly)} FCFA (prochains paiements seulement)`);
  if (p.price_annual !== current.price_annual) out.push(`Prix annuel : ${current.price_annual === null ? "aucun" : formatFcfa(current.price_annual)} → ${p.price_annual === null ? "aucun" : formatFcfa(p.price_annual)} FCFA`);
  if (current.max_shops !== null && p.max_shops !== current.max_shops) {
    out.push(p.max_shops > current.max_shops
      ? `Boutiques incluses : ${current.max_shops} → ${p.max_shops} (les abonnés actuels sont couverts immédiatement)`
      : `Boutiques incluses : ${current.max_shops} → ${p.max_shops} (appliqué au prochain renouvellement de chaque abonné, rien n'est retiré maintenant)`);
  }
  if (p.ai_video_quota !== current.ai_video_quota) out.push(`Vidéos IA : ${current.ai_video_quota} → ${p.ai_video_quota}`);
  if (p.ai_image_quota !== current.ai_image_quota) out.push(`Images IA : ${current.ai_image_quota} → ${p.ai_image_quota}`);
  if (p.is_active !== current.is_active) out.push(p.is_active ? "Plan réactivé" : "Plan désactivé : plus aucune vente ni renouvellement de ce plan");
  if (p.is_public !== current.is_public) out.push(p.is_public ? "Plan affiché sur la page des tarifs" : "Plan retiré de la page des tarifs");
  if (p.sort_order !== current.sort_order) out.push(`Ordre : ${current.sort_order} → ${p.sort_order}`);
  if (p.badge !== (current.badge ?? null)) out.push("Badge modifié");
  if (p.description !== (current.description ?? null)) out.push("Description modifiée");
  if (JSON.stringify(p.features) !== JSON.stringify(current.features)) out.push("Fonctionnalités modifiées");
  return out;
}

function NumberField({ id, label, value, onChange, hint, placeholder, disabled }: {
  id: string; label: string; value: string; onChange: (v: string) => void; hint?: string; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input id={id} inputMode="numeric" value={value} placeholder={placeholder} disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))} />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PlanEditor({ draft, current, isNew, onChange, onSave, onCancel, saving }: {
  draft: PlanDraft; current?: SubscriptionPlan; isNew: boolean;
  onChange: (d: PlanDraft) => void; onSave: () => void; onCancel?: () => void; saving: boolean;
}) {
  const set = <K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) => onChange({ ...draft, [key]: value });
  const dirty = isNew || describePlanChanges(draft, current).length > 0;
  const monthly = Number(draft.price_monthly) || 0;
  const annual = draft.price_annual.trim() === "" ? null : Number(draft.price_annual);
  const preview = annual ? { price_monthly: monthly, price_annual: annual } : null;

  return (
    <Card className={draft.is_active ? "" : "opacity-80 border-dashed"}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{isNew ? "Nouveau plan" : draft.name || draft.code}</CardTitle>
            <CardDescription className="font-mono text-[11px]">{isNew ? "Le code ne pourra plus être modifié" : draft.code}</CardDescription>
          </div>
          <div className="flex gap-1.5 flex-wrap justify-end">
            {!draft.is_active && <Badge variant="secondary">Désactivé</Badge>}
            {draft.is_active && !draft.is_public && <Badge variant="outline">Non affiché</Badge>}
            {draft.is_active && draft.is_public && <Badge className="bg-emerald-600">En vente</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isNew && (
          <div className="space-y-1.5">
            <Label htmlFor={`code-${draft.code}`} className="text-xs">Code (technique)</Label>
            <Input id={`code-${draft.code}`} value={draft.code} placeholder="ex. business_monthly"
              onChange={(e) => set("code", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} />
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nom affiché</Label>
            <Input value={draft.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Badge (optionnel)</Label>
            <Input value={draft.badge} placeholder="POPULAIRE" onChange={(e) => set("badge", e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Description courte</Label>
          <Input value={draft.description} onChange={(e) => set("description", e.target.value)} />
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <NumberField id={`pm-${draft.code}`} label="Prix mensuel (FCFA)" value={draft.price_monthly} onChange={(v) => set("price_monthly", v)} hint="Minimum 200 FCFA" />
          <NumberField id={`pa-${draft.code}`} label="Prix annuel (FCFA)" value={draft.price_annual} onChange={(v) => set("price_annual", v)}
            placeholder="vide = pas d'annuel"
            hint={preview ? `= ${formatFcfa(annualMonthlyEquivalent(preview)!)} FCFA/mois, économie ${annualSavingsPercent(preview)} %` : "Total facturé pour 12 mois"} />
          <NumberField id={`ms-${draft.code}`} label="Boutiques incluses" value={draft.max_shops} onChange={(v) => set("max_shops", v)}
            hint="Les plus anciennes sont à 0 commission, les suivantes paient la commission" />
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <NumberField id={`av-${draft.code}`} label="Vidéos IA / mois" value={draft.ai_video_quota} onChange={(v) => set("ai_video_quota", v)} />
          <NumberField id={`ai-${draft.code}`} label="Images IA / mois" value={draft.ai_image_quota} onChange={(v) => set("ai_image_quota", v)} />
          <NumberField id={`so-${draft.code}`} label="Ordre d'affichage" value={draft.sort_order} onChange={(v) => set("sort_order", v)} />
        </div>
        <p className="text-[11px] text-muted-foreground -mt-2">
          Les quotas IA sont affichés aux marchands ; le serveur traite aujourd'hui tout abonnement actif comme illimité (consume_ai_credit).
        </p>

        <div className="space-y-1.5">
          <Label className="text-xs">Fonctionnalités affichées (une par ligne)</Label>
          <Textarea rows={5} value={draft.features} onChange={(e) => set("features", e.target.value)} />
          <p className="text-[11px] text-muted-foreground">La ligne « N boutiques incluses » est ajoutée automatiquement à partir du champ ci-dessus.</p>
        </div>

        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={draft.is_active} onCheckedChange={(v) => set("is_active", v)} /> Actif (vendable et renouvelable)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={draft.is_public} onCheckedChange={(v) => set("is_public", v)} /> Affiché sur la page des tarifs
          </label>
        </div>

        <div className="flex justify-end gap-2">
          {onCancel && <Button variant="ghost" onClick={onCancel} disabled={saving}>Annuler</Button>}
          <Button onClick={onSave} disabled={saving || !dirty}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------------------- */
/* Commission                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------- */

const SETTING_FIELDS: Array<{ key: keyof BillingSettings; label: string; unit: string; hint: string; min: number; max: number }> = [
  { key: "commission_per_order", label: "Commission par commande", unit: "FCFA", min: 0, max: 10000,
    hint: "Prélevée sur chaque commande d'une boutique non couverte par un abonnement (boutiques gratuites et boutiques au-delà des boutiques incluses du plan)." },
  { key: "commission_threshold", label: "Seuil de blocage", unit: "FCFA", min: 100, max: 10000000,
    hint: "Quand la commission due atteint ce montant, le délai de paiement démarre. S'applique immédiatement à toutes les boutiques." },
  { key: "payment_deadline_days", label: "Délai de paiement après le seuil", unit: "jours", min: 1, max: 30,
    hint: "Premier délai avant verrouillage. Le second délai avant fermeture définitive reste fixé à 3 jours." },
  { key: "subscription_grace_days", label: "Délai de grâce après l'échéance d'un abonnement", unit: "jours", min: 0, max: 30,
    hint: "Pendant ce délai, la boutique reste ouverte sans commission ; ensuite l'espace de gestion est fermé jusqu'au renouvellement." },
  { key: "subscription_reminder_days", label: "Rappel de renouvellement", unit: "jours avant l'échéance", min: 0, max: 30,
    hint: "Le bandeau « renouvelez » apparaît à partir de ce nombre de jours avant la fin de l'abonnement." },
];

const SETTING_LABELS: Record<string, string> = Object.fromEntries(SETTING_FIELDS.map((f) => [f.key, f.label]));

const settingsToDraft = (s: BillingSettings): Record<string, string> =>
  Object.fromEntries(Object.entries(s).map(([k, v]) => [k, String(v)]));

/* ------------------------------------------------------------------------------------------------------------- */
/* Page                                                                                                          */
/* ------------------------------------------------------------------------------------------------------------- */

type Confirm =
  | { kind: "plan"; draft: PlanDraft; isNew: boolean; changes: string[] }
  | { kind: "settings"; values: BillingSettings; changes: string[] }
  | null;

export default function SubscriptionPlansAdmin() {
  const navigate = useNavigate();
  const invalidate = useInvalidateBillingConfig();
  const { plans, fromDb, isLoading: plansLoading, refetch: refetchPlans } = useSubscriptionPlans();
  const { settings, isLoading: settingsLoading, refetch: refetchSettings } = useBillingSettings();

  const [drafts, setDrafts] = useState<Record<string, PlanDraft>>({});
  const [newDraft, setNewDraft] = useState<PlanDraft | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<Record<string, string>>(() => settingsToDraft(DEFAULT_BILLING_SETTINGS));
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [saving, setSaving] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Brouillons : réinitialisés à chaque rechargement des plans depuis la base
  useEffect(() => {
    setDrafts(Object.fromEntries(plans.map((p) => [p.code, toDraft(p)])));
  }, [plans]);
  useEffect(() => {
    setSettingsDraft(settingsToDraft(settings));
  }, [settings]);

  const currentByCode = useMemo(() => Object.fromEntries(plans.map((p) => [p.code, p])), [plans]);

  const loadOverview = async () => {
    setOverviewLoading(true);
    try {
      const [{ data: ov }, { data: log }] = await Promise.all([
        db.rpc("founder_subscription_overview"),
        db.from("billing_config_audit").select("*").order("changed_at", { ascending: false }).limit(40),
      ]);
      setOverview(ov?.success ? (ov as Overview) : null);
      setAudit(Array.isArray(log) ? (log as AuditRow[]) : []);
    } finally {
      setOverviewLoading(false);
    }
  };
  useEffect(() => { void loadOverview(); }, []);

  const requestSavePlan = (draft: PlanDraft, isNew: boolean) => {
    const problem = validateDraft(draft, isNew);
    if (problem) return toast({ title: "Vérifiez le plan", description: problem, variant: "destructive" });
    if (isNew && currentByCode[draft.code.trim().toLowerCase()]) {
      return toast({ title: "Code déjà utilisé", description: "Un plan porte déjà ce code.", variant: "destructive" });
    }
    const changes = describePlanChanges(draft, isNew ? undefined : currentByCode[draft.code]);
    if (changes.length === 0) return toast({ title: "Aucun changement" });
    setConfirm({ kind: "plan", draft, isNew, changes });
  };

  const requestSaveSettings = () => {
    const values: BillingSettings = { ...settings };
    const changes: string[] = [];
    for (const f of SETTING_FIELDS) {
      const raw = (settingsDraft[f.key] ?? "").trim();
      const n = Number(raw);
      if (raw === "" || !Number.isInteger(n) || n < f.min || n > f.max) {
        return toast({ title: "Vérifiez les réglages", description: `${f.label} : entier entre ${formatFcfa(f.min)} et ${formatFcfa(f.max)}.`, variant: "destructive" });
      }
      values[f.key] = n;
      if (n !== settings[f.key]) changes.push(`${f.label} : ${formatFcfa(settings[f.key])} → ${formatFcfa(n)} ${f.unit}`);
    }
    if (changes.length === 0) return toast({ title: "Aucun changement" });
    setConfirm({ kind: "settings", values, changes });
  };

  const applyConfirm = async () => {
    if (!confirm) return;
    setSaving(true);
    try {
      if (confirm.kind === "plan") {
        const { data, error } = await db.rpc("founder_save_subscription_plan", { p_plan: toPayload(confirm.draft) });
        if (error || !data?.success) throw new Error(data?.message || error?.message || "Enregistrement refusé.");
        toast({
          title: "Plan enregistré",
          description: data.accounts_resynced > 0 ? `${data.accounts_resynced} compte(s) abonné(s) mis à jour.` : undefined,
        });
        if (confirm.isNew) setNewDraft(null);
      } else {
        const { data, error } = await db.rpc("founder_save_billing_settings", { p_settings: confirm.values });
        if (error || !data?.success) throw new Error(data?.message || error?.message || "Enregistrement refusé.");
        toast({ title: "Réglages enregistrés" });
      }
      setConfirm(null);
      invalidate();
      await Promise.all([refetchPlans(), refetchSettings(), loadOverview()]);
    } catch (e) {
      // On referme la confirmation : le brouillon reste affiché et modifiable, le message d'erreur est lisible.
      setConfirm(null);
      toast({ title: "Enregistrement impossible", description: e instanceof Error ? e.message : "Réessayez dans un instant.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const loading = plansLoading || settingsLoading;
  const perOrder = Number(settingsDraft.commission_per_order) || 0;
  const threshold = Number(settingsDraft.commission_threshold) || 0;

  return (
    <div className="container max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/founder-dashboard")} aria-label="Retour"><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Abonnements & commissions</h1>
          <p className="text-sm text-muted-foreground">Grilles tarifaires, boutiques incluses par abonnement et commission des boutiques non couvertes.</p>
        </div>
        <Button variant="outline" onClick={() => { void refetchPlans(); void refetchSettings(); void loadOverview(); }} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </Button>
      </div>

      {!loading && !fromDb && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 flex gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            Les tables de réglage sont introuvables sur cette base : la migration <span className="font-mono">20261107100000</span> n'est pas appliquée.
            Les valeurs affichées sont les anciens montants par défaut et l'enregistrement échouera tant qu'elle n'est pas passée.
          </div>
        </div>
      )}

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="commission">Commission</TabsTrigger>
          <TabsTrigger value="overview">Aperçu & historique</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4 mt-4">
          <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-1">
            <p><b>Comment ça marche.</b> Un abonnement est rattaché au compte du marchand. Il couvre ses <b>N boutiques les plus anciennes</b> (0 commission),
              N étant le nombre de « boutiques incluses » du plan. Les boutiques au-delà restent créables et paient la commission par commande.</p>
            <p className="text-muted-foreground">Un changement de prix n'affecte que les prochains paiements. Une hausse du nombre de boutiques incluses s'applique tout de suite ;
              une baisse s'applique au prochain renouvellement de chaque abonné (on ne retire rien à quelqu'un qui a déjà payé).</p>
          </div>

          {loading ? (
            <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-4">
              {plans.map((p) => drafts[p.code] && (
                <PlanEditor
                  key={p.code}
                  draft={drafts[p.code]}
                  current={p}
                  isNew={false}
                  saving={saving}
                  onChange={(d) => setDrafts((prev) => ({ ...prev, [p.code]: d }))}
                  onSave={() => requestSavePlan(drafts[p.code], false)}
                />
              ))}
              {newDraft && (
                <PlanEditor
                  draft={newDraft}
                  isNew
                  saving={saving}
                  onChange={setNewDraft}
                  onSave={() => requestSavePlan(newDraft, true)}
                  onCancel={() => setNewDraft(null)}
                />
              )}
            </div>
          )}

          {!newDraft && !loading && (
            <Button variant="outline" onClick={() => setNewDraft(emptyDraft((Math.max(0, ...plans.map((p) => p.sort_order)) || 0) + 10))}>
              <Plus className="h-4 w-4 mr-2" /> Ajouter un plan
            </Button>
          )}
        </TabsContent>

        <TabsContent value="commission" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Commission et délais</CardTitle>
              <CardDescription>Valables pour toutes les boutiques, effet immédiat sur les prochaines commandes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid md:grid-cols-2 gap-5">
                {SETTING_FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label htmlFor={`s-${f.key}`}>{f.label}</Label>
                    <div className="flex items-center gap-2">
                      <Input id={`s-${f.key}`} inputMode="numeric" className="max-w-[180px]" value={settingsDraft[f.key]}
                        onChange={(e) => setSettingsDraft((prev) => ({ ...prev, [f.key]: e.target.value.replace(/[^\d]/g, "") }))} />
                      <span className="text-sm text-muted-foreground">{f.unit}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{f.hint}</p>
                  </div>
                ))}
              </div>
              {perOrder > 0 && threshold > 0 && (
                <p className="text-sm text-muted-foreground">
                  Avec ces valeurs, une boutique non couverte atteint le seuil après environ <b>{formatFcfa(Math.ceil(threshold / perOrder))}</b> commandes.
                </p>
              )}
              <div className="flex justify-end">
                <Button onClick={requestSaveSettings} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Enregistrer
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Abonnés par plan</CardTitle>
              <CardDescription>
                {overview ? `${overview.shops_on_commission} boutique(s) sur ${overview.total_shops} paient la commission par commande.` : "Chargement…"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {overviewLoading && !overview ? (
                <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : !overview ? (
                <p className="text-sm text-muted-foreground">Aperçu indisponible (migration non appliquée ou accès refusé).</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b">
                        <th className="py-2 pr-4">Plan</th>
                        <th className="py-2 pr-4">Comptes abonnés</th>
                        <th className="py-2 pr-4">Comptes au-dessus de la limite</th>
                        <th className="py-2">Boutiques à la commission</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(overview.plans || []).map((row) => (
                        <tr key={row.code} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-medium">{currentByCode[row.code]?.name || row.code}</td>
                          <td className="py-2 pr-4">{row.active_accounts}</td>
                          <td className="py-2 pr-4">{row.accounts_over_limit}</td>
                          <td className="py-2">{row.shops_on_commission}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Historique des modifications</CardTitle>
            </CardHeader>
            <CardContent>
              {audit.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune modification enregistrée.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {audit.map((a) => (
                    <li key={a.id} className="py-2 flex flex-wrap gap-x-3 gap-y-1">
                      <span className="text-muted-foreground tabular-nums">{new Date(a.changed_at).toLocaleString("fr-FR")}</span>
                      <Badge variant="outline">{a.kind === "plan" ? "Plan" : "Réglage"}</Badge>
                      <span>{a.kind === "plan" ? describeAuditPlan(a) : describeAuditSetting(a)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!confirm} onOpenChange={(open) => { if (!open && !saving) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer l'enregistrement</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Ces changements seront appliqués maintenant :</p>
                <ul className="list-disc pl-5 space-y-1 text-foreground">
                  {confirm?.changes.map((c) => <li key={c}>{c}</li>)}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Annuler</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={(e) => { e.preventDefault(); void applyConfirm(); }}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function describeAuditSetting(a: AuditRow): string {
  const label = SETTING_LABELS[a.key] || a.key;
  return `${label} : ${a.old_value ?? "—"} → ${a.new_value}`;
}

function describeAuditPlan(a: AuditRow): string {
  const o = a.old_value as PlanSnapshot | null;
  const n = (a.new_value || {}) as PlanSnapshot;
  if (!o) return `Plan « ${n.name || a.key} » créé (${formatFcfa(n.price_monthly)} FCFA/mois, ${n.max_shops} boutique(s) incluse(s))`;
  const parts: string[] = [];
  if (o.price_monthly !== n.price_monthly) parts.push(`prix mensuel ${formatFcfa(o.price_monthly)} → ${formatFcfa(n.price_monthly)}`);
  if (o.price_annual !== n.price_annual) parts.push(`prix annuel ${o.price_annual ?? "aucun"} → ${n.price_annual ?? "aucun"}`);
  if (o.max_shops !== n.max_shops) parts.push(`boutiques incluses ${o.max_shops} → ${n.max_shops}`);
  if (o.is_active !== n.is_active) parts.push(n.is_active ? "réactivé" : "désactivé");
  if (o.is_public !== n.is_public) parts.push(n.is_public ? "affiché" : "masqué");
  if (parts.length === 0) parts.push("textes ou quotas modifiés");
  return `${n.name || a.key} : ${parts.join(", ")}`;
}
