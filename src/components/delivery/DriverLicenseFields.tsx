import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeliveryDocUpload } from "./DeliveryDocUpload";
import type { LicenseFormState } from "@/lib/driverLicenseForm";
import { LICENSE_CATEGORIES, VEHICLE_LICENSE_REQUIREMENTS, getDriverLicenseIssues } from "@/lib/vehicleLicenseMatcher";
import type { DeliveryVehicleType, LicenseCategory } from "@/types/delivery";

const SELECTABLE_VEHICLES: DeliveryVehicleType[] = ["motorcycle", "tricycle", "car", "van"];

interface DriverLicenseFieldsProps {
  value: LicenseFormState;
  onChange: (next: LicenseFormState) => void;
  idExpiry?: string | null;
  /** Affiche la liste des anomalies (désactivé tant que l'utilisateur n'a rien saisi). */
  showProblems?: boolean;
}

/**
 * Saisie du permis : la catégorie est DÉCLARÉE par l'utilisateur (lue sur son permis) et vérifiée contre le véhicule.
 * La base refuse un livreur dont le permis est incompatible ou expiré ; l'humain contrôle ensuite la photo du permis.
 */
export function DriverLicenseFields({ value, onChange, idExpiry, showProblems = true }: DriverLicenseFieldsProps) {
  const requirement = VEHICLE_LICENSE_REQUIREMENTS[value.vehicleType];
  const issues = getDriverLicenseIssues({
    vehicleType: value.vehicleType,
    categories: value.categories,
    licenseExpiry: value.licenseExpiry || null,
    idExpiry: idExpiry || null,
  });
  const touched = value.categories.length > 0 || !!value.licenseExpiry;
  const set = (patch: Partial<LicenseFormState>) => onChange({ ...value, ...patch });
  const toggle = (c: LicenseCategory) =>
    set({ categories: value.categories.includes(c) ? value.categories.filter((x) => x !== c) : [...value.categories, c] });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="drv-vehicle" className="text-xs text-slate-200">Véhicule utilisé pour les livraisons *</Label>
          <select
            id="drv-vehicle"
            value={value.vehicleType}
            onChange={(e) => set({ vehicleType: e.target.value as DeliveryVehicleType })}
            className="w-full h-9 rounded-md bg-slate-950 border border-slate-800 text-white px-2 text-xs"
          >
            {SELECTABLE_VEHICLES.map((v) => (
              <option key={v} value={v}>
                {VEHICLE_LICENSE_REQUIREMENTS[v].label} (catégorie {VEHICLE_LICENSE_REQUIREMENTS[v].required_categories.join(" ou ")})
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500">{requirement.description}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="drv-plate" className="text-xs text-slate-200">Immatriculation</Label>
          <Input id="drv-plate" value={value.plate} onChange={(e) => set({ plate: e.target.value })} placeholder="Ex: 1234 AB 01" className="bg-slate-950 border-slate-800 text-white text-xs" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="drv-licno" className="text-xs text-slate-200">Numéro du permis *</Label>
          <Input id="drv-licno" value={value.licenseNumber} onChange={(e) => set({ licenseNumber: e.target.value })} className="bg-slate-950 border-slate-800 text-white text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="drv-licexp" className="text-xs text-slate-200">Date d'expiration du permis *</Label>
          <Input id="drv-licexp" type="date" value={value.licenseExpiry} onChange={(e) => set({ licenseExpiry: e.target.value })} className="bg-slate-950 border-slate-800 text-white text-xs" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-slate-200">Catégories inscrites sur votre permis *</Label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Catégories du permis">
          {LICENSE_CATEGORIES.map((c) => {
            const on = value.categories.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(c)}
                className={`w-10 h-10 rounded-lg border text-sm font-bold transition-colors ${on ? "bg-emerald-500 border-emerald-400 text-slate-950" : "bg-slate-800 border-slate-600 text-slate-100 hover:border-slate-400"}`}
              >
                {c}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500">Cochez uniquement ce qui est écrit sur le permis : l'équipe le compare à la photo.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DeliveryDocUpload
          label="Permis de conduire — recto"
          hint="Face avec la photo et l'état civil, lisible, entière, non expirée."
          field="driver_license"
          category="driver_license"
          accept="image/*"
          required
          value={value.licensePhoto}
          onChange={(licensePhoto) => set({ licensePhoto })}
        />
        <DeliveryDocUpload
          label="Permis de conduire — verso"
          hint="Face avec les catégories et les dates, lisible et entière."
          field="driver_license_back"
          category="driver_license"
          accept="image/*"
          required
          value={value.licenseBackPhoto}
          onChange={(licenseBackPhoto) => set({ licenseBackPhoto })}
        />
      </div>

      {showProblems && touched && (
        issues.length === 0 ? (
          <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-950/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> Catégories compatibles avec le véhicule et permis valable. La photo sera vérifiée par l'équipe.
          </div>
        ) : (
          <div role="alert" className="p-3 rounded-xl border border-rose-500/40 bg-rose-950/30 text-rose-200 text-xs space-y-1">
            {issues.map((i) => (
              <p key={i} className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-px" /> {i}</p>
            ))}
          </div>
        )
      )}
    </div>
  );
}
