import { describe, expect, it } from "vitest";
import {
  allDossierGaps,
  companyDossierGaps,
  driverDossierGaps,
  idNeedsBackSide,
  isValidCoordinates,
  mapsUrl,
  missingItemsMessage,
  statusSteps,
} from "./deliveryDossier";
import type { DeliveryCompany, DeliveryDriver } from "@/types/delivery";

const company = (over: Partial<DeliveryCompany> = {}): DeliveryCompany =>
  ({
    id: "c1",
    profile_type: "manager",
    company_name: "Express",
    manager_id_back_photo_url: "u/back.jpg",
    kyc: { company_id: "c1", id_type: "cni", id_number: "CI0001", date_of_birth: "1990-01-01" },
    location: { company_id: "c1", latitude: 5.33, longitude: -4.02, source: "gps" },
    drivers: [],
    ...over,
  }) as unknown as DeliveryCompany;

const driver = (over: Partial<DeliveryDriver> = {}): DeliveryDriver =>
  ({
    id: "d1",
    full_name: "Koffi Yao",
    id_type: "cni",
    national_id_back_photo_url: "u/id_back.jpg",
    license_back_photo_url: "u/lic_back.jpg",
    ...over,
  }) as unknown as DeliveryDriver;

describe("idNeedsBackSide", () => {
  it("exige un verso sauf pour un passeport, et traite l'inconnu comme une CNI", () => {
    expect(idNeedsBackSide("cni")).toBe(true);
    expect(idNeedsBackSide(undefined)).toBe(true);
    expect(idNeedsBackSide(null)).toBe(true);
    expect(idNeedsBackSide("passport")).toBe(false);
  });
});

describe("companyDossierGaps", () => {
  it("ne signale rien pour un dossier complet", () => {
    expect(companyDossierGaps(company())).toEqual([]);
  });

  it("signale le verso manquant d'une CNI et la localisation manquante d'une société", () => {
    const gaps = companyDossierGaps(company({ manager_id_back_photo_url: null, location: null }));
    expect(gaps.map((g) => g.key)).toEqual(["id_back", "location"]);
  });

  it("n'exige pas de verso pour un passeport", () => {
    const c = company({ manager_id_back_photo_url: null, kyc: { company_id: "c1", id_type: "passport", id_number: "PP1234", date_of_birth: "1990-01-01" } });
    expect(companyDossierGaps(c)).toEqual([]);
  });

  it("n'exige pas de localisation d'entrepôt d'un livreur indépendant", () => {
    expect(companyDossierGaps(company({ profile_type: "driver", location: null }))).toEqual([]);
  });
});

describe("driverDossierGaps", () => {
  it("signale les deux versos manquants d'un livreur ancien", () => {
    const gaps = driverDossierGaps(driver({ national_id_back_photo_url: null, license_back_photo_url: null }));
    expect(gaps.map((g) => g.key)).toEqual(["driver_id_back", "driver_license_back"]);
    expect(gaps[0].driverId).toBe("d1");
  });

  it("livreur à passeport : seul le verso du permis est exigé", () => {
    const gaps = driverDossierGaps(driver({ id_type: "passport", national_id_back_photo_url: null, license_back_photo_url: null }));
    expect(gaps.map((g) => g.key)).toEqual(["driver_license_back"]);
  });
});

describe("allDossierGaps et message au candidat", () => {
  it("regroupe structure et livreurs et rédige la demande", () => {
    const c = company({ manager_id_back_photo_url: null, drivers: [driver({ license_back_photo_url: null })] });
    const gaps = allDossierGaps(c);
    expect(gaps).toHaveLength(2);
    const msg = missingItemsMessage(gaps);
    expect(msg).toContain("Verso de la pièce d'identité du responsable");
    expect(msg).toContain("Koffi Yao : verso du permis");
    expect(missingItemsMessage([])).toBe("");
  });
});

describe("coordonnées", () => {
  it("accepte un point d'Abidjan", () => {
    expect(isValidCoordinates(5.3364, -4.0267)).toBe(true);
  });

  it("refuse les valeurs hors limites, non numériques et le point (0, 0)", () => {
    expect(isValidCoordinates(95, 0)).toBe(false);
    expect(isValidCoordinates(0, 181)).toBe(false);
    expect(isValidCoordinates(0, 0)).toBe(false);
    expect(isValidCoordinates(Number.NaN, 3)).toBe(false);
    expect(isValidCoordinates("5.3", "-4")).toBe(false);
    expect(isValidCoordinates(null, null)).toBe(false);
  });

  it("construit un lien Google Maps", () => {
    expect(mapsUrl({ latitude: 5.3364, longitude: -4.0267 })).toBe("https://www.google.com/maps?q=5.336400,-4.026700");
  });
});

describe("statusSteps", () => {
  it("dossier en attente : examen en cours", () => {
    expect(statusSteps("pending_verification").map((s) => s.state)).toEqual(["done", "current", "todo"]);
  });

  it("complément demandé : le candidat doit agir", () => {
    const steps = statusSteps("action_required");
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "current"]);
    expect(steps[2].label).toBe("Complément à fournir");
  });

  it("approuvé : tout est fait ; refusé : décision bloquante", () => {
    expect(statusSteps("approved").map((s) => s.state)).toEqual(["done", "done", "done"]);
    expect(statusSteps("rejected").map((s) => s.state)).toEqual(["done", "done", "blocked"]);
  });
});
