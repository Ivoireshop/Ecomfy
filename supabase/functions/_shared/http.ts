// CORS et réponses d'erreur communs aux Edge Functions (audit M3).
//
// Trois niveaux, choisis par fonction selon qui l'appelle :
//   "app"    : appelée par l'application connectée (tableau de bord, studio, fondateur). Origine en liste blanche :
//              APP_URL, ecomfy.cloud, ALLOWED_ORIGINS (secret, séparé par des virgules), localhost / app native.
//   "public" : appelée par les vitrines, qui tournent aussi sur les domaines personnalisés des boutiques (origine
//              inconnue à l'avance) : `*` conservé. Aucun cookie n'est utilisé, l'accès repose sur l'en-tête
//              Authorization ou sur les contrôles côté fonction, pas sur l'origine.
//   "server" : webhooks, tâches planifiées, fonctions internes. Aucun navigateur légitime : aucun en-tête CORS.
//
// `serveCors` remplace `serve(...)` / `Deno.serve(...)` : il répond au préflight, impose les en-têtes CORS du
// niveau (en écrasant ceux écrits par la fonction) et transforme toute exception non rattrapée en HTTP 500
// générique, sans `error.message`.

export type CorsTier = "app" | "public" | "server";

const ALLOW_HEADERS = [
  "authorization",
  "x-client-info",
  "apikey",
  "content-type",
  "x-supabase-client-platform",
  "x-supabase-client-platform-version",
  "x-supabase-client-runtime",
  "x-supabase-client-runtime-version",
].join(", ");

const ALLOW_METHODS = "GET, POST, OPTIONS";

// Origines toujours acceptées en plus d'APP_URL : production, et environnements locaux / application native
// (Capacitor sert l'app depuis https://localhost sur Android et capacitor://localhost sur iOS).
const BUILTIN_ORIGINS = [
  "https://ecomfy.cloud",
  "https://www.ecomfy.cloud",
  "https://localhost",
  "capacitor://localhost",
  "http://localhost",
];

function originOf(value: string): string | null {
  try {
    const u = new URL(value.trim());
    // Les schémas non standard (capacitor://) ont `origin === "null"` : on reconstruit schéma + hôte.
    if (u.protocol === "http:" || u.protocol === "https:") return u.origin;
    if (u.protocol === "capacitor:" && u.host) return `capacitor://${u.host}`;
    return null;
  } catch {
    return null;
  }
}

/** Origines autorisées pour le niveau « app ». `appUrl` et `extra` viennent des secrets APP_URL / ALLOWED_ORIGINS. */
export function buildAllowedOrigins(appUrl = "", extra = ""): Set<string> {
  const set = new Set<string>(BUILTIN_ORIGINS);
  for (const item of [appUrl, ...extra.split(",")]) {
    const o = item ? originOf(item) : null;
    if (o) set.add(o);
  }
  return set;
}

function isLocalDev(origin: string): boolean {
  // http://localhost:8080, http://127.0.0.1:5173 : serveur de développement. Jamais un site tiers.
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

/**
 * En-têtes CORS pour une requête. `null` = aucun en-tête (origine refusée ou niveau « server »).
 * Sans en-tête Origin (appel serveur à serveur, curl) il n'y a rien à autoriser côté navigateur : on renvoie `{}`.
 */
export function corsHeadersFor(
  tier: CorsTier,
  requestOrigin: string | null,
  allowed: Set<string>,
): Record<string, string> | null {
  if (tier === "server") return null;
  const common = {
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Access-Control-Max-Age": "86400",
  };
  if (tier === "public") return { "Access-Control-Allow-Origin": "*", ...common };
  if (!requestOrigin) return {};
  const origin = originOf(requestOrigin);
  if (origin && (allowed.has(origin) || isLocalDev(origin))) {
    // Vary: Origin évite qu'un cache serve à un site la réponse prévue pour un autre.
    return { "Access-Control-Allow-Origin": origin, Vary: "Origin", ...common };
  }
  return null;
}

/** Réponse JSON d'erreur au format attendu par le front : { success: false, error }. */
export function errorJson(status: number, message: string, extra: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ success: false, error: message, ...extra }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GENERIC_SERVER_ERROR = "Une erreur est survenue. Réessayez dans un instant.";

type Handler = (req: Request) => Response | Promise<Response>;

/** Applique le niveau CORS à une réponse déjà construite (ne consomme pas le corps : les flux SSE passent). */
export function applyCors(res: Response, headers: Record<string, string> | null): Response {
  const out = new Headers(res.headers);
  for (const k of [...out.keys()]) {
    if (k.toLowerCase().startsWith("access-control-")) out.delete(k);
  }
  if (headers) for (const [k, v] of Object.entries(headers)) out.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
}

/** Version testable de `serveCors` : renvoie le gestionnaire enveloppé sans démarrer de serveur. */
export function wrapHandler(tier: CorsTier, handler: Handler, appUrl = "", extraOrigins = ""): Handler {
  const allowed = buildAllowedOrigins(appUrl, extraOrigins);
  return async (req: Request) => {
    const cors = corsHeadersFor(tier, req.headers.get("origin"), allowed);

    if (req.method === "OPTIONS") {
      // Préflight : origine refusée → 403 explicite plutôt qu'un 204 ambigu.
      if (cors === null && tier !== "server") return applyCors(errorJson(403, "Origine non autorisée."), null);
      return applyCors(new Response(null, { status: 204 }), cors);
    }

    try {
      return applyCors(await handler(req), cors);
    } catch (e) {
      console.error("[unhandled]", req.method, new URL(req.url).pathname, e);
      return applyCors(errorJson(500, GENERIC_SERVER_ERROR), cors);
    }
  };
}

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- global Deno absent des types du projet (code exécuté sous Deno)
declare const Deno: any;

export function serveCors(tier: CorsTier, handler: Handler): void {
  Deno.serve(wrapHandler(tier, handler, Deno.env.get("APP_URL") ?? "", Deno.env.get("ALLOWED_ORIGINS") ?? ""));
}
