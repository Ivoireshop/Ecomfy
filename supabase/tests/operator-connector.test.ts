// Tests de l'interface commune des connecteurs opérateurs (_shared/operators) avec le connecteur GeniusPay et un fetch simulé.
// Exécution (Node >= 22.6, aucun accès réseau requis) :
//   npx vitest run supabase/tests/operator-connector.test.ts
import { test } from "vitest";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { GeniusPayConnector, mapGeniusPayStatus } from "../functions/_shared/operators/geniuspay.ts";
import type { OperatorConnector } from "../functions/_shared/operators/types.ts";

const NOW = 1_800_000_000;
type Call = { url: string; init: RequestInit };

function make(respond: (call: Call) => Response | Promise<Response>, over: Partial<ConstructorParameters<typeof GeniusPayConnector>[0]> = {}) {
  const calls: Call[] = [];
  const connector = new GeniusPayConnector({
    apiUrl: "https://op.test/api",
    apiKey: "k",
    apiSecret: "s",
    webhookSecret: "whsec",
    nowSeconds: () => NOW,
    fetch: (async (url: string, init: RequestInit) => {
      const call = { url, init };
      calls.push(call);
      return respond(call);
    }) as unknown as typeof fetch,
    ...over,
  });
  return { connector, calls };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const headers = (h: Record<string, string> = {}) => new Headers(h);

const payReq = {
  internalReference: "ECM-PAY-ABC", paymentId: "p1", merchantId: "m1", shopId: "s1", amount: 5000, currency: "XOF",
  paymentMethod: "wave", description: "Paiement", customer: { name: null, phone: "0700000000" },
  successUrl: "https://x/ok", errorUrl: "https://x/ko",
};

test("isConfigured : faux sans identifiants API", () => {
  assert.equal(make(() => json({})).connector.isConfigured(), true);
  assert.equal(make(() => json({}), { apiKey: undefined }).connector.isConfigured(), false);
  assert.equal(make(() => json({}), { apiSecret: undefined }).connector.isConfigured(), false);
});

test("initiatePayment : page de paiement et référence de l'opérateur", async () => {
  const { connector, calls } = make(() => json({ data: { checkout_url: "https://pay/1", reference: "R1" } }));
  const r = await connector.initiatePayment(payReq);
  assert.deepEqual(r, { ok: true, checkoutUrl: "https://pay/1", providerReference: "R1" });
  assert.equal(calls[0].url, "https://op.test/api/payments");
  const sent = JSON.parse(String(calls[0].init.body));
  assert.equal(sent.customer.name, "Client");
  assert.equal(sent.metadata.internal_reference, "ECM-PAY-ABC");
  assert.equal((calls[0].init.headers as Record<string, string>)["X-API-Key"], "k");
});

test("initiatePayment : réponse à plat acceptée, sans référence", async () => {
  const { connector } = make(() => json({ checkout_url: "https://pay/2" }));
  assert.deepEqual(await connector.initiatePayment(payReq), { ok: true, checkoutUrl: "https://pay/2" });
});

test("initiatePayment : sans lien, 4xx, 5xx ou réseau → ok:false, sans exception", async () => {
  const noUrl = await make(() => json({ data: {} })).connector.initiatePayment(payReq);
  assert.equal(noUrl.ok, false);
  const refused = await make(() => json({ message: "montant invalide" }, 422)).connector.initiatePayment(payReq);
  assert.deepEqual(refused, { ok: false, httpStatus: 422, reason: "montant invalide" });
  const down = await make(() => { throw new Error("ECONNRESET"); }).connector.initiatePayment(payReq);
  assert.equal(down.ok, false);
});

test("fetchPayment : statut normalisé, montant et devise", async () => {
  const { connector, calls } = make(() => json({ data: { status: "completed", amount: 5000, currency: "XOF" } }));
  assert.deepEqual(await connector.fetchPayment("PAY/1"), { kind: "ok", status: "SUCCEEDED", amount: 5000, currency: "XOF" });
  assert.equal(calls[0].url, "https://op.test/api/payments/PAY%2F1");
});

test("fetchPayment : montant absent → null ; statut inconnu → UNKNOWN (jamais un succès)", async () => {
  const noAmount = await make(() => json({ data: { status: "paid", amount: "" } })).connector.fetchPayment("r");
  assert.deepEqual(noAmount, { kind: "ok", status: "SUCCEEDED", amount: null, currency: null });
  const odd = await make(() => json({ data: { status: "???", amount: 1 } })).connector.fetchPayment("r");
  assert.equal(odd.kind === "ok" && odd.status, "UNKNOWN");
});

test("fetchPayment : erreur HTTP ou réseau → unavailable", async () => {
  assert.deepEqual(await make(() => json({}, 502)).connector.fetchPayment("r"), { kind: "unavailable", httpStatus: 502 });
  assert.deepEqual(await make(() => { throw new Error("x"); }).connector.fetchPayment("r"), { kind: "unavailable" });
});

test("mapGeniusPayStatus", () => {
  for (const [raw, want] of [["completed", "SUCCEEDED"], ["PAID", "SUCCEEDED"], ["pending", "PENDING"], ["expired", "FAILED"], ["cancelled", "FAILED"], [undefined, "UNKNOWN"]] as const) {
    assert.equal(mapGeniusPayStatus(raw), want);
  }
});

const payoutReq = { withdrawalReference: "WD-1", amount: 3000, currency: "XOF", method: "mobile_money", phone: "0700000000", name: "A", operator: "wave" as const };

test("initiatePayout : ACCEPTED / REJECTED (4xx) / UNKNOWN (5xx, réseau, 2xx ambigu)", async () => {
  const { connector, calls } = make(() => json({ success: true, data: { reference: "PO-1" } }));
  assert.deepEqual(await connector.initiatePayout(payoutReq), { outcome: "ACCEPTED", providerReference: "PO-1" });
  assert.deepEqual(JSON.parse(String(calls[0].init.body)).destination, { type: "mobile_money", phone: "0700000000", name: "A", operator: "wave" });

  assert.deepEqual(await make(() => json({ message: "numéro invalide" }, 422)).connector.initiatePayout(payoutReq),
    { outcome: "REJECTED", httpStatus: 422, reason: "numéro invalide" });
  assert.deepEqual(await make(() => json({}, 400)).connector.initiatePayout(payoutReq),
    { outcome: "REJECTED", httpStatus: 400, reason: "Refusé par le prestataire (HTTP 400)" });
  assert.deepEqual(await make(() => json({}, 503)).connector.initiatePayout(payoutReq), { outcome: "UNKNOWN", httpStatus: 503 });
  assert.deepEqual(await make(() => json({ success: false }, 200)).connector.initiatePayout(payoutReq), { outcome: "UNKNOWN", httpStatus: 200 });
  assert.deepEqual(await make(() => { throw new Error("x"); }).connector.initiatePayout(payoutReq), { outcome: "UNKNOWN" });
});

const sign = (body: string, ts = String(NOW), secret = "whsec") => createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");

test("verifyWebhook : valide, absente (401), fausse (401), secret non configuré (500)", async () => {
  const { connector } = make(() => json({}));
  const body = '{"event":"payment.success"}';
  assert.deepEqual(await connector.verifyWebhook(body, headers({ "x-webhook-signature": sign(body), "x-webhook-timestamp": String(NOW) })), { ok: true });
  assert.deepEqual(await connector.verifyWebhook(body, headers()), { ok: false, status: 401, reason: "missing_headers" });
  assert.deepEqual(await connector.verifyWebhook(body, headers({ "x-webhook-signature": sign(body, String(NOW), "autre"), "x-webhook-timestamp": String(NOW) })),
    { ok: false, status: 401, reason: "invalid_signature" });
  const noSecret = make(() => json({}), { webhookSecret: undefined }).connector;
  assert.deepEqual(await noSecret.verifyWebhook(body, headers()), { ok: false, status: 500, reason: "Webhook secret not configured" });
});

const parse = (c: OperatorConnector, payload: unknown, h: Record<string, string> = {}) => c.parseWebhook(typeof payload === "string" ? payload : JSON.stringify(payload), headers(h));

test("parseWebhook : paiement réussi, échoué, intermédiaire", () => {
  const { connector } = make(() => json({}));
  const ok = parse(connector, { event: "payment.success", data: { reference: "R1", metadata: { internal_reference: "ECM-PAY-1" } } }, { "x-webhook-delivery": "d1" });
  assert.deepEqual(ok, { kind: "payment", outcome: "SUCCEEDED", eventType: "payment.success", eventId: "d1", internalReference: "ECM-PAY-1", providerReference: "R1", failureReason: null });

  const ko = parse(connector, { event: "payment.failed", data: { reference: "R1", message: "solde insuffisant" } });
  assert.equal(ko.kind === "payment" && ko.outcome, "FAILED");
  assert.equal(ko.kind === "payment" && ko.failureReason, "solde insuffisant");
  assert.equal(ko.kind === "payment" && ko.eventId, "R1_payment.failed");

  assert.deepEqual(parse(connector, { event: "payment.created", data: { reference: "R1", status: "pending" } }), { kind: "ignored", eventType: "payment.created" });
});

test("parseWebhook : statut « completed » sans nom d'événement parlant = succès", () => {
  const { connector } = make(() => json({}));
  const r = parse(connector, { event: "payment.updated", data: { reference: "R1", status: "completed" } });
  assert.equal(r.kind === "payment" && r.outcome, "SUCCEEDED");
});

test("parseWebhook : retraits (jamais traités comme des paiements)", () => {
  const { connector } = make(() => json({}));
  const ok = parse(connector, { event: "payout.completed", data: { id: "PO-1", reference: "WD-1", metadata: { withdrawal_reference: "WD-1" } } });
  assert.deepEqual(ok, { kind: "payout", outcome: "SUCCEEDED", eventType: "payout.completed", eventId: "WD-1_payout.completed", withdrawalCandidates: ["WD-1", "WD-1", "PO-1"], providerReference: "PO-1", failureReason: null });

  const ko = parse(connector, { event: "withdrawal.failed", data: { id: "PO-2", failure_reason: "numéro invalide" } });
  assert.equal(ko.kind === "payout" && ko.outcome, "FAILED");
  assert.equal(ko.kind === "payout" && ko.failureReason, "numéro invalide");

  assert.deepEqual(parse(connector, { event: "payout.processing", data: { id: "PO-3", status: "processing" } }), { kind: "ignored", eventType: "payout.processing" });
  assert.equal(parse(connector, { event: "transfer.success", data: { status: "success", reference: "WD-9" } }).kind, "payout");
});

test("parseWebhook : JSON invalide (400) et référence absente", () => {
  const { connector } = make(() => json({}));
  assert.deepEqual(parse(connector, "pas du json"), { kind: "invalid", error: "Invalid JSON", status: 400 });
  assert.deepEqual(parse(connector, { event: "payment.success", data: {} }), { kind: "invalid", error: "Missing transaction reference" });
});
