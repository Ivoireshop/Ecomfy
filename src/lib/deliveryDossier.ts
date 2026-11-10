import type { DeliveryCompany, DeliveryDriver, DeliveryVerificationStatus } from "@/types/delivery";

// Règles documentaires d'un dossier Ecomfy Livraison, lues côté interface. La base applique les mêmes règles
// (migration 20261109110000) : ici elles servent à dire au candidat ce qui manque et à l'administrateur quoi demander.

export interface DossierGap {
  key: "id_back" | "location" | "driver_id_back" | "driver_license_back";
  label: string;
  /** Livreur concerné (anomalies propres à un livreur). */
  driverId?: string;
}

/** Une pièce d'identité autre qu'un passeport a deux faces. Un type inconnu est traité comme une CNI. */
export const idNeedsBackSide = (idType?: string | null): boolean => (idType ?? "cni") !== "passport";

/** Éléments manquants du dossier d'une structure (responsable et entrepôt). */
export function companyDossierGaps(company: DeliveryCompany): DossierGap[] {
  const gaps: DossierGap[] = [];
  if (idNeedsBackSide(company.kyc?.id_type) && !company.manager_id_back_photo_url) {
    gaps.push({ key: "id_back", label: "Verso de la pièce d'identité du responsable" });
  }
  if (company.profile_type === "manager" && !company.location) {
    gaps.push({ key: "location", label: "Localisation de l'entrepôt" });
  }
  return gaps;
}

/** Éléments manquants du dossier d'un livreur. */
export function driverDossierGaps(driver: DeliveryDriver): DossierGap[] {
  const gaps: DossierGap[] = [];
  if (idNeedsBackSide(driver.id_type) && !driver.national_id_back_photo_url) {
    gaps.push({ key: "driver_id_back", label: `${driver.full_name} : verso de la pièce d'identité`, driverId: driver.id });
  }
  if (!driver.license_back_photo_url) {
    gaps.push({ key: "driver_license_back", label: `${driver.full_name} : verso du permis`, driverId: driver.id });
  }
  return gaps;
}

/** Tout ce qui manque au dossier : structure et livreurs. */
export function allDossierGaps(company: DeliveryCompany): DossierGap[] {
  return [...companyDossierGaps(company), ...(company.drivers ?? []).flatMap(driverDossierGaps)];
}

/** Message prêt à envoyer au candidat pour réclamer les éléments manquants (champ « complément demandé »). */
export function missingItemsMessage(gaps: DossierGap[]): string {
  if (gaps.length === 0) return "";
  const lines = gaps.map((g) => `- ${g.label}`).join("\n");
  return `Pour valider votre dossier, merci d'ajouter :\n${lines}\nVous pouvez le faire depuis « Corriger mon dossier ».`;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Point exploitable : dans les limites du globe et différent du point (0, 0) que renvoient les GPS défaillants. */
export function isValidCoordinates(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" && typeof lng === "number" &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

export function formatCoordinates({ latitude, longitude }: Coordinates): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

/** Lien d'itinéraire/ouverture dans Google Maps pour se rendre sur place. */
export function mapsUrl({ latitude, longitude }: Coordinates): string {
  return `https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

export interface StatusStep {
  key: "received" | "review" | "decision";
  label: string;
  state: "done" | "current" | "todo" | "blocked";
}

/** Étapes affichées au candidat : reçu → en analyse → décision. */
export function statusSteps(status: DeliveryVerificationStatus): StatusStep[] {
  const decided = status === "approved" || status === "rejected" || status === "suspended";
  const needsAction = status === "action_required";
  return [
    { key: "received", label: "Dossier reçu", state: "done" },
    {
      key: "review",
      label: "Examen par l'équipe",
      state: needsAction || decided ? "done" : "current",
    },
    {
      key: "decision",
      label:
        status === "approved" ? "Approuvé"
        : status === "rejected" ? "Refusé"
        : status === "suspended" ? "Suspendu"
        : needsAction ? "Complément à fournir"
        : "Décision",
      state: decided ? (status === "approved" ? "done" : "blocked") : needsAction ? "current" : "todo",
    },
  ];
}
