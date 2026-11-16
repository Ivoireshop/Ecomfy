// Tests de l'API Ecomfy Pay : validation, signature des webhooks sortants, garde SSRF, envoi et routeur (doublures de base et d'opérateur).
// Le comportement de la base (idempotence, isolation du sandbox, événements, livraisons) est testé dans supabase/tests/pay_api.sql.
// Exécution : npx vitest run supabase/tests/pay-api.test.ts
import { describe, expect, test, vi } from "vitest";
import {
  canonicalJson, validateCreatePayment, validateIdempotencyKey, validateReturnUrl, validateScenario,
} from "../functions/_shared/pay-api/validate.ts";
import {
  checkWebhookUrl, deliverDue, isPrivateAddress, sendDelivery, signWebhook, verifyWebhookSignature, type ClaimedDelivery,
} from "../functions/_shared/pay-api/webhook-out.ts";
import { createApiHandler, routeOf, type ApiDb, type HandlerDeps } from "../functions/_shared/pay-api/handler.ts";
import type { InitiatePaymentRequest, InitiatePaymentResult, OperatorConnector } from "../functions/_shared/operators/types.ts";

const base = {
  amount: 5000, payment_method: "wave", success_url: "https://shop.example.com/merci",
};

describe("validateCreatePayment", () => {
  test("accepte le minimum et normalise", () => {
    const r = validateCreatePayment({ ...base, customer: { phone: "+225 07 00 00 00 01", name: " Awa " }, metadata: { order: "42" } }, true);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.customer).toEqual({ name: "Awa", phone: "+2250700000001" });
      expect(r.value.currency).toBe("XOF");
      expect(r.value.success_url).toBe("https://shop.example.com/merci");
    }
  });

  test.each([
    [{ ...base, amount: 5000.5 }, "amount"],
    [{ ...base, amount: "5000" }, "amount"],
    [{ ...base, amount: 199 }, "amount"],
    [{ ...base, amount: 10_000_001 }, "amount"],
    [{ ...base, currency: "EUR" }, "currency"],
    [{ ...base, payment_method: "paypal" }, "payment_method"],
    [{ amount: 5000, payment_method: "wave" }, "success_url"],
    [{ ...base, ammount: 1 }, "ammount"],
    [{ ...base, customer: { phone: "12" } }, "customer.phone"],
    [{ ...base, customer: { email: "pas-un-mail" } }, "customer.email"],
    [{ ...base, customer: { age: 3 } }, "customer.age"],
    [{ ...base, metadata: { a: 1 } }, "metadata.a"],
    [{ ...base, client_reference: "" }, "client_reference"],
    [{ ...base, description: "x".repeat(201) }, "description"],
    [[], "body"],
  ])("refuse %j", (body, param) => {
    const r = validateCreatePayment(body, true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.param).toBe(param);
  });

  test("21 clés de metadata refusées", () => {
    const metadata = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, "v"]));
    const r = validateCreatePayment({ ...base, metadata }, false);
    expect(r.ok).toBe(false);
  });

  test("URL de retour : https en production, http://localhost seulement en test", () => {
    expect(validateReturnUrl("http://localhost:3000/ok", false, "success_url").ok).toBe(true);
    expect(validateReturnUrl("http://localhost:3000/ok", true, "success_url").ok).toBe(false);
    expect(validateReturnUrl("http://shop.example.com/ok", false, "success_url").ok).toBe(false);
    expect(validateReturnUrl("https://u:p@shop.example.com/ok", false, "success_url").ok).toBe(false);
    expect(validateReturnUrl("javascript:alert(1)", false, "success_url").ok).toBe(false);
  });
});

describe("outils", () => {
  test("canonicalJson ne dépend pas de l'ordre des clés", () => {
    expect(canonicalJson({ a: 1, b: { d: [1, { y: 1, x: 2 }], c: 3 } })).toBe(canonicalJson({ b: { c: 3, d: [1, { x: 2, y: 1 }] }, a: 1 }));
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 2 }));
  });
  test("Idempotency-Key", () => {
    expect(validateIdempotencyKey(null)).toEqual({ ok: true, value: null });
    expect(validateIdempotencyKey("cmd-42").ok).toBe(true);
    expect(validateIdempotencyKey("a b").ok).toBe(false);
    expect(validateIdempotencyKey("x".repeat(256)).ok).toBe(false);
  });
  test("scénarios", () => {
    expect(validateScenario({ scenario: "success" }).ok).toBe(true);
    expect(validateScenario({ scenario: "boom" }).ok).toBe(false);
    expect(validateScenario(null).ok).toBe(false);
  });
  test("routeOf retire le préfixe de la fonction", () => {
    expect(routeOf("/ecomfy-pay-api/v1/payments")).toBe("/v1/payments");
    expect(routeOf("/functions/v1/ecomfy-pay-api/v1/payments/")).toBe("/v1/payments");
    expect(routeOf("/ecomfy-pay-api")).toBe("");
  });
});

describe("signature des webhooks sortants", () => {
  const body = '{"id":"evt_1","type":"payment.succeeded"}';
  test("aller-retour valide", async () => {
    const h = await signWebhook("whsec_x", 1_800_000_000, body);
    expect(h).toMatch(/^t=1800000000,v1=[0-9a-f]{64}$/);
    expect(await verifyWebhookSignature("whsec_x", h, body, 1_800_000_100)).toEqual({ ok: true });
  });
  test("refuse mauvais secret, corps modifié, horodatage ancien, en-tête absent ou illisible", async () => {
    const h = await signWebhook("whsec_x", 1_800_000_000, body);
    expect(await verifyWebhookSignature("whsec_y", h, body, 1_800_000_000)).toEqual({ ok: false, reason: "invalid_signature" });
    expect(await verifyWebhookSignature("whsec_x", h, body + " ", 1_800_000_000)).toEqual({ ok: false, reason: "invalid_signature" });
    expect(await verifyWebhookSignature("whsec_x", h, body, 1_800_000_301)).toEqual({ ok: false, reason: "timestamp_out_of_range" });
    expect(await verifyWebhookSignature("whsec_x", null, body, 1_800_000_000)).toEqual({ ok: false, reason: "missing" });
    expect(await verifyWebhookSignature("whsec_x", "n'importe quoi", body, 1_800_000_000)).toEqual({ ok: false, reason: "malformed" });
  });
});

describe("garde SSRF", () => {
  test.each(["http://shop.example.com/h", "https://localhost/h", "https://127.0.0.1/h", "https://10.0.0.5/h", "https://[::1]/h",
    "https://intranet/h", "https://api.internal/h", "https://u:p@shop.example.com/h", "https://169.254.169.254/latest", "pas une url"])(
    "refuse %s", (u) => { expect(checkWebhookUrl(u).ok).toBe(false); });
  test("accepte un domaine public", () => {
    expect(checkWebhookUrl("https://shop.example.com:8443/hooks/ecomfy")).toEqual({ ok: true, host: "shop.example.com" });
  });
  test.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"])(
    "adresse privée %s", (ip) => { expect(isPrivateAddress(ip)).toBe(true); });
  test.each(["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:4700::1111"])("adresse publique %s", (ip) => { expect(isPrivateAddress(ip)).toBe(false); });
});

const delivery = (over: Partial<ClaimedDelivery> = {}): ClaimedDelivery => ({
  delivery_id: "d1", attempt: 1, url: "https://shop.example.com/hook", secret: "whsec_x", event_id: "evt_1", event_type: "payment.succeeded",
  payload: { id: "evt_1", type: "payment.succeeded" }, ...over,
});

describe("sendDelivery", () => {
  test("envoie le corps signé, sans suivre les redirections", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    const res = await sendDelivery(delivery(), { db: { rpc: vi.fn() }, fetch: fetchMock as unknown as typeof fetch, nowSeconds: () => 1_800_000_000 });
    expect(res).toEqual({ status: 200 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://shop.example.com/hook");
    expect(init.redirect).toBe("manual");
    const headers = init.headers as Record<string, string>;
    expect(headers["Ecomfy-Event-Type"]).toBe("payment.succeeded");
    expect(headers["Ecomfy-Delivery-Attempt"]).toBe("1");
    expect(await verifyWebhookSignature("whsec_x", headers["Ecomfy-Signature"], init.body as string, 1_800_000_000)).toEqual({ ok: true });
  });
  test("URL interne : aucun appel réseau", async () => {
    const fetchMock = vi.fn();
    const res = await sendDelivery(delivery({ url: "https://10.0.0.1/h" }), { db: { rpc: vi.fn() }, fetch: fetchMock as unknown as typeof fetch });
    expect(res.status).toBe(0);
    expect(res.error).toMatch(/^url_refused/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test("domaine qui résout vers une adresse privée : refusé", async () => {
    const fetchMock = vi.fn();
    const res = await sendDelivery(delivery(), { db: { rpc: vi.fn() }, fetch: fetchMock as unknown as typeof fetch, resolve: async () => ["93.184.216.34", "10.0.0.9"] });
    expect(res.error).toBe("url_refused:private_address");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test("erreur réseau et délai dépassé", async () => {
    const boom = vi.fn(async () => { throw new Error("ECONNRESET"); });
    expect((await sendDelivery(delivery(), { db: { rpc: vi.fn() }, fetch: boom as unknown as typeof fetch })).error).toMatch(/^network:/);
    const slow = vi.fn((_u: string, init: RequestInit) => new Promise<Response>((_, rej) => {
      init.signal!.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })));
    }));
    expect((await sendDelivery(delivery(), { db: { rpc: vi.fn() }, fetch: slow as unknown as typeof fetch, timeoutMs: 10 })).error).toBe("timeout");
  });
});

describe("deliverDue", () => {
  test("enregistre le résultat de chaque envoi", async () => {
    const calls: Array<[string, Record<string, unknown> | undefined]> = [];
    const db: ApiDb = {
      rpc: async (name, args) => {
        calls.push([name, args]);
        if (name === "ecomfy_api_claim_deliveries") return { data: [delivery({ delivery_id: "ok" }), delivery({ delivery_id: "ko" })], error: null };
        return { data: args?.p_http_status === 200 ? "succeeded" : "retry", error: null };
      },
    };
    // première livraison 200, seconde 500
    let n = 0;
    const res = await deliverDue({ db, fetch: (async () => new Response("", { status: ++n === 1 ? 200 : 500 })) as unknown as typeof fetch });
    expect(res).toEqual({ claimed: 2, succeeded: 1, retried: 1, failed: 0 });
    const recorded = calls.filter(([name]) => name === "ecomfy_api_record_delivery");
    expect(recorded).toHaveLength(2);
    expect(recorded.map(([, a]) => a?.p_http_status).sort()).toEqual([200, 500]);
  });
  test("ne lève jamais d'exception", async () => {
    const res = await deliverDue({ db: { rpc: async () => { throw new Error("db down"); } } });
    expect(res.claimed).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Routeur
// ---------------------------------------------------------------------------------------------------------------------
const TEST_KEY = "ecm_sk_test_" + "a".repeat(64);
const LIVE_KEY = "ecm_sk_live_" + "b".repeat(64);
const PAY_TEST = "pay_test_" + "1".repeat(24);
const PAY_LIVE = "pay_live_" + "2".repeat(24);

const paymentJson = (over: Record<string, unknown> = {}) => ({
  id: PAY_TEST, object: "payment", livemode: false, status: "pending", amount: 5000, currency: "XOF", checkout_url: `https://ecomfy.cloud/sandbox/pay/${PAY_TEST}`,
  success_url: "https://shop.example.com/merci", cancel_url: null, ...over,
});

function makeHandler(opts: {
  rpcs?: Record<string, (args: Record<string, unknown>) => unknown>;
  auth?: Record<string, unknown> | null;
  connector?: Partial<OperatorConnector> & { initiate?: (r: InitiatePaymentRequest) => Promise<InitiatePaymentResult> };
  allow?: boolean;
  cron?: boolean;
} = {}) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const deliver = vi.fn(async () => ({ claimed: 0 }));
  const connector: OperatorConnector = {
    id: "geniuspay",
    isConfigured: () => true,
    initiatePayment: opts.connector?.initiate ?? (async () => ({ ok: true, checkoutUrl: "https://pay.geniuspay.test/c/1", providerReference: "GP-1" })),
    fetchPayment: async () => ({ kind: "unavailable" }),
    initiatePayout: async () => ({ outcome: "UNKNOWN" }),
    verifyWebhook: async () => ({ ok: true }),
    parseWebhook: () => ({ kind: "ignored", eventType: "x" }),
    ...(opts.connector?.isConfigured ? { isConfigured: opts.connector.isConfigured } : {}),
  };
  const auth = opts.auth === undefined
    ? { key_id: "k1", merchant_id: "m1", shop_id: "s1", livemode: false, business_name: "Ma Boutique", kyc_verified: true }
    : opts.auth;
  const db: ApiDb = {
    rpc: async (name, args = {}) => {
      calls.push({ name, args });
      if (name === "ecomfy_api_authenticate") return { data: auth, error: null };
      const f = opts.rpcs?.[name];
      if (!f) return { data: null, error: { message: `rpc inattendue ${name}` } };
      const out = f(args);
      if (out instanceof Error) return { data: null, error: { message: out.message } };
      return { data: out, error: null };
    },
  };
  const deps: HandlerDeps = {
    db, connector: () => connector, rateLimit: async () => opts.allow ?? true, checkoutBase: "https://ecomfy.cloud/sandbox/pay",
    isCron: () => opts.cron ?? false, clientIp: () => "1.2.3.4", deliver, runInBackground: (p) => { void p; }, requestId: () => "req_test", nowMinute: () => 0,
  };
  const handler = createApiHandler(deps);
  const call = (method: string, path: string, init: { key?: string | null; body?: unknown; headers?: Record<string, string> } = {}) => {
    const headers: Record<string, string> = { ...(init.headers ?? {}) };
    const key = init.key === undefined ? TEST_KEY : init.key;
    if (key) headers.authorization = `Bearer ${key}`;
    return handler(new Request(`https://x.supabase.co/functions/v1/ecomfy-pay-api${path}`, {
      method, headers, body: init.body === undefined ? undefined : (typeof init.body === "string" ? init.body : JSON.stringify(init.body)),
    }));
  };
  return { call, calls, deliver, connector };
}

const sandboxCreate = { ecomfy_api_create_payment: () => ({ ok: true, replay: false, payment: paymentJson(), live: null }) };

describe("authentification", () => {
  test("sans clé, clé mal formée, clé inconnue, clé du mauvais mode", async () => {
    const h = makeHandler({ rpcs: sandboxCreate });
    expect((await h.call("GET", "/v1/payments", { key: null })).status).toBe(401);
    const bad = await h.call("GET", "/v1/payments", { key: "sk_nope" });
    expect(bad.status).toBe(401);
    expect((await bad.json()).error.code).toBe("invalid_api_key");

    const unknown = makeHandler({ auth: null });
    const r = await unknown.call("GET", "/v1/payments");
    expect(r.status).toBe(401);
    expect(r.headers.get("www-authenticate")).toBe("Bearer");

    // Le contexte renvoyé par la base dit « live » mais la clé est « test » : refus.
    const mismatch = makeHandler({ auth: { key_id: "k", merchant_id: "m", shop_id: "s", livemode: true, business_name: null, kyc_verified: true } });
    expect((await mismatch.call("GET", "/v1/payments")).status).toBe(401);
  });

  test("seule l'empreinte de la clé part vers la base", async () => {
    const h = makeHandler({ rpcs: { ecomfy_api_list_payments: () => ({ data: [], has_more: false }) } });
    await h.call("GET", "/v1/payments");
    const a = h.calls.find((c) => c.name === "ecomfy_api_authenticate")!;
    expect(a.args.p_key_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(h.calls)).not.toContain(TEST_KEY);
  });

  test("limite de débit : 429 avec Retry-After", async () => {
    const h = makeHandler({ allow: false });
    const r = await h.call("GET", "/v1/payments");
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).toBe("60");
  });

  test("route inconnue, méthode non permise", async () => {
    const h = makeHandler();
    expect((await h.call("GET", "/v2/payments")).status).toBe(404);
    expect((await h.call("DELETE", "/v1/payments")).status).toBe(405);
  });
});

describe("POST /v1/payments (sandbox)", () => {
  test("201 et la base reçoit les champs validés", async () => {
    const h = makeHandler({ rpcs: sandboxCreate });
    const r = await h.call("POST", "/v1/payments", { body: { ...base, metadata: { o: "1" } }, headers: { "Idempotency-Key": "cmd-1" } });
    expect(r.status).toBe(201);
    expect(r.headers.get("request-id")).toBe("req_test");
    expect((await r.json()).checkout_url).toContain("/sandbox/pay/");
    const c = h.calls.find((x) => x.name === "ecomfy_api_create_payment")!;
    expect(c.args.p_key_id).toBe("k1");
    expect(c.args.p_idem_key).toBe("cmd-1");
    expect(c.args.p_request_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(c.args.p_checkout_base).toBe("https://ecomfy.cloud/sandbox/pay");
    expect(c.args.p_provider).toBeNull();
  });

  test("erreurs de validation : 400 avec le paramètre", async () => {
    const h = makeHandler({ rpcs: sandboxCreate });
    const r = await h.call("POST", "/v1/payments", { body: { ...base, amount: 50 } });
    expect(r.status).toBe(400);
    const e = (await r.json()).error;
    expect(e).toMatchObject({ type: "invalid_request_error", code: "invalid_request", param: "amount" });
    expect(h.calls.some((c) => c.name === "ecomfy_api_create_payment")).toBe(false);
  });

  test("JSON illisible, vide ou trop gros", async () => {
    const h = makeHandler({ rpcs: sandboxCreate });
    expect((await (await h.call("POST", "/v1/payments", { body: "{pas du json" })).json()).error.code).toBe("invalid_json");
    expect((await h.call("POST", "/v1/payments", { body: "" })).status).toBe(400);
    expect((await h.call("POST", "/v1/payments", { body: "x".repeat(20_001) })).status).toBe(413);
  });

  test("rejeu idempotent : 200 + Idempotent-Replayed ; réutilisation avec un autre corps : 409", async () => {
    const replay = makeHandler({ rpcs: { ecomfy_api_create_payment: () => ({ ok: true, replay: true, payment: paymentJson() }) } });
    const r = await replay.call("POST", "/v1/payments", { body: base, headers: { "Idempotency-Key": "k" } });
    expect(r.status).toBe(200);
    expect(r.headers.get("idempotent-replayed")).toBe("true");

    const reuse = makeHandler({ rpcs: { ecomfy_api_create_payment: () => ({ ok: false, code: "idempotency_key_reuse" }) } });
    const r2 = await reuse.call("POST", "/v1/payments", { body: base, headers: { "Idempotency-Key": "k" } });
    expect(r2.status).toBe(409);
    expect((await r2.json()).error.code).toBe("idempotency_key_reuse");

    const busy = makeHandler({ rpcs: { ecomfy_api_create_payment: () => ({ ok: false, code: "request_in_progress" }) } });
    const r3 = await busy.call("POST", "/v1/payments", { body: base, headers: { "Idempotency-Key": "k" } });
    expect(r3.status).toBe(409);
    expect(r3.headers.get("retry-after")).toBe("2");
  });

  test("erreur de base : 500 générique, sans détail interne", async () => {
    const h = makeHandler({ rpcs: { ecomfy_api_create_payment: () => new Error('relation "secret_table" does not exist') } });
    const r = await h.call("POST", "/v1/payments", { body: base });
    expect(r.status).toBe(500);
    const txt = await r.text();
    expect(txt).not.toContain("secret_table");
    expect(txt).toContain("req_test");
  });
});

describe("POST /v1/payments (production)", () => {
  const liveAuth = { key_id: "k2", merchant_id: "m1", shop_id: "s1", livemode: true, business_name: "Ma Boutique", kyc_verified: true };
  const liveCreate = {
    ecomfy_api_create_payment: () => ({
      ok: true, replay: false, payment: paymentJson({ id: PAY_LIVE, livemode: true, checkout_url: null }),
      live: { internal_reference: "ECM-PAY-ABC", ecomfy_payment_id: "uuid-1", business_name: "Ma Boutique" },
    }),
  };

  test("KYC non validé : 403 et rien n'est créé", async () => {
    const h = makeHandler({ auth: { ...liveAuth, kyc_verified: false }, rpcs: liveCreate });
    const r = await h.call("POST", "/v1/payments", { key: LIVE_KEY, body: base });
    expect(r.status).toBe(403);
    expect((await r.json()).error.code).toBe("kyc_required");
    expect(h.calls.some((c) => c.name === "ecomfy_api_create_payment")).toBe(false);
  });

  test("succès : l'opérateur reçoit le montant, l'URL de retour avec payment_id, puis finalisation", async () => {
    let seen: InitiatePaymentRequest | undefined;
    const h = makeHandler({
      auth: liveAuth,
      rpcs: { ...liveCreate, ecomfy_api_finalize_live: (a) => paymentJson({ id: PAY_LIVE, livemode: true, checkout_url: a.p_checkout_url }) },
      connector: { initiate: async (req) => { seen = req; return { ok: true, checkoutUrl: "https://pay.geniuspay.test/c/9", providerReference: "GP-9" }; } },
    });
    const r = await h.call("POST", "/v1/payments", { key: LIVE_KEY, body: { ...base, cancel_url: "https://shop.example.com/annule?c=1", customer: { phone: "0700000001" } } });
    expect(r.status).toBe(201);
    expect((await r.json()).checkout_url).toBe("https://pay.geniuspay.test/c/9");
    expect(seen).toMatchObject({ internalReference: "ECM-PAY-ABC", amount: 5000, currency: "XOF", paymentMethod: "wave", merchantId: "m1", shopId: "s1" });
    expect(seen!.successUrl).toBe(`https://shop.example.com/merci?payment_id=${PAY_LIVE}`);
    expect(seen!.errorUrl).toBe(`https://shop.example.com/annule?c=1&payment_id=${PAY_LIVE}`);
    const fin = h.calls.find((c) => c.name === "ecomfy_api_finalize_live")!;
    expect(fin.args).toMatchObject({ p_public_id: PAY_LIVE, p_checkout_url: "https://pay.geniuspay.test/c/9", p_provider_reference: "GP-9" });
    expect(h.calls.find((c) => c.name === "ecomfy_api_create_payment")!.args.p_provider).toBe("geniuspay");
  });

  test("l'opérateur refuse : 502, paiement abandonné avec le motif, jamais finalisé", async () => {
    const h = makeHandler({
      auth: liveAuth,
      rpcs: { ...liveCreate, ecomfy_api_abort_live: () => null },
      connector: { initiate: async () => ({ ok: false, httpStatus: 422, reason: "Le montant minimum pour XOF est 200", detail: "…" }) },
    });
    const r = await h.call("POST", "/v1/payments", { key: LIVE_KEY, body: base });
    expect(r.status).toBe(502);
    expect(await r.text()).not.toContain("minimum");
    const abort = h.calls.find((c) => c.name === "ecomfy_api_abort_live")!;
    expect(String(abort.args.p_reason)).toContain("422");
    expect(h.calls.some((c) => c.name === "ecomfy_api_finalize_live")).toBe(false);
  });

  test("opérateur non configuré : 503 et paiement abandonné", async () => {
    const h = makeHandler({ auth: liveAuth, rpcs: { ...liveCreate, ecomfy_api_abort_live: () => null }, connector: { isConfigured: () => false } });
    const r = await h.call("POST", "/v1/payments", { key: LIVE_KEY, body: base });
    expect(r.status).toBe(503);
    expect(h.calls.some((c) => c.name === "ecomfy_api_abort_live")).toBe(true);
  });

  test("simulation interdite avec une clé live", async () => {
    const h = makeHandler({ auth: liveAuth });
    const r = await h.call("POST", `/v1/sandbox/payments/${PAY_TEST}/simulate`, { key: LIVE_KEY, body: { scenario: "success" } });
    expect(r.status).toBe(403);
  });
});

describe("lecture, liste et simulation", () => {
  test("GET /v1/payments/{id} : 200, 404 si inconnu, 404 si identifiant mal formé", async () => {
    const h = makeHandler({ rpcs: { ecomfy_api_get_payment: (a) => (a.p_public_id === PAY_TEST ? paymentJson() : null) } });
    expect((await h.call("GET", `/v1/payments/${PAY_TEST}`)).status).toBe(200);
    expect((await h.call("GET", `/v1/payments/pay_test_${"9".repeat(24)}`)).status).toBe(404);
    expect((await h.call("GET", "/v1/payments/abc")).status).toBe(404);
    expect(h.calls.filter((c) => c.name === "ecomfy_api_get_payment")).toHaveLength(2);
  });

  test("GET /v1/payments : liste, paramètres validés", async () => {
    const h = makeHandler({ rpcs: { ecomfy_api_list_payments: () => ({ data: [paymentJson()], has_more: true }) } });
    const ok = await h.call("GET", `/v1/payments?limit=5&status=pending&starting_after=${PAY_TEST}`);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ object: "list", has_more: true });
    expect(h.calls.find((c) => c.name === "ecomfy_api_list_payments")!.args).toEqual({ p_key_id: "k1", p_limit: 5, p_starting_after: PAY_TEST, p_status: "pending" });
    for (const q of ["limit=0", "limit=101", "limit=abc", "status=weird", "starting_after=zzz"]) {
      expect((await h.call("GET", `/v1/payments?${q}`)).status).toBe(400);
    }
  });

  test("simulation : 200 et envoi des webhooks en arrière-plan ; 409 si déjà terminé ; scénario inconnu 400", async () => {
    const h = makeHandler({ rpcs: { ecomfy_api_simulate: () => ({ ok: true, payment: paymentJson({ status: "succeeded" }) }) } });
    const r = await h.call("POST", `/v1/sandbox/payments/${PAY_TEST}/simulate`, { body: { scenario: "success" } });
    expect(r.status).toBe(200);
    expect((await r.json()).status).toBe("succeeded");
    expect(h.deliver).toHaveBeenCalledTimes(1);
    expect(h.calls.find((c) => c.name === "ecomfy_api_simulate")!.args).toEqual({ p_public_id: PAY_TEST, p_scenario: "success", p_key_id: "k1" });

    const done = makeHandler({ rpcs: { ecomfy_api_simulate: () => ({ ok: false, code: "payment_not_pending" }) } });
    expect((await done.call("POST", `/v1/sandbox/payments/${PAY_TEST}/simulate`, { body: { scenario: "success" } })).status).toBe(409);
    expect((await done.call("POST", `/v1/sandbox/payments/${PAY_TEST}/simulate`, { body: { scenario: "nope" } })).status).toBe(400);
  });
});

describe("page de paiement sandbox (sans clé)", () => {
  test("lecture, choix d'un scénario et redirection", async () => {
    const h = makeHandler({
      rpcs: {
        ecomfy_api_sandbox_checkout: () => ({ id: PAY_TEST, status: "pending", amount: 5000 }),
        ecomfy_api_simulate: (a) => ({ ok: true, payment: paymentJson({ status: a.p_scenario === "success" ? "succeeded" : "failed", cancel_url: "https://shop.example.com/annule" }) }),
      },
    });
    expect((await h.call("GET", `/v1/sandbox/checkout/${PAY_TEST}`, { key: null })).status).toBe(200);
    const ok = await (await h.call("POST", `/v1/sandbox/checkout/${PAY_TEST}/complete`, { key: null, body: { scenario: "success" } })).json();
    expect(ok.redirect_url).toBe(`https://shop.example.com/merci?payment_id=${PAY_TEST}`);
    expect(JSON.stringify(ok)).not.toContain("customer");
    const ko = await (await h.call("POST", `/v1/sandbox/checkout/${PAY_TEST}/complete`, { key: null, body: { scenario: "declined" } })).json();
    expect(ko.redirect_url).toBe(`https://shop.example.com/annule?payment_id=${PAY_TEST}`);
    expect(h.calls.find((c) => c.name === "ecomfy_api_simulate")!.args.p_key_id).toBeNull();
  });

  test("identifiant de production refusé, limite par IP", async () => {
    const h = makeHandler({ rpcs: { ecomfy_api_sandbox_checkout: () => paymentJson() } });
    expect((await h.call("GET", `/v1/sandbox/checkout/${PAY_LIVE}`, { key: null })).status).toBe(404);
    const limited = makeHandler({ allow: false });
    expect((await limited.call("GET", `/v1/sandbox/checkout/${PAY_TEST}`, { key: null })).status).toBe(429);
  });
});

describe("tâche planifiée", () => {
  test("refusée sans secret, exécutée avec", async () => {
    const no = makeHandler({ cron: false });
    expect((await no.call("POST", "", { key: null, body: { task: "deliver" } })).status).toBe(401);
    expect(no.deliver).not.toHaveBeenCalled();
    const yes = makeHandler({ cron: true, rpcs: { ecomfy_api_purge: () => ({ idempotency: 0, deliveries: 0 }) } });
    const r = await yes.call("POST", "", { key: null, body: { task: "deliver" } });
    expect(r.status).toBe(200);
    expect(yes.deliver).toHaveBeenCalledTimes(1);
  });
});
