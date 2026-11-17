/**
 * Outils communs à la connexion Meta Ads par OAuth (Edge Function meta-ads-oauth).
 *
 * - Le jeton Meta reste dans `meta_ads_connections` (service role) et n'est jamais renvoyé au navigateur.
 * - Il voyage dans l'en-tête Authorization (jamais dans une URL, donc jamais dans les journaux) et chaque appel
 *   porte un `appsecret_proof` : un jeton volé est inutilisable sans le secret de l'application.
 * - Le paramètre OAuth `state` est signé (HMAC), à usage « meta_ads », lié à l'utilisateur et à la boutique,
 *   et expire en 10 minutes : il empêche le CSRF et le rattachement d'un compte Meta à la boutique d'un autre.
 */

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- global Deno absent des types du projet
declare const Deno: any;

export const GRAPH_VERSION = /^v\d{2}\.\d$/.test(Deno.env.get("META_GRAPH_VERSION") ?? "")
  ? Deno.env.get("META_GRAPH_VERSION")!
  : "v23.0";
export const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** `ads_read` suffit à lire les dépenses ; `business_management` permet de lister les Business Managers. */
export const META_SCOPES = ["ads_read", "business_management"];
export const REQUIRED_SCOPE = "ads_read";

export const REDIRECT_URI = () => Deno.env.get("META_OAUTH_REDIRECT_URI") || "https://ecomfy.cloud/meta-ads/callback";

export function metaConfig(): { appId: string; appSecret: string } | null {
  const appId = Deno.env.get("META_APP_ID") || "";
  const appSecret = Deno.env.get("META_APP_SECRET") || "";
  return appId && appSecret ? { appId, appSecret } : null;
}

// ---- state OAuth signé ------------------------------------------------------

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function hmacKey(secret: string, usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usages);
}

function stateSecret(): string {
  const secret = Deno.env.get("META_STATE_SECRET") || Deno.env.get("META_APP_SECRET") || "";
  if (!secret) throw new Error("META_APP_SECRET non configuré");
  return secret;
}

export async function signState(shopId: string, userId: string, ttlSeconds = 600): Promise<string> {
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(12)));
  const payload = b64url(
    new TextEncoder().encode(JSON.stringify({ p: "meta_ads", s: shopId, u: userId, n: nonce, e: Math.floor(Date.now() / 1000) + ttlSeconds })),
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(stateSecret(), ["sign"]), new TextEncoder().encode(payload)));
  return `${payload}.${b64url(sig)}`;
}

/** Retourne l'identifiant de boutique si le state est authentique, non expiré et émis pour cet utilisateur. */
export async function verifyState(state: string, userId: string): Promise<string | null> {
  const [payload, sig] = String(state || "").split(".");
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(stateSecret(), ["verify"]), fromB64url(sig), new TextEncoder().encode(payload));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (data.p !== "meta_ads" || data.u !== userId || typeof data.s !== "string" || data.e < Math.floor(Date.now() / 1000)) return null;
    return data.s;
  } catch {
    return null;
  }
}

// ---- appels Graph API -------------------------------------------------------

async function appSecretProof(token: string, appSecret: string): Promise<string> {
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(appSecret, ["sign"]), new TextEncoder().encode(token)));
  return Array.from(sig).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class MetaApiError extends Error {
  constructor(message: string, public status: number, public code?: number) {
    super(message);
  }
}

/** GET Graph avec jeton en en-tête et appsecret_proof. `path` commence par « / ». */
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- réponse Graph non typée
export async function graphGet(path: string, token: string, params: Record<string, string> = {}): Promise<any> {
  const cfg = metaConfig();
  if (!cfg) throw new Error("Meta n'est pas configuré sur le serveur.");
  const qs = new URLSearchParams({ ...params, appsecret_proof: await appSecretProof(token, cfg.appSecret) });
  const res = await fetch(`${GRAPH}${path}?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    throw new MetaApiError(json?.error?.message || `Erreur API Meta (${res.status})`, res.status, json?.error?.code);
  }
  return json;
}

/** Parcourt les pages d'une liste Graph (plafonnée pour borner le coût). */
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- réponse Graph non typée
export async function graphList(path: string, token: string, params: Record<string, string>, maxPages = 5): Promise<any[]> {
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- réponse Graph non typée
  const out: any[] = [];
  let after: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const json = await graphGet(path, token, after ? { ...params, after } : params);
    out.push(...(json.data || []));
    after = json?.paging?.cursors?.after;
    if (!json?.paging?.next || !after) break;
  }
  return out;
}

/** Échange le code d'autorisation contre un jeton court, puis contre un jeton long (~60 jours). */
export async function exchangeCodeForLongLivedToken(code: string): Promise<{ token: string; expiresAt: string | null }> {
  const cfg = metaConfig();
  if (!cfg) throw new Error("Meta n'est pas configuré sur le serveur.");

  const shortRes = await fetch(`${GRAPH}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cfg.appId, client_secret: cfg.appSecret, redirect_uri: REDIRECT_URI(), code }),
  });
  const short = await shortRes.json().catch(() => ({}));
  if (!shortRes.ok || short?.error || !short?.access_token) {
    throw new MetaApiError(short?.error?.message || "Échange du code Meta refusé.", shortRes.status, short?.error?.code);
  }

  const longRes = await fetch(`${GRAPH}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: cfg.appId,
      client_secret: cfg.appSecret,
      fb_exchange_token: short.access_token,
    }),
  });
  const long = await longRes.json().catch(() => ({}));
  // Si l'échange long échoue, on garde le jeton court plutôt que de bloquer : il sera signalé comme expirant vite.
  const token: string = longRes.ok && long?.access_token ? long.access_token : short.access_token;
  const expiresIn = Number(longRes.ok && long?.access_token ? long.expires_in : short.expires_in);
  return { token, expiresAt: Number.isFinite(expiresIn) && expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null };
}

/** Inspecte un jeton avec le jeton d'application : valide ? pour qui ? quelles permissions accordées ? */
export async function inspectToken(token: string): Promise<{ valid: boolean; userId: string | null; scopes: string[]; expiresAt: string | null }> {
  const cfg = metaConfig();
  if (!cfg) throw new Error("Meta n'est pas configuré sur le serveur.");
  const res = await fetch(`${GRAPH}/debug_token?${new URLSearchParams({ input_token: token })}`, {
    headers: { Authorization: `Bearer ${cfg.appId}|${cfg.appSecret}` },
  });
  const json = await res.json().catch(() => ({}));
  const d = json?.data;
  if (!res.ok || !d) return { valid: false, userId: null, scopes: [], expiresAt: null };
  const exp = Number(d.data_access_expires_at ?? d.expires_at);
  return {
    valid: d.is_valid === true,
    userId: d.user_id ? String(d.user_id) : null,
    scopes: Array.isArray(d.scopes) ? d.scopes.map(String) : [],
    expiresAt: Number.isFinite(exp) && exp > 0 ? new Date(exp * 1000).toISOString() : null,
  };
}

// ---- Business Manager et comptes publicitaires -----------------------------

export interface MetaBusiness { id: string; name: string }
export interface MetaAdAccount {
  account_id: string; // sans préfixe act_
  name: string;
  currency: string | null;
  status: number | null; // 1 = actif
  business_id: string | null;
}

const ACCOUNT_FIELDS = "account_id,name,currency,account_status";

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- réponse Graph non typée
const toAccount =(a: any, businessId: string | null): MetaAdAccount => ({
  account_id: String(a.account_id ?? String(a.id || "").replace(/^act_/, "")),
  name: String(a.name || `act_${a.account_id}`),
  currency: a.currency ?? null,
  status: typeof a.account_status === "number" ? a.account_status : null,
  business_id: businessId,
});

export async function listBusinesses(token: string): Promise<MetaBusiness[]> {
  const rows = await graphList("/me/businesses", token, { fields: "id,name", limit: "100" });
  return rows.map((b) => ({ id: String(b.id), name: String(b.name || b.id) }));
}

/** Comptes d'un Business Manager (possédés + clients). `businessId` null = comptes personnels de l'utilisateur. */
export async function listAdAccounts(token: string, businessId: string | null): Promise<MetaAdAccount[]> {
  const params = { fields: ACCOUNT_FIELDS, limit: "100" };
  const rows = businessId
    ? [
        ...(await graphList(`/${businessId}/owned_ad_accounts`, token, params)),
        ...(await graphList(`/${businessId}/client_ad_accounts`, token, params)),
      ]
    : await graphList("/me/adaccounts", token, params);
  const seen = new Set<string>();
  return rows
    .map((a) => toAccount(a, businessId))
    .filter((a) => (seen.has(a.account_id) ? false : (seen.add(a.account_id), true)));
}

/** Lit un compte précis avec le jeton : Meta refuse si l'utilisateur n'y a pas accès (jamais confiance au navigateur). */
export async function getAdAccount(token: string, accountId: string): Promise<MetaAdAccount> {
  const a = await graphGet(`/act_${accountId}`, token, { fields: ACCOUNT_FIELDS });
  return toAccount(a, null);
}
