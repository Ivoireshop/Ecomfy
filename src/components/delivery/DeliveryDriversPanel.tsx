import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Pencil, Plus, Truck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { deliveryService, type DriverInput } from "@/lib/deliveryService";
import { VEHICLE_LICENSE_REQUIREMENTS } from "@/lib/vehicleLicenseMatcher";
import { DeliveryDocUpload } from "./DeliveryDocUpload";
import { DeliverySelfieCapture } from "./DeliverySelfieCapture";
import { DriverLicenseFields } from "./DriverLicenseFields";
import { emptyLicenseForm, licenseFormProblems, type LicenseFormState } from "@/lib/driverLicenseForm";
import { driverDossierGaps } from "@/lib/deliveryDossier";
import type { DeliveryCompany, DeliveryDriver } from "@/types/delivery";

const eighteenYearsAgoIso = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
};

const daysUntil = (iso?: string | null): number | null =>
  iso ? Math.ceil((new Date(`${iso}T00:00:00`).getTime() - Date.now()) / 86_400_000) : null;

const formatDate = (iso?: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");

function StatusBadge({ driver }: { driver: DeliveryDriver }) {
  switch (driver.verification_status) {
    case "approved":
      return driver.is_active
        ? <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]"><CheckCircle2 className="w-3 h-3 mr-1" />Actif</Badge>
        : <Badge className="bg-slate-500/20 text-slate-300 border-slate-500/40 text-[10px]">Approuvé, désactivé</Badge>;
    case "rejected":
      return <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-[10px]"><XCircle className="w-3 h-3 mr-1" />Refusé</Badge>;
    case "suspended":
      return <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-[10px]"><AlertTriangle className="w-3 h-3 mr-1" />Suspendu</Badge>;
    default:
      return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]"><Clock className="w-3 h-3 mr-1" />En attente de vérification</Badge>;
  }
}

interface DriverFormState {
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: string;
  idNumber: string;
  idExpiry: string;
  idPhoto: string;
  idBackPhoto: string;
  selfie: string;
  license: LicenseFormState;
}

const blankForm = (): DriverFormState => ({
  firstName: "", lastName: "", phone: "", dateOfBirth: "", idNumber: "", idExpiry: "", idPhoto: "", idBackPhoto: "", selfie: "", license: emptyLicenseForm(),
});

const formFromDriver = (d: DeliveryDriver): DriverFormState => ({
  firstName: d.first_name ?? "",
  lastName: d.last_name ?? "",
  phone: d.phone ?? "",
  dateOfBirth: d.date_of_birth ?? "",
  idNumber: d.id_number ?? "",
  idExpiry: d.id_expiry ?? "",
  idPhoto: d.national_id_photo_url ?? "",
  idBackPhoto: d.national_id_back_photo_url ?? "",
  selfie: d.selfie_with_id_url ?? "",
  license: {
    vehicleType: d.vehicle_type,
    plate: d.vehicle_license_plate ?? "",
    licenseNumber: d.license_number ?? "",
    categories: d.license_categories ?? [],
    licenseExpiry: d.license_expiry ?? "",
    licensePhoto: d.license_photo_url ?? "",
    licenseBackPhoto: d.license_back_photo_url ?? "",
  },
});

function formProblems(f: DriverFormState): string[] {
  const out: string[] = [];
  if (!f.firstName.trim() || !f.lastName.trim()) out.push("Nom et prénom du livreur requis.");
  if (!f.phone.trim()) out.push("Téléphone du livreur requis.");
  if (!f.dateOfBirth) out.push("Date de naissance requise.");
  else if (f.dateOfBirth > eighteenYearsAgoIso()) out.push("Le livreur doit être majeur.");
  if (!f.idPhoto) out.push("Photo de la pièce d'identité (recto) requise.");
  if (!f.idBackPhoto) out.push("Photo du verso de la pièce d'identité requise.");
  if (!f.selfie) out.push("Selfie avec la pièce d'identité requis.");
  return [...out, ...licenseFormProblems(f.license, f.idExpiry)];
}

function DriverEditorDialog({ open, onOpenChange, company, driver, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: DeliveryCompany;
  driver: DeliveryDriver | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<DriverFormState>(() => (driver ? formFromDriver(driver) : blankForm()));
  const [saving, setSaving] = useState(false);
  const patch = (p: Partial<DriverFormState>) => setForm((f) => ({ ...f, ...p }));
  const problems = formProblems(form);
  const inputCls = "bg-slate-950 border-slate-800 text-white text-xs";

  const save = async () => {
    if (problems.length) {
      toast({ variant: "destructive", title: "Informations à compléter", description: problems[0] });
      return;
    }
    const input: DriverInput = {
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      phone: form.phone.trim(),
      date_of_birth: form.dateOfBirth,
      vehicle_type: form.license.vehicleType,
      vehicle_license_plate: form.license.plate.trim() || undefined,
      id_type: "cni",
      id_number: form.idNumber.trim() || undefined,
      id_expiry: form.idExpiry || undefined,
      license_number: form.license.licenseNumber.trim(),
      license_categories: form.license.categories,
      license_expiry: form.license.licenseExpiry,
      national_id_photo_url: form.idPhoto,
      national_id_back_photo_url: form.idBackPhoto,
      license_photo_url: form.license.licensePhoto,
      license_back_photo_url: form.license.licenseBackPhoto,
      selfie_with_id_url: form.selfie,
    };
    setSaving(true);
    try {
      if (driver) await deliveryService.updateDriver(driver.id, input);
      else await deliveryService.addDriver(company.id, input);
      toast({
        title: driver ? "Livreur mis à jour" : "Livreur ajouté",
        description: "Il sera actif dès que l'équipe Ecomfy aura vérifié ses pièces.",
      });
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast({ variant: "destructive", title: "Enregistrement refusé", description: e instanceof Error ? e.message : "Erreur." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-800 text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-white">{driver ? `Corriger ${driver.full_name}` : "Ajouter un livreur"}</DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            Le livreur reste inactif jusqu'à la vérification de ses pièces et de son permis par l'équipe Ecomfy.
            {driver && " Toute modification de ses pièces ou de son permis déclenche une nouvelle vérification."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label htmlFor="d-first" className="text-xs">Prénom *</Label><Input id="d-first" value={form.firstName} onChange={(e) => patch({ firstName: e.target.value })} className={inputCls} /></div>
            <div className="space-y-1.5"><Label htmlFor="d-last" className="text-xs">Nom *</Label><Input id="d-last" value={form.lastName} onChange={(e) => patch({ lastName: e.target.value })} className={inputCls} /></div>
            <div className="space-y-1.5"><Label htmlFor="d-phone" className="text-xs">Téléphone *</Label><Input id="d-phone" value={form.phone} onChange={(e) => patch({ phone: e.target.value })} className={inputCls} /></div>
            <div className="space-y-1.5"><Label htmlFor="d-dob" className="text-xs">Date de naissance *</Label><Input id="d-dob" type="date" max={eighteenYearsAgoIso()} value={form.dateOfBirth} onChange={(e) => patch({ dateOfBirth: e.target.value })} className={inputCls} /></div>
            <div className="space-y-1.5"><Label htmlFor="d-idn" className="text-xs">N° de pièce d'identité</Label><Input id="d-idn" value={form.idNumber} onChange={(e) => patch({ idNumber: e.target.value })} className={inputCls} /></div>
            <div className="space-y-1.5"><Label htmlFor="d-ide" className="text-xs">Expiration de la pièce</Label><Input id="d-ide" type="date" value={form.idExpiry} onChange={(e) => patch({ idExpiry: e.target.value })} className={inputCls} /></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DeliveryDocUpload label="Pièce d'identité du livreur — recto" field="driver_id" category="national_id" required value={form.idPhoto} onChange={(idPhoto) => patch({ idPhoto })} />
            <DeliveryDocUpload label="Pièce d'identité du livreur — verso" field="driver_id_back" category="national_id" required value={form.idBackPhoto} onChange={(idBackPhoto) => patch({ idBackPhoto })} />
          </div>
          <DeliverySelfieCapture field="driver_selfie" value={form.selfie} onChange={(selfie) => patch({ selfie })} />
          <DriverLicenseFields value={form.license} onChange={(license) => patch({ license })} idExpiry={form.idExpiry} />
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="bg-slate-900 hover:text-white border-slate-700 text-slate-300 text-xs">Annuler</Button>
          <Button type="button" onClick={save} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs">
            {saving ? "Enregistrement…" : driver ? "Enregistrer" : "Ajouter le livreur"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Livreurs de la structure : statut de vérification, permis et expiration, ajout et correction. */
export function DeliveryDriversPanel({ company, onChanged }: { company: DeliveryCompany; onChanged: () => void }) {
  const [editing, setEditing] = useState<DeliveryDriver | null>(null);
  const [open, setOpen] = useState(false);
  const drivers = company.drivers ?? [];
  const canEdit = company.verification_status !== "suspended";

  const openFor = (d: DeliveryDriver | null) => {
    setEditing(d);
    setOpen(true);
  };

  return (
    <Card className="bg-slate-900/90 border-slate-800">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base font-bold text-white flex items-center gap-2"><Truck className="w-4 h-4 text-emerald-400" /> Livreurs ({drivers.length})</CardTitle>
          <CardDescription className="text-xs text-slate-400">Un livreur reçoit des courses seulement une fois approuvé et son permis valable.</CardDescription>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => openFor(null)} className="bg-slate-900 hover:text-white border-slate-700 text-emerald-300 hover:bg-slate-800 text-xs shrink-0">
            <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {drivers.length === 0 && <p className="text-xs text-slate-500">Aucun livreur enregistré.</p>}
        {drivers.map((d) => {
          const left = daysUntil(d.license_expiry);
          const soon = left !== null && left >= 0 && left <= 30 && d.verification_status === "approved";
          return (
            <div key={d.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{d.full_name}</p>
                  <p className="text-[11px] text-slate-400">
                    {VEHICLE_LICENSE_REQUIREMENTS[d.vehicle_type]?.label ?? d.vehicle_type} · permis {d.license_categories?.join("+") || "—"} · expire le {formatDate(d.license_expiry)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge driver={d} />
                  {canEdit && (
                    <Button size="icon" variant="ghost" aria-label={`Corriger ${d.full_name}`} onClick={() => openFor(d)} className="h-7 w-7 text-slate-400 hover:text-white">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              {(d.verification_status === "rejected" || d.verification_status === "suspended") && d.rejection_reason && (
                <p className="text-[11px] text-rose-300 bg-rose-950/40 border border-rose-900 rounded-md px-2 py-1.5">Motif : {d.rejection_reason}</p>
              )}
              {d.verification_status !== "approved" && driverDossierGaps(d).length > 0 && (
                <p className="text-[11px] text-amber-300 bg-amber-950/30 border border-amber-500/30 rounded-md px-2 py-1.5">
                  À ajouter : {driverDossierGaps(d).map((g) => g.label.replace(`${d.full_name} : `, "")).join(", ")}. Utilisez le crayon pour corriger ce livreur.
                </p>
              )}
              {soon && (
                <p className="text-[11px] text-amber-300 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Permis : expire dans {left} jour(s). Mettez-le à jour pour éviter la suspension.</p>
              )}
            </div>
          );
        })}
      </CardContent>

      {open && (
        <DriverEditorDialog
          key={editing?.id ?? "new"}
          open={open}
          onOpenChange={setOpen}
          company={company}
          driver={editing}
          onSaved={onChanged}
        />
      )}
    </Card>
  );
}
