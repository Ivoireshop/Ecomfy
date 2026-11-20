import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ImagePlus, Loader2, Save, ShieldCheck, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { deliveryService } from "@/lib/deliveryService";
import type { DeliveryCompany, DeliveryProfileInput } from "@/types/delivery";
import { DeliveryLogo } from "./DeliveryDirectoryParts";

/** Changer l'un de ces champs sur une structure approuvée la renvoie en vérification (règle appliquée par la base). */
const SENSITIVE: Array<keyof DeliveryProfileInput> = ["company_name", "headquarters_address", "city"];
const SENSITIVE_LABELS: Record<string, string> = {
  company_name: "le nom commercial",
  headquarters_address: "l'adresse",
  city: "la ville",
};

const toForm = (c: DeliveryCompany): DeliveryProfileInput => ({
  company_name: c.company_name ?? "",
  description: c.description ?? "",
  services_info: c.services_info ?? "",
  headquarters_address: c.headquarters_address ?? "",
  city: c.city ?? "",
  manager_phone: c.manager_phone ?? "",
  manager_whatsapp: c.manager_whatsapp ?? "",
  public_phone: c.public_phone ?? "",
  public_email: c.public_email ?? "",
  covered_cities: c.covered_cities ?? [],
  logo_url: c.logo_url ?? null,
});

const parseCities = (raw: string) =>
  Array.from(new Set(raw.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean))).slice(0, 60);

/** Profil modifiable de la structure (cahier §3.2), réservé au responsable (propriétaire du dossier). */
export default function DeliveryProfileEditor({ onSaved }: { onSaved?: (company: DeliveryCompany) => void }) {
  const { toast } = useToast();
  const [company, setCompany] = useState<DeliveryCompany | null>(null);
  const [form, setForm] = useState<DeliveryProfileInput | null>(null);
  const [cities, setCities] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const c = await deliveryService.getMyCompany();
    setCompany(c);
    if (c) {
      setForm(toForm(c));
      setCities((c.covered_cities ?? []).join(", "));
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof DeliveryProfileInput>(key: K, value: DeliveryProfileInput[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setAcknowledged(false);
  };

  const original = useMemo(() => (company ? toForm(company) : null), [company]);
  const effective = useMemo(() => (form ? { ...form, covered_cities: parseCities(cities) } : null), [form, cities]);

  const changedKeys = useMemo(() => {
    if (!original || !effective) return [] as Array<keyof DeliveryProfileInput>;
    return (Object.keys(effective) as Array<keyof DeliveryProfileInput>).filter(
      (k) => JSON.stringify(effective[k]) !== JSON.stringify(original[k]),
    );
  }, [original, effective]);

  const sensitiveChanged = changedKeys.filter((k) => SENSITIVE.includes(k));
  const willReverify = company?.verification_status === "approved" && sensitiveChanged.length > 0;

  if (loading) {
    return (
      <Card className="bg-slate-900 border-slate-800 p-6 text-xs text-slate-400 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Chargement du profil…
      </Card>
    );
  }
  if (!company || !form || !effective) return null;

  const isDriver = company.profile_type === "driver";

  const onLogo = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      set("logo_url", await deliveryService.uploadLogo(file));
    } catch (e) {
      toast({ variant: "destructive", title: "Logo refusé", description: e instanceof Error ? e.message : "Dépôt impossible." });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (changedKeys.length === 0) return;
    if (!effective.company_name.trim() || !effective.headquarters_address.trim() || !effective.city.trim()) {
      toast({ variant: "destructive", title: "Champs requis", description: "Le nom, l'adresse et la ville sont obligatoires." });
      return;
    }
    if (willReverify && !acknowledged) {
      toast({ variant: "destructive", title: "Confirmation requise", description: "Cochez la case pour confirmer la nouvelle vérification." });
      return;
    }
    setSaving(true);
    try {
      const patch: Partial<DeliveryProfileInput> = {};
      for (const k of changedKeys) (patch as Record<string, unknown>)[k] = k === "logo_url" || k === "covered_cities" ? effective[k] : (effective[k] as string).trim();
      // Les champs facultatifs vides sont enregistrés comme absents.
      for (const k of ["description", "services_info", "public_phone", "public_email"] as const) {
        if (k in patch && patch[k] === "") (patch as Record<string, unknown>)[k] = null;
      }
      const updated = await deliveryService.updateMyProfile(company.id, patch);
      setCompany(updated);
      setForm(toForm(updated));
      setCities((updated.covered_cities ?? []).join(", "));
      setAcknowledged(false);
      onSaved?.(updated);
      const demoted = company.verification_status === "approved" && updated.verification_status !== "approved";
      toast({
        title: demoted ? "Profil enregistré — nouvelle vérification demandée" : "Profil enregistré",
        description: demoted
          ? "Le badge « vérifiée » est retiré jusqu'à la validation de l'équipe eComfy. Votre fiche n'apparaît plus dans le répertoire d'ici là."
          : "Les marchands voient la mise à jour dans le répertoire.",
      });
    } catch (e) {
      toast({ variant: "destructive", title: "Enregistrement impossible", description: e instanceof Error ? e.message : "Erreur inconnue." });
    } finally {
      setSaving(false);
    }
  };

  const field = "bg-slate-950 border-slate-800 text-white placeholder:text-slate-500";

  return (
    <Card className="bg-slate-900 border-slate-800 p-5 space-y-5" aria-labelledby="delivery-profile-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="delivery-profile-title" className="text-lg font-bold text-white flex items-center gap-2">
          <Store className="w-5 h-5 text-emerald-400" /> Profil de {isDriver ? "mon activité" : "ma structure"}
        </h2>
        {company.verification_status === "approved" && company.trust_badge_active ? (
          <span className="text-[11px] text-emerald-300 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Vérifiée par eComfy
          </span>
        ) : (
          <span className="text-[11px] text-amber-300">Non visible dans le répertoire tant que le dossier n'est pas approuvé</span>
        )}
      </div>
      <p className="text-xs text-slate-400 -mt-3">
        Ces informations forment votre fiche dans le répertoire que consultent les marchands. Les pièces justificatives se gèrent depuis « Suivi du dossier ».
      </p>

      <div className="flex items-center gap-4">
        <DeliveryLogo card={{ logo_url: form.logo_url, company_name: form.company_name, profile_type: company.profile_type ?? "manager" }} size={64} />
        <div>
          <Label htmlFor="delivery-logo" className="text-xs text-slate-300 block">Logo ou photo de présentation</Label>
          <label
            htmlFor="delivery-logo"
            className="mt-1.5 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 cursor-pointer hover:bg-slate-700"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
            {form.logo_url ? "Remplacer l'image" : "Ajouter une image"}
          </label>
          <input
            id="delivery-logo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              void onLogo(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <p className="text-[10px] text-slate-500 mt-1">JPG, PNG ou WEBP, 2 Mo maximum.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="p-name" className="text-xs text-slate-300">Nom commercial</Label>
          <Input id="p-name" value={form.company_name} maxLength={120} onChange={(e) => set("company_name", e.target.value)} className={field} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="p-desc" className="text-xs text-slate-300">Description de l'activité</Label>
          <Textarea id="p-desc" value={form.description} maxLength={2000} rows={4} onChange={(e) => set("description", e.target.value)} className={field} placeholder="Présentez votre structure, votre expérience, votre façon de travailler." />
          <span className="text-[10px] text-slate-500">{form.description.length}/2000</span>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="p-services" className="text-xs text-slate-300">Services proposés</Label>
          <Textarea id="p-services" value={form.services_info} maxLength={1500} rows={3} onChange={(e) => set("services_info", e.target.value)} className={field} placeholder="Ex. : livraison le jour même, paiement à la livraison, colis fragiles." />
        </div>
        <div className="space-y-1">
          <Label htmlFor="p-city" className="text-xs text-slate-300">Ville</Label>
          <Input id="p-city" value={form.city} onChange={(e) => set("city", e.target.value)} className={field} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="p-addr" className="text-xs text-slate-300">Adresse {isDriver ? "(jamais affichée aux marchands)" : "physique complète"}</Label>
          <Input id="p-addr" value={form.headquarters_address} onChange={(e) => set("headquarters_address", e.target.value)} className={field} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="p-zones" className="text-xs text-slate-300">Zones de livraison (séparées par des virgules)</Label>
          <Input id="p-zones" value={cities} onChange={(e) => { setCities(e.target.value); setAcknowledged(false); }} className={field} placeholder="Abidjan, Bingerville, Bouaké" />
          <span className="text-[10px] text-slate-500">{effective.covered_cities.length} zone(s) · 60 maximum</span>
        </div>
        <div className="space-y-1">
          <Label htmlFor="p-pub-phone" className="text-xs text-slate-300">Téléphone affiché aux marchands</Label>
          <Input id="p-pub-phone" inputMode="tel" value={form.public_phone} onChange={(e) => set("public_phone", e.target.value)} className={field} placeholder={form.manager_phone || "+225…"} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="p-email" className="text-xs text-slate-300">E-mail de contact</Label>
          <Input id="p-email" type="email" value={form.public_email} onChange={(e) => set("public_email", e.target.value)} className={field} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="p-mgr-phone" className="text-xs text-slate-300">Téléphone du responsable</Label>
          <Input id="p-mgr-phone" inputMode="tel" value={form.manager_phone} onChange={(e) => set("manager_phone", e.target.value)} className={field} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="p-wa" className="text-xs text-slate-300">WhatsApp</Label>
          <Input id="p-wa" inputMode="tel" value={form.manager_whatsapp} onChange={(e) => set("manager_whatsapp", e.target.value)} className={field} />
        </div>
      </div>

      {willReverify && (
        <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>
              Vous modifiez {sensitiveChanged.map((k) => SENSITIVE_LABELS[k]).join(", ")}. L'adresse a été contrôlée sur place : votre dossier repasse
              en vérification, le badge « vérifiée » est retiré et votre fiche quitte le répertoire jusqu'à la validation par l'équipe eComfy.
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="accent-amber-400" />
            Je comprends et je demande une nouvelle vérification
          </label>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {changedKeys.length > 0 && (
          <Button
            type="button"
            onClick={() => {
              setForm(toForm(company));
              setCities((company.covered_cities ?? []).join(", "));
              setAcknowledged(false);
            }}
            className="bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 text-xs"
          >
            Annuler les modifications
          </Button>
        )}
        <Button
          type="button"
          onClick={() => void save()}
          disabled={saving || uploading || changedKeys.length === 0 || (willReverify && !acknowledged)}
          className="bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Enregistrer le profil
        </Button>
      </div>
    </Card>
  );
}
