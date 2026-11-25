import { describe, expect, it } from "vitest";
import { isTestEnvironment, withTestPrefix } from "./testEnvBanner";

describe("isTestEnvironment", () => {
  it("active le bandeau sur le build du VPS de test", () => {
    expect(isTestEnvironment("vps")).toBe(true);
  });

  it("l'active aussi avec VITE_APP_ENV=test", () => {
    expect(isTestEnvironment("development", "test")).toBe(true);
    expect(isTestEnvironment("production", " TEST ")).toBe(true);
  });

  it("le laisse absent en production et en développement sans réglage", () => {
    expect(isTestEnvironment("production")).toBe(false);
    expect(isTestEnvironment("production", "")).toBe(false);
    expect(isTestEnvironment("production", "production")).toBe(false);
    expect(isTestEnvironment("development")).toBe(false);
  });
});

describe("withTestPrefix", () => {
  it("préfixe le titre une seule fois", () => {
    expect(withTestPrefix("Ecomfy")).toBe("[TEST] Ecomfy");
    expect(withTestPrefix("[TEST] Ecomfy")).toBe("[TEST] Ecomfy");
  });
});
