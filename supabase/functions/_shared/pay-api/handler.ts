// Routeur de l'API Ecomfy Pay (Edge Function ecomfy-pay-api). Aucune dépendance Deno : toutes les dépendances sont injectées
// (base, opérateur, limiteur, planificateur), donc testable sous Node avec des doublures.
//
// Routes (préfixe /v1) :
//   POST /v1/payments                          crée un paiement                       (clé secrète)
//   GET  /v1/payments                          liste paginée                          (clé secrète)
//   GET  /v1/payments/{id}                     relit un paiement                      (clé secrète)
//   POST /v1/sandbox/payments/{id}/simulate    fait aboutir un paiement de test       (clé secrète test)
//   GET  /v1/sandbox/checkout/{id}             données de la page de paiement sandbox (sans clé : l'identifiant fait office de secret)
//   POST /v1/sandbox/checkout/{id}/complete    choix du scénario sur cette page       (sans clé)
//   POST /  {"task":"deliver"}                 envoi des webhooks dus                 (planificateur)
//
// Toute la logique d'état (paiement, idempotence, événements) est dans les fonctions SQL de la migration
// 20261114110000_ecomfy_pay_api.sql : ici, seulement l'authentification, la validation, l'appel à l'opérateur en production
// et le format des réponses.
import type { OperatorConnector } from "../operators/types.ts";
import {
  canonicalJson, PAYMENT_ID_RE, SECRET_KEY_RE, sha256Hex, validateCreatePayment, validateIdempotencyKey, validateScenario,
} from "./validate.ts";

type Json = Record<string, unknown>;

export interface ApiDb {
  rpc(name: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
}

export interface HandlerDeps {
  db: ApiDb;
  connector: () => OperatorConnector;
  /** true = autorisé. Un échec de vérification doit renvoyer false (fail closed). */
  rateLimit: (bucket: string, key: string, max: number, windowSeconds: number) => Promise<boolean>;
  /** Base de l'URL de paiement sandbox, sans barre finale (ex. https://ecomfy.cloud/sandbox/pay). */
  checkoutBase: string;
  isCron: (req: Request) => boolean;
  clientIp: (req: Request) => string;
  /** Envoi des webhooks dus (deliverDue câblé). */
  deliver: () => Promise<unknown>;
  runInBackground: (p: Promise<unknown>) => void;
  requestId?: () => string;
  nowMinute?: () => number;
}

interface AuthContext {
  key_id: string;
  merchant_id: string;
  shop_id: string;
  livemode: boolean;
  business_name: string | null;
  kyc_verified: boolean;
}

const MAX_BODY = 20_000;
const LIST_STATUSES = ["pending", "succeeded", "failed", "cancelled", "expired", "refunded"];

export function routeOf(pathname: string): string {
  const r = pathname.replace(/^\/(?:functions\/v1\/)?ecomfy-pay-api/, "");
  return r.length > 1 && r.endsWith("/") ? r.slice(0, -1) : r;
}

function withQuery(raw: string, params: Record<string, string>): string {
  const u = new URL(raw);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

export function createApiHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const requestId = deps.requestId?.() ?? `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
    const respond = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Request-Id": requestId, ...headers },
      });
    const fail = (status: number, type: string, code: string, message: string, param?: string, headers: Record<string, string> = {}): Response =>
      respond(status, { error: { type, code, message, ...(param ? { param } : {}), request_id: requestId } }, headers);
    const rpc = async (name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: boolean }> => {
      const { data, error } = await deps.db.rpc(name, args);
      if (error) console.error(`[ecomfy-pay-api] ${requestId} rpc ${name}:`, error.message);
      return { data, error: !!error };
    };
    const internalError = () => fail(500, "api_error", "internal_error", "Une erreur interne est survenue. Réessayez ; contactez le support avec le Request-Id si elle persiste.");

    try {
      const url = new URL(req.url);
      const route = routeOf(url.pathname);
      const method = req.method.toUpperCase();

      // ---- Tâche planifiée : webhooks dus (+ ménage une fois par heure) ----
      if (route === "" || route === "/") {
        if (method !== "POST") return fail(404, "invalid_request_error", "route_not_found", "Route inconnue.");
        if (!deps.isCron(req)) return fail(401, "authentication_error", "unauthorized", "Non autorisé.");
        const result = await deps.deliver();
        let purged: unknown = null;
        if ((deps.nowMinute?.() ?? new Date().getUTCMinutes()) === 7) purged = (await rpc("ecomfy_api_purge", {})).data;
        return respond(200, { ok: true, deliveries: result, purged });
      }

      // ---- Page de paiement sandbox : sans clé, limitée par IP ----
      const checkout = route.match(/^\/v1\/sandbox\/checkout\/([^/]+?)(\/complete)?$/);
      if (checkout) {
        const [, id, complete] = checkout;
        if (!PAYMENT_ID_RE.test(id) || !id.startsWith("pay_test_")) return fail(404, "invalid_request_error", "payment_not_found", "Paiement introuvable.");
        if (!(await deps.rateLimit("ecomfy_pay_api_checkout", deps.clientIp(req), 60, 60))) {
          return fail(429, "rate_limit_error", "rate_limited", "Trop de requêtes.", undefined, { "Retry-After": "60" });
        }
        if (!complete) {
          if (method !== "GET") return fail(405, "invalid_request_error", "method_not_allowed", "Méthode non autorisée.");
          const r = await rpc("ecomfy_api_sandbox_checkout", { p_public_id: id });
          if (r.error) return internalError();
          if (!r.data) return fail(404, "invalid_request_error", "payment_not_found", "Paiement introuvable.");
          return respond(200, r.data);
        }
        if (method !== "POST") return fail(405, "invalid_request_error", "method_not_allowed", "Méthode non autorisée.");
        const body = await readJson(req);
        if (!body.ok) return fail(400, "invalid_request_error", body.code, body.message);
        const sc = validateScenario(body.value);
        if (!sc.ok) return fail(400, "invalid_request_error", "invalid_request", sc.message, sc.param);
        const sim = await rpc("ecomfy_api_simulate", { p_public_id: id, p_scenario: sc.value, p_key_id: null });
        if (sim.error) return internalError();
        const s = sim.data as Json;
        if (!s?.ok) {
          if (s?.code === "payment_not_pending") return fail(409, "invalid_request_error", "payment_not_pending", "Ce paiement de test est déjà terminé.");
          return fail(404, "invalid_request_error", "payment_not_found", "Paiement introuvable.");
        }
        deps.runInBackground(deps.deliver());
        const pay = s.payment as Json;
        const target = pay.status === "succeeded" ? (pay.success_url as string) : ((pay.cancel_url as string | null) ?? (pay.success_url as string));
        return respond(200, { id, status: pay.status, redirect_url: target ? withQuery(target, { payment_id: id }) : null });
      }

      // ---- Routes authentifiées par clé secrète ----
      const known = route === "/v1/payments" || /^\/v1\/payments\/[^/]+$/.test(route) || /^\/v1\/sandbox\/payments\/[^/]+\/simulate$/.test(route);
      if (!known) return fail(404, "invalid_request_error", "route_not_found", "Route inconnue. Les routes commencent par /v1/.");

      const header = req.headers.get("authorization") ?? "";
      const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
      if (!token) return fail(401, "authentication_error", "missing_api_key", "Clé d'API absente. Envoyez l'en-tête Authorization: Bearer ecm_sk_….", undefined, { "WWW-Authenticate": "Bearer" });
      if (!SECRET_KEY_RE.test(token)) return fail(401, "authentication_error", "invalid_api_key", "Clé d'API invalide.", undefined, { "WWW-Authenticate": "Bearer" });

      const authRes = await rpc("ecomfy_api_authenticate", { p_key_hash: await sha256Hex(token) });
      if (authRes.error) return internalError();
      const auth = authRes.data as AuthContext | null;
      if (!auth) return fail(401, "authentication_error", "invalid_api_key", "Clé d'API invalide ou révoquée.", undefined, { "WWW-Authenticate": "Bearer" });
      // Le mode vient de la clé, jamais de la requête : une clé test ne voit que le sandbox, une clé live que la production.
      if (auth.livemode !== token.startsWith("ecm_sk_live_")) return fail(401, "authentication_error", "invalid_api_key", "Clé d'API invalide.");

      if (!(await deps.rateLimit("ecomfy_pay_api", auth.key_id, 120, 60))) {
        return fail(429, "rate_limit_error", "rate_limited", "Trop de requêtes : 120 par minute et par clé.", undefined, { "Retry-After": "60" });
      }

      // POST /v1/payments
      if (route === "/v1/payments") {
        if (method === "GET") return await listPayments(url, auth);
        if (method !== "POST") return fail(405, "invalid_request_error", "method_not_allowed", "Méthode non autorisée.", undefined, { Allow: "GET, POST" });
        return await createPayment(req, auth);
      }

      const one = route.match(/^\/v1\/payments\/([^/]+)$/);
      if (one) {
        if (method !== "GET") return fail(405, "invalid_request_error", "method_not_allowed", "Méthode non autorisée.", undefined, { Allow: "GET" });
        if (!PAYMENT_ID_RE.test(one[1])) return fail(404, "invalid_request_error", "payment_not_found", "Paiement introuvable.");
        const r = await rpc("ecomfy_api_get_payment", { p_key_id: auth.key_id, p_public_id: one[1] });
        if (r.error) return internalError();
        if (!r.data) return fail(404, "invalid_request_error", "payment_not_found", "Paiement introuvable.");
        return respond(200, r.data);
      }

      const sim = route.match(/^\/v1\/sandbox\/payments\/([^/]+)\/simulate$/);
      if (sim) {
        if (method !== "POST") return fail(405, "invalid_request_error", "method_not_allowed", "Méthode non autorisée.", undefined, { Allow: "POST" });
        if (auth.livemode) return fail(403, "permission_error", "live_mode_not_simulable", "La simulation n'existe qu'avec une clé de test (ecm_sk_test_…).");
        if (!PAYMENT_ID_RE.test(sim[1])) return fail(404, "invalid_request_error", "payment_not_found", "Paiement introuvable.");
        const body = await readJson(req);
        if (!body.ok) return fail(400, "invalid_request_error", body.code, body.message);
        const sc = validateScenario(body.value);
        if (!sc.ok) return fail(400, "invalid_request_error", "invalid_request", sc.message, sc.param);
        const r = await rpc("ecomfy_api_simulate", { p_public_id: sim[1], p_scenario: sc.value, p_key_id: auth.key_id });
        if (r.error) return internalError();
        const s = r.data as Json;
        if (!s?.ok) {
          if (s?.code === "payment_not_pending") return fail(409, "invalid_request_error", "payment_not_pending", "Ce paiement de test est déjà terminé.");
          return fail(404, "invalid_request_error", "payment_not_found", "Paiement introuvable.");
        }
        deps.runInBackground(deps.deliver());
        return respond(200, s.payment);
      }
      return fail(404, "invalid_request_error", "route_not_found", "Route inconnue.");

      // ---------------------------------------------------------------------------------------------------------------
      async function createPayment(request: Request, a: AuthContext): Promise<Response> {
        if (a.livemode && !a.kyc_verified) {
          return fail(403, "permission_error", "kyc_required", "Votre vérification d'identité (KYC) doit être validée avant d'encaisser en production. Utilisez une clé de test en attendant.");
        }
        const body = await readJson(request);
        if (!body.ok) return fail(body.status, "invalid_request_error", body.code, body.message);
        const v = validateCreatePayment(body.value, a.livemode);
        if (!v.ok) return fail(400, "invalid_request_error", "invalid_request", v.message, v.param);
        const idem = validateIdempotencyKey(request.headers.get("idempotency-key"));
        if (!idem.ok) return fail(400, "invalid_request_error", "invalid_request", idem.message, idem.param);

        const created = await rpc("ecomfy_api_create_payment", {
          p_key_id: a.key_id,
          p_input: v.value,
          p_idem_key: idem.value,
          p_request_hash: idem.value ? await sha256Hex(canonicalJson(v.value)) : null,
          p_checkout_base: deps.checkoutBase,
          p_provider: a.livemode ? deps.connector().id : null,
        });
        if (created.error) return internalError();
        const c = created.data as Json;
        if (!c?.ok) {
          switch (c?.code) {
            case "idempotency_key_reuse":
              return fail(409, "invalid_request_error", "idempotency_key_reuse", "Cette Idempotency-Key a déjà servi pour une requête différente.", "Idempotency-Key");
            case "request_in_progress":
              return fail(409, "invalid_request_error", "request_in_progress", "Une requête identique est encore en cours. Réessayez dans un instant.", "Idempotency-Key", { "Retry-After": "2" });
            case "invalid_api_key":
              return fail(401, "authentication_error", "invalid_api_key", "Clé d'API invalide ou révoquée.");
            default:
              return fail(400, "invalid_request_error", "invalid_request", "Requête invalide.", typeof c?.param === "string" ? c.param : undefined);
          }
        }
        if (c.replay) return respond(200, c.payment, { "Idempotent-Replayed": "true" });
        if (!a.livemode) return respond(201, c.payment);

        // ---- Production : l'opérateur crée la page de paiement ----
        const payment = c.payment as Json;
        const live = c.live as { internal_reference: string; ecomfy_payment_id: string; business_name: string | null };
        const publicId = payment.id as string;
        const connector = deps.connector();
        if (!connector.isConfigured()) {
          await rpc("ecomfy_api_abort_live", { p_public_id: publicId, p_reason: "provider_not_configured" });
          return fail(503, "api_error", "provider_unavailable", "Le prestataire de paiement n'est pas disponible. Réessayez plus tard.");
        }
        const success = withQuery(v.value.success_url, { payment_id: publicId });
        const result = await connector.initiatePayment({
          internalReference: live.internal_reference,
          paymentId: live.ecomfy_payment_id,
          merchantId: a.merchant_id,
          shopId: a.shop_id,
          amount: v.value.amount,
          currency: "XOF",
          paymentMethod: v.value.payment_method,
          description: v.value.description ?? `Paiement — ${live.business_name ?? "Ecomfy Pay"}`,
          customer: { name: v.value.customer.name, phone: v.value.customer.phone, email: v.value.customer.email },
          successUrl: success,
          errorUrl: withQuery(v.value.cancel_url ?? v.value.success_url, { payment_id: publicId }),
        });
        if (!result.ok) {
          console.error("[ecomfy-pay-api]", requestId, "opérateur:", connector.id, result.httpStatus, result.reason);
          await rpc("ecomfy_api_abort_live", { p_public_id: publicId, p_reason: `HTTP ${result.httpStatus ?? "?"} — ${result.reason} | ${result.detail ?? ""}` });
          return fail(502, "api_error", "provider_error", "Le prestataire de paiement a refusé ou n'a pas répondu. Aucun paiement n'a été créé ; réessayez.");
        }
        const fin = await rpc("ecomfy_api_finalize_live", { p_public_id: publicId, p_checkout_url: result.checkoutUrl, p_provider_reference: result.providerReference ?? null });
        if (fin.error || !fin.data) return internalError();
        return respond(201, fin.data);
      }

      async function listPayments(u: URL, a: AuthContext): Promise<Response> {
        const limitRaw = u.searchParams.get("limit");
        const limit = limitRaw === null ? 20 : Number(limitRaw);
        if (!Number.isInteger(limit) || limit < 1 || limit > 100) return fail(400, "invalid_request_error", "invalid_request", "limit doit être un entier de 1 à 100.", "limit");
        const status = u.searchParams.get("status");
        if (status !== null && !LIST_STATUSES.includes(status)) return fail(400, "invalid_request_error", "invalid_request", `status doit valoir : ${LIST_STATUSES.join(", ")}.`, "status");
        const after = u.searchParams.get("starting_after");
        if (after !== null && !PAYMENT_ID_RE.test(after)) return fail(400, "invalid_request_error", "invalid_request", "starting_after doit être l'id d'un paiement.", "starting_after");
        const r = await rpc("ecomfy_api_list_payments", { p_key_id: a.key_id, p_limit: limit, p_starting_after: after, p_status: status });
        if (r.error) return internalError();
        const d = r.data as Json | null;
        if (!d) return fail(401, "authentication_error", "invalid_api_key", "Clé d'API invalide ou révoquée.");
        if (d.error === "invalid_cursor") return fail(400, "invalid_request_error", "invalid_request", "starting_after ne correspond à aucun paiement.", "starting_after");
        return respond(200, { object: "list", data: d.data, has_more: d.has_more });
      }
    } catch (e) {
      console.error("[ecomfy-pay-api]", requestId, "unhandled:", e);
      return internalError();
    }
  };
}

async function readJson(req: Request): Promise<{ ok: true; value: unknown } | { ok: false; status: number; code: string; message: string }> {
  const text = await req.text();
  if (text.length > MAX_BODY) return { ok: false, status: 413, code: "body_too_large", message: "Corps de requête trop volumineux (20 Ko au plus)." };
  if (!text.trim()) return { ok: false, status: 400, code: "invalid_json", message: "Corps de requête vide : un objet JSON est attendu." };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400, code: "invalid_json", message: "Le corps de la requête n'est pas du JSON valide." };
  }
}
