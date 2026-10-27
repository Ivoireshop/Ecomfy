import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Outils communs aux fonctions Google Search Console (gsc-oauth-flow, gsc-analytics).
 *
 * - Les jetons Google restent dans `shop_seo_connections` et ne sont jamais renvoyés au navigateur.
 * - Chaque appel est rattaché à un utilisateur authentifié qui possède la boutique.
 * - Le paramètre OAuth `state` est signé (HMAC) et expire : il empêche le CSRF et le rattachement
 *   d'un compte Google à la boutique d'un autre utilisateur.
 */

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Convention des écrans : statut 200 et `success: false` + `error` en cas d'échec.
export function json(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export const fail = (error: string) => json({ success: false, error });

export function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

export const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
export const REDIRECT_URI = () => Deno.env.get("GOOGLE_OAUTH_REDIRECT_URI") || "https://ecomfy.cloud/seo";

/** Utilisateur identifié par le JWT de la requête (signature vérifiée par Supabase Auth), ou null. */
export async function getUserId(req: Request): Promise<string | null> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try {
    const { data, error } = await adminClient().auth.getUser(token);
    return error || !data?.user ? null : data.user.id;
  } catch {
    return null;
  }
}

/** Vrai si l'utilisateur est propriétaire de la boutique. */
export async function ownsShop(admin: ReturnType<typeof adminClient>, userId: string, shopId: string): Promise<boolean> {
  if (!shopId) return false;
  const { data } = await admin.from("shops").select("id").eq("id", shopId).eq("user_id", userId).maybeSingle();
  return !!data;
}

// ---- state OAuth signé ------------------------------------------------------

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function hmacKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("GSC_STATE_SECRET") || Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") || "";
  if (!secret) throw new Error("GOOGLE_OAUTH_CLIENT_SECRET non configuré");
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signState(shopId: string, userId: string, ttlSeconds = 600): Promise<string> {
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ s: shopId, u: userId, e: Math.floor(Date.now() / 1000) + ttlSeconds })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(payload)));
  return `${payload}.${b64url(sig)}`;
}

/** Retourne l'identifiant de boutique si le state est authentique, non expiré et émis pour cet utilisateur. */
export async function verifyState(state: string, userId: string): Promise<string | null> {
  const [payload, sig] = String(state || "").split(".");
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(), fromB64url(sig), new TextEncoder().encode(payload));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (data.u !== userId || typeof data.s !== "string" || data.e < Math.floor(Date.now() / 1000)) return null;
    return data.s;
  } catch {
    return null;
  }
}

// ---- jetons Google ----------------------------------------------------------

export interface GscConnection {
  shop_id: string;
  google_refresh_token: string | null;
  google_access_token: string | null;
  token_expires_at: string | null;
  gsc_property_id: string | null;
  gsc_connected: boolean;
}

export async function loadConnection(admin: ReturnType<typeof adminClient>, shopId: string): Promise<GscConnection | null> {
  const { data } = await admin
    .from("shop_seo_connections")
    .select("shop_id, google_refresh_token, google_access_token, token_expires_at, gsc_property_id, gsc_connected")
    .eq("shop_id", shopId)
    .maybeSingle();
  return (data as GscConnection) ?? null;
}

/** Jeton d'accès valide ; le renouvelle avec le jeton de rafraîchissement s'il expire dans moins d'une minute. */
export async function getValidAccessToken(admin: ReturnType<typeof adminClient>, conn: GscConnection): Promise<string> {
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (conn.google_access_token && expiresAt - Date.now() > 60_000) return conn.google_access_token;
  if (!conn.google_refresh_token) throw new Error("Connexion Google expirée : reconnectez Search Console.");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") || "",
      client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") || "",
      refresh_token: conn.google_refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    await admin.from("shop_seo_connections").update({ sync_status: "error", sync_error: String(data.error_description || data.error || "refresh_failed") }).eq("shop_id", conn.shop_id);
    throw new Error("Connexion Google expirée : reconnectez Search Console.");
  }

  const expires = new Date(Date.now() + (Number(data.expires_in) || 3600) * 1000).toISOString();
  await admin.from("shop_seo_connections").update({ google_access_token: data.access_token, token_expires_at: expires, updated_at: new Date().toISOString() }).eq("shop_id", conn.shop_id);
  return data.access_token as string;
}

export async function listSites(accessToken: string): Promise<{ siteUrl: string; permissionLevel: string }[]> {
  const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(`Erreur API Google (${res.status})`);
  return (data.siteEntry || []).map((s: any) => ({ siteUrl: s.siteUrl, permissionLevel: s.permissionLevel }));
}
