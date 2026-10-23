// Tests du correctif C5 : signature HMAC du webhook ecomfy-pay-webhook (_shared/webhookSignature.ts).
// Exécution (Node >= 22.6, aucun accès réseau requis) :
//   node --experimental-strip-types --test supabase/tests/webhook-signature.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { computeSignature, timingSafeEqual, verifyWebhookSignature } from "../functions/_shared/webhookSignature.ts";

const secret = "whsec_test_secret";
const now = 1_800_000_000;
const body = JSON.stringify({ event: "payment.success", data: { reference: "PAY-1", metadata: { internal_reference: "ECM-PAY-ABCD" } } });
const sign = (ts: string, b = body, s = secret) => createHmac("sha256", s).update(`${ts}.${b}`).digest("hex");

test("computeSignature : identique à HMAC-SHA256 de Node", async () => {
  assert.equal(await computeSignature(secret, `${now}.${body}`), sign(String(now)));
});

test("signature valide acceptée (casse hexadécimale indifférente)", async () => {
  const ts = String(now);
  assert.deepEqual(await verifyWebhookSignature({ secret, rawBody: body, signature: sign(ts), timestamp: ts, nowSeconds: now }), { ok: true });
  assert.deepEqual(await verifyWebhookSignature({ secret, rawBody: body, signature: sign(ts).toUpperCase(), timestamp: ts, nowSeconds: now }), { ok: true });
});

test("requête sans signature ou sans horodatage refusée (le scénario d'attaque de C5)", async () => {
  for (const [signature, timestamp] of [["", ""], ["", String(now)], [sign(String(now)), ""]]) {
    const r = await verifyWebhookSignature({ secret, rawBody: body, signature, timestamp, nowSeconds: now });
    assert.deepEqual(r, { ok: false, reason: "missing_headers" });
  }
});

test("signature falsifiée, corps modifié ou mauvais secret refusés", async () => {
  const ts = String(now);
  const cases: [string, string][] = [
    [sign(ts, body, "autre_secret"), body],
    [sign(ts), body.replace("PAY-1", "PAY-2")],
    ["0".repeat(64), body],
    ["deadbeef", body],
    [sign(ts).slice(0, 63), body],
  ];
  for (const [signature, rawBody] of cases) {
    const r = await verifyWebhookSignature({ secret, rawBody, signature, timestamp: ts, nowSeconds: now });
    assert.deepEqual(r, { ok: false, reason: "invalid_signature" });
  }
});

test("anti-rejeu : horodatage hors fenêtre de 5 minutes ou mal formé refusé", async () => {
  for (const ts of [String(now - 301), String(now + 301), "abc", "1e9", "-5", `${now}x`, " " + now]) {
    const r = await verifyWebhookSignature({ secret, rawBody: body, signature: sign(ts), timestamp: ts, nowSeconds: now });
    assert.deepEqual(r, { ok: false, reason: "timestamp_out_of_range" }, ts);
  }
  const edge = String(now - 300);
  assert.deepEqual(await verifyWebhookSignature({ secret, rawBody: body, signature: sign(edge), timestamp: edge, nowSeconds: now }), { ok: true });
});

test("timingSafeEqual", () => {
  assert.equal(timingSafeEqual("abc", "abc"), true);
  assert.equal(timingSafeEqual("abc", "abd"), false);
  assert.equal(timingSafeEqual("abc", "abcd"), false);
});

test("ecomfy-pay-webhook : la signature est vérifiée avant tout accès à la base", () => {
  const src = readFileSync(new URL("../functions/ecomfy-pay-webhook/index.ts", import.meta.url), "utf8");
  // La vérification passe par l'interface commune des connecteurs (_shared/operators) ; GeniusPay la fait via verifyWebhookSignature.
  const iVerify = src.indexOf("connector.verifyWebhook(");
  assert.ok(iVerify > 0, "connector.verifyWebhook non appelé");
  assert.ok(src.indexOf("createClient(supabaseUrl") > iVerify, "createClient avant la vérification");
  assert.ok(src.indexOf('.from("payment_events")') > iVerify, "écriture en base avant la vérification");
  assert.ok(src.indexOf("parseWebhook(") > iVerify, "contenu lu avant la vérification");
  assert.doesNotMatch(src, /await req\.json\(\)/, "le corps doit être lu en texte brut pour la signature");
  const gp = readFileSync(new URL("../functions/_shared/operators/geniuspay.ts", import.meta.url), "utf8");
  assert.match(gp, /verifyWebhookSignature\(\{/, "le connecteur GeniusPay doit vérifier la signature HMAC");
  const reg = readFileSync(new URL("../functions/_shared/operators/index.ts", import.meta.url), "utf8");
  assert.match(reg, /GENIUSPAY_WEBHOOK_SECRET/);
});
