import { getDriverLicenseIssues } from "@/lib/vehicleLicenseMatcher";
import type { DeliveryVehicleType, LicenseCategory } from "@/types/delivery";

/** État du formulaire de permis (partagé par l'inscription, la resoumission et l'ajout d'un livreur). */
export interface LicenseFormState {
  vehicleType: DeliveryVehicleType;
  plate: string;
  licenseNumber: string;
  categories: LicenseCategory[];
  licenseExpiry: string;
  /** Chemin du permis dans le bucket privé. */
  licensePhoto: string;
}

export const emptyLicenseForm = (): LicenseFormState => ({
  vehicleType: "motorcycle",
  plate: "",
  licenseNumber: "",
  categories: [],
  licenseExpiry: "",
  licensePhoto: "",
});

/** Anomalies bloquantes (mêmes messages que la base) + champs manquants. */
export function licenseFormProblems(value: LicenseFormState, idExpiry?: string | null): string[] {
  const problems = getDriverLicenseIssues({
    vehicleType: value.vehicleType,
    categories: value.categories,
    licenseExpiry: value.licenseExpiry || null,
    idExpiry: idExpiry || null,
  });
  if (!value.licenseNumber.trim()) problems.push("Numéro de permis requis.");
  if (!value.licensePhoto) problems.push("Photo du permis requise.");
  return problems;
}
