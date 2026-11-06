import { describe, expect, it } from "vitest";
import { categoriesMatchVehicle, getDriverLicenseIssues } from "./vehicleLicenseMatcher";

const TODAY = "2026-11-06";
const FUTURE = "2027-06-01";

describe("règle permis ↔ véhicule (miroir de delivery_driver_issues)", () => {
  it.each([
    ["motorcycle", ["A"], 0],
    ["motorcycle", ["B"], 1],
    ["motorcycle", ["A", "B"], 0],
    ["tricycle", ["A"], 0],
    ["tricycle", ["B"], 1],
    ["car", ["B"], 0],
    ["car", ["A"], 1],
    ["van", ["C"], 0],
    ["van", ["B"], 0],
    ["van", ["A"], 1],
    ["other", ["B"], 0],
    ["other", ["A"], 0],
    ["other", ["C"], 1],
  ] as const)("%s avec %j : %i anomalie(s)", (vehicleType, categories, expected) => {
    const issues = getDriverLicenseIssues({ vehicleType, categories: [...categories], licenseExpiry: FUTURE }, TODAY);
    expect(issues).toHaveLength(expected);
  });

  it("n'invente jamais de catégorie : aucune déclarée = anomalie", () => {
    expect(getDriverLicenseIssues({ vehicleType: "motorcycle", categories: [], licenseExpiry: FUTURE }, TODAY)).toEqual([
      "Aucune catégorie de permis déclarée.",
    ]);
  });

  it("refuse un permis expiré, sans date, ou une pièce d'identité expirée", () => {
    expect(getDriverLicenseIssues({ vehicleType: "car", categories: ["B"], licenseExpiry: "2026-11-05" }, TODAY)).toEqual([
      "Permis expiré le 05/11/2026.",
    ]);
    expect(getDriverLicenseIssues({ vehicleType: "car", categories: ["B"], licenseExpiry: null }, TODAY)).toEqual([
      "Date d'expiration du permis non renseignée.",
    ]);
    expect(
      getDriverLicenseIssues({ vehicleType: "car", categories: ["B"], licenseExpiry: FUTURE, idExpiry: "2026-01-01" }, TODAY),
    ).toEqual(["Pièce d'identité expirée le 01/01/2026."]);
  });

  it("accepte un permis qui expire aujourd'hui (même règle que la base : < current_date)", () => {
    expect(getDriverLicenseIssues({ vehicleType: "car", categories: ["B"], licenseExpiry: TODAY }, TODAY)).toEqual([]);
  });

  it("produit le message exact de la base pour une catégorie incompatible", () => {
    expect(getDriverLicenseIssues({ vehicleType: "motorcycle", categories: ["B"], licenseExpiry: FUTURE }, TODAY)).toEqual([
      "Permis non conforme : catégorie A requise pour Moto / Scooter (déclaré : B).",
    ]);
    expect(getDriverLicenseIssues({ vehicleType: "van", categories: ["A"], licenseExpiry: FUTURE }, TODAY)).toEqual([
      "Permis non conforme : catégorie B ou C requise pour Camionnette / Van (déclaré : A).",
    ]);
  });

  it("categoriesMatchVehicle", () => {
    expect(categoriesMatchVehicle("motorcycle", ["B"])).toBe(false);
    expect(categoriesMatchVehicle("motorcycle", ["B", "A"])).toBe(true);
  });
});
