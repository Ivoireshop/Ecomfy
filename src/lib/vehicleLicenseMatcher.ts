/**
 * Vehicle & Driver License Category Matcher for Ecomfy Livraison
 * Validates that driver's license category matches the declared delivery vehicle.
 */

import { DeliveryVehicleType, LicenseCategory } from "@/types/delivery";

export interface VehicleLicenseRequirement {
  vehicle_type: DeliveryVehicleType;
  label: string;
  required_categories: LicenseCategory[];
  description: string;
}

export const VEHICLE_LICENSE_REQUIREMENTS: Record<DeliveryVehicleType, VehicleLicenseRequirement> = {
  motorcycle: {
    vehicle_type: 'motorcycle',
    label: 'Moto / Scooter',
    required_categories: ['A'],
    description: 'Catégorie A obligatoire pour conduire les véhicules à deux roues motorisés.'
  },
  tricycle: {
    vehicle_type: 'tricycle',
    label: 'Tricycle Motorisé',
    required_categories: ['A'],
    description: 'Catégorie A obligatoire pour la conduite des tricycles à moteur.'
  },
  car: {
    vehicle_type: 'car',
    label: 'Voiture / Véhicule Léger',
    required_categories: ['B'],
    description: 'Catégorie B obligatoire pour les voitures et véhicules légers de livraison.'
  },
  van: {
    vehicle_type: 'van',
    label: 'Camionnette / Van',
    required_categories: ['B', 'C'],
    description: 'Catégorie B ou C obligatoire pour les camionnettes et fourgons de transport.'
  },
  other: {
    vehicle_type: 'other',
    label: 'Autre Véhicule Autorisé',
    required_categories: ['A', 'B'],
    description: 'Permis de conduire officiel Catégorie A ou B requis.'
  }
};

export interface VehicleLicenseCheckResult {
  passed: boolean;
  vehicle_type: DeliveryVehicleType;
  required_categories: LicenseCategory[];
  detected_categories: LicenseCategory[];
  rejection_reason?: string;
}

/**
 * Validates whether the driver's license categories conform to the declared vehicle requirements
 */
export function validateVehicleLicenseCategory(
  vehicleType: DeliveryVehicleType = 'motorcycle',
  detectedCategories: LicenseCategory[] = ['A', 'B']
): VehicleLicenseCheckResult {
  const requirement = VEHICLE_LICENSE_REQUIREMENTS[vehicleType] || VEHICLE_LICENSE_REQUIREMENTS.motorcycle;
  
  const hasMatchingCategory = requirement.required_categories.some(cat => 
    detectedCategories.includes(cat)
  );

  if (!hasMatchingCategory) {
    const requiredStr = requirement.required_categories.join(' ou Catégorie ');
    return {
      passed: false,
      vehicle_type: vehicleType,
      required_categories: requirement.required_categories,
      detected_categories: detectedCategories,
      rejection_reason: `Permis non conforme : Le permis fourni ne comporte pas la Catégorie ${requiredStr} requise pour le véhicule déclaré (${requirement.label}).`
    };
  }

  return {
    passed: true,
    vehicle_type: vehicleType,
    required_categories: requirement.required_categories,
    detected_categories: detectedCategories
  };
}
