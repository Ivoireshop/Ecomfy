// Webhooks sortants d'Ecomfy Pay vers le serveur du marchand : signature, garde contre les adresses internes (SSRF), envoi.
// Aucune dépendance Deno : testable sous Node (fetch et résolveur DNS injectables).
//
// Signature : en-tête `Ecomfy-Signature: t=<secondes Unix>,v1=<hex>` avec v1 = HMAC-SHA256(secret, `${t}.${corps brut}`).
// Même principe que les webhooks entrants de GeniusPay : le marchand recalcule la signature sur le corps BRUT et refuse
// un horodatage à plus de 5 minutes (anti-rejeu).

export const SIGNATURE_TOLERANCE_SECONDS = 300;

async function hmacHex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signWebhook(secret: string, timestamp: number, rawBody: string): Promise<string> {
  return `t=${timestamp},v1=${await hmacHex(secret, `${timestamp}.${rawBody}`)}`;
}

/** Vérification côté marchand (exemple de référence, utilisé par les tests et la documentation). */
export async function verifyWebhookSignature(
  secret: string, header: string | null, rawBody: string, nowSeconds: number, toleranceSeconds = SIGNATURE_TOLERANCE_SECONDS,
): Promise<{ ok: true } | { ok: false; reason: "missing" | "malformed" | "timestamp_out_of_range" | "invalid_signature" }> {
  if (!header) return { ok: false, reason: "missing" };
  const parts = Object.fromEntries(header.split(",").map((p) => { const i = p.indexOf("="); return [p.slice(0, i).trim(), p.slice(i + 1).trim()]; }));
  const t = Number(parts.t);
  if (!Number.isInteger(t) || !parts.v1) return { ok: false, reason: "malformed" };
  if (Math.abs(nowSeconds - t) > toleranceSeconds) return { ok: false, reason: "timestamp_out_of_range" };
  const expected = await hmacHex(secret, `${t}.${rawBody}`);
  return safeEqual(expected, parts.v1) ? { ok: true } : { ok: false, reason: "invalid_signature" };
}

// ---------------------------------------------------------------------------------------------------------------------
// Garde SSRF : le marchand choisit l'URL, notre serveur la contacte. On refuse tout ce qui n'est pas un site public.
// ---------------------------------------------------------------------------------------------------------------------

const BLOCKED_SUFFIXES = [".local", ".localhost", ".internal", ".lan", ".home", ".corp", ".intranet"];

export function isPrivateAddress(ip: string): boolean {
  const v = ip.trim().toLowerCase();
  const m4 = v.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m4) {
    const [a, b] = [Number(m4[1]), Number(m4[2])];
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (v.includes(":")) {
    if (v === "::" || v === "::1") return true;
    const mapped = v.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith("ff");
  }
  return false;
}

/** Contrôle statique de l'URL (avant tout accès réseau). */
export function checkWebhookUrl(raw: string): { ok: true; host: string } | { ok: false; reason: string } {
  let u: URL;
  try { u = new URL(raw); } catch { return { ok: false, reason: "invalid_url" }; }
  if (u.protocol !== "https:") return { ok: false, reason: "https_required" };
  if (u.username || u.password) return { ok: false, reason: "credentials_in_url" };
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || BLOCKED_SUFFIXES.some((s) => host.endsWith(s)) || (!host.includes(".") && !host.includes(":"))) {
    return { ok: false, reason: "internal_host" };
  }
  if (/^[\d.]+$/.test(host) || host.includes(":")) {
    // Adresse IP littérale : jamais acceptée comme destination (un nom de domaine public suffit à un marchand).
    return { ok: false, reason: "ip_literal" };
  }
  return { ok: true, host };
}

export type DnsResolver = (host: string) => Promise<string[]>;

// ---------------------------------------------------------------------------------------------------------------------
// Envoi
// ---------------------------------------------------------------------------------------------------------------------

export interface ClaimedDelivery {
  delivery_id: string;
  attempt: number;
  url: string;
  secret: string;
  event_id: string;
  event_type: string;
  payload: unknown;
}

export interface DeliveryDb {
  rpc(name: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
}

export interface DeliverDeps {
  db: DeliveryDb;
  fetch?: typeof fetch;
  nowSeconds?: () => number;
  /** Résolveur DNS facultatif : si fourni, toutes les adresses du nom doivent être publiques. */
  resolve?: DnsResolver;
  timeoutMs?: number;
  limit?: number;
}

export interface DeliverResult { claimed: number; succeeded: number; retried: number; failed: number }

/** Envoie une livraison réservée ; renvoie le statut HTTP (0 = pas de réponse) et une erreur éventuelle. */
export async function sendDelivery(d: ClaimedDelivery, deps: DeliverDeps): Promise<{ status: number; error?: string }> {
  const check = checkWebhookUrl(d.url);
  if (!check.ok) return { status: 0, error: `url_refused:${check.reason}` };
  if (deps.resolve) {
    try {
      const addrs = await deps.resolve(check.host);
      if (!addrs.length) return { status: 0, error: "dns_no_address" };
      if (addrs.some(isPrivateAddress)) return { status: 0, error: "url_refused:private_address" };
    } catch (e) {
      return { status: 0, error: `dns_error:${(e as Error)?.message ?? e}`.slice(0, 200) };
    }
  }

  const body = JSON.stringify(d.payload);
  const ts = (deps.nowSeconds ?? (() => Math.floor(Date.now() / 1000)))();
  const signature = await signWebhook(d.secret, ts, body);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), deps.timeoutMs ?? 8000);
  try {
    const resp = await (deps.fetch ?? fetch)(d.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Ecomfy-Webhooks/1.0",
        "Ecomfy-Signature": signature,
        "Ecomfy-Event-Id": d.event_id,
        "Ecomfy-Event-Type": d.event_type,
        "Ecomfy-Delivery-Attempt": String(d.attempt),
      },
      body,
      redirect: "manual", // une redirection n'est jamais suivie (elle pourrait mener à une adresse interne)
      signal: ctrl.signal,
    });
    await resp.body?.cancel().catch(() => {});
    return { status: resp.status };
  } catch (e) {
    return { status: 0, error: ((e as Error)?.name === "AbortError" ? "timeout" : `network:${(e as Error)?.message ?? e}`).slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

/** Réserve les livraisons échues, les envoie, enregistre le résultat. Jamais d'exception : appelée en arrière-plan. */
export async function deliverDue(deps: DeliverDeps): Promise<DeliverResult> {
  const out: DeliverResult = { claimed: 0, succeeded: 0, retried: 0, failed: 0 };
  try {
    const { data, error } = await deps.db.rpc("ecomfy_api_claim_deliveries", { p_limit: deps.limit ?? 20 });
    if (error || !Array.isArray(data)) {
      if (error) console.error("[ecomfy-pay-api] claim_deliveries:", error.message);
      return out;
    }
    const rows = data as ClaimedDelivery[];
    out.claimed = rows.length;
    // Par petits groupes : un destinataire lent ne retarde pas les autres, sans ouvrir 100 connexions d'un coup.
    for (let i = 0; i < rows.length; i += 5) {
      await Promise.all(rows.slice(i, i + 5).map(async (row) => {
        const res = await sendDelivery(row, deps);
        const { data: state, error: recErr } = await deps.db.rpc("ecomfy_api_record_delivery", {
          p_delivery_id: row.delivery_id, p_http_status: res.status, p_error: res.error ?? (res.status >= 200 && res.status < 300 ? null : `http_${res.status}`),
        });
        if (recErr) console.error("[ecomfy-pay-api] record_delivery:", recErr.message);
        if (state === "succeeded") out.succeeded++; else if (state === "failed") out.failed++; else out.retried++;
      }));
    }
  } catch (e) {
    console.error("[ecomfy-pay-api] deliverDue:", e);
  }
  return out;
}
