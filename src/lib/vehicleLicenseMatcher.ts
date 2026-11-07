/**
 * Règle permis de conduire ↔ véhicule pour Ecomfy Livraison.
 *
 * MIROIR de la base : delivery_required_license_categories() et delivery_driver_issues()
 * (supabase/migrations/20261106110000_delivery_kyc_audit_notifications.sql). La base fait foi : elle refuse
 * l'enregistrement et l'approbation d'un livreur non conforme. Ce module sert à prévenir l'utilisateur avant l'envoi.
 * Toute modification de règle se fait aux deux endroits (le test src/lib/vehicleLicenseMatcher.test.ts fige les cas).
 */

import { DeliveryVehicleType, LicenseCategory } from "@/types/delivery";

export const LICENSE_CATEGORIES: LicenseCategory[] = ["A", "B", "C", "D", "E"];

export interface VehicleLicenseRequirement {
  vehicle_type: DeliveryVehicleType;
  label: string;
  required_categories: LicenseCategory[];
  description: string;
}

export const VEHICLE_LICENSE_REQUIREMENTS: Record<DeliveryVehicleType, VehicleLicenseRequirement> = {
  motorcycle: {
    vehicle_type: "motorcycle",
    label: "Moto / Scooter",
    required_categories: ["A"],
    description: "Catégorie A obligatoire pour conduire les véhicules à deux roues motorisés.",
  },
  tricycle: {
    vehicle_type: "tricycle",
    label: "Tricycle motorisé",
    required_categories: ["A"],
    description: "Catégorie A obligatoire pour la conduite des tricycles à moteur.",
  },
  car: {
    vehicle_type: "car",
    label: "Voiture / Véhicule léger",
    required_categories: ["B"],
    description: "Catégorie B obligatoire pour les voitures et véhicules légers de livraison.",
  },
  van: {
    vehicle_type: "van",
    label: "Camionnette / Van",
    required_categories: ["B", "C"],
    description: "Catégorie B ou C obligatoire pour les camionnettes et fourgons de transport.",
  },
  other: {
    vehicle_type: "other",
    label: "Autre véhicule",
    required_categories: ["A", "B"],
    description: "Permis de conduire de catégorie A ou B requis.",
  },
};

export interface DriverLicenseInput {
  vehicleType: DeliveryVehicleType;
  /** Catégories DÉCLARÉES par le livreur (lues sur son permis). Aucune valeur par défaut : rien n'est supposé. */
  categories: LicenseCategory[];
  /** Date d'expiration du permis (AAAA-MM-JJ). */
  licenseExpiry?: string | null;
  /** Date d'expiration de la pièce d'identité (AAAA-MM-JJ), facultative. */
  idExpiry?: string | null;
}

const formatDate = (iso: string) => iso.split("-").reverse().join("/");

/** Anomalies bloquantes, avec les mêmes messages que la base. Liste vide = conforme. */
export function getDriverLicenseIssues(input: DriverLicenseInput, today: string = new Date().toISOString().slice(0, 10)): string[] {
  const issues: string[] = [];
  const requirement = VEHICLE_LICENSE_REQUIREMENTS[input.vehicleType] ?? VEHICLE_LICENSE_REQUIREMENTS.other;

  if (!input.categories.length) {
    issues.push("Aucune catégorie de permis déclarée.");
  } else if (!input.categories.some((c) => requirement.required_categories.includes(c))) {
    issues.push(
      `Permis non conforme : catégorie ${requirement.required_categories.join(" ou ")} requise pour ${requirement.label} (déclaré : ${input.categories.join(", ")}).`,
    );
  }

  if (!input.licenseExpiry) {
    issues.push("Date d'expiration du permis non renseignée.");
  } else if (input.licenseExpiry < today) {
    issues.push(`Permis expiré le ${formatDate(input.licenseExpiry)}.`);
  }

  if (input.idExpiry && input.idExpiry < today) {
    issues.push(`Pièce d'identité expirée le ${formatDate(input.idExpiry)}.`);
  }
  return issues;
}

/** Vrai si au moins une des catégories déclarées convient au véhicule. */
export function categoriesMatchVehicle(vehicleType: DeliveryVehicleType, categories: LicenseCategory[]): boolean {
  const requirement = VEHICLE_LICENSE_REQUIREMENTS[vehicleType] ?? VEHICLE_LICENSE_REQUIREMENTS.other;
  return categories.some((c) => requirement.required_categories.includes(c));
}
