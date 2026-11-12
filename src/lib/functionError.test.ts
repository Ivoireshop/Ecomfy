import { describe, expect, it } from "vitest";
import { messageForStatus, readFunctionError } from "./functionError";

const httpError = (status: number, body?: unknown) => ({
  message: "Edge Function returned a non-2xx status code",
  context: new Response(body === undefined ? null : JSON.stringify(body), { status }),
});

describe("readFunctionError", () => {
  it("lit le message du corps d'une réponse 4xx", async () => {
    const msg = await readFunctionError(httpError(403, { success: false, error: "Accès refusé" }), null, "x");
    expect(msg).toBe("Accès refusé");
  });

  it("reste compatible avec une ancienne réponse 200 + success:false", async () => {
    expect(await readFunctionError(null, { success: false, error: "Code promo invalide" }, "x")).toBe("Code promo invalide");
  });

  it("sans corps exploitable : message par code HTTP, jamais le texte technique", async () => {
    const msg = await readFunctionError(httpError(401), null, "x");
    expect(msg).toBe(messageForStatus(401, "x"));
    expect(msg).not.toMatch(/non-2xx/);
  });

  it("corps non JSON : message par code, puis repli", async () => {
    const err = { context: new Response("<html>Bad gateway</html>", { status: 502 }) };
    expect(await readFunctionError(err, null, "Réessayez.")).toBe("Réessayez.");
    expect(await readFunctionError({ context: new Response("oops", { status: 429 }) }, null, "x")).toMatch(/Trop de tentatives/);
  });

  it("erreur réseau sans réponse : repli", async () => {
    expect(await readFunctionError(new Error("Failed to fetch"), null, "Impossible de joindre le serveur.")).toBe(
      "Impossible de joindre le serveur.",
    );
  });

  it("ne consomme pas le corps (clone)", async () => {
    const err = httpError(400, { error: "Montant invalide" });
    await readFunctionError(err, null, "x");
    expect(await err.context.json()).toEqual({ error: "Montant invalide" });
  });
});
