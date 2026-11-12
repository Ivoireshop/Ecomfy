/**
 * `fetch` résilient pour le client Supabase (API REST uniquement).
 *
 * Contexte : le 12/11/2026 la base de prod est devenue injoignable (521/522/503). Les écrans, eux, ont continué de
 * relancer leurs lectures en rafale (~13 requêtes/s depuis un seul navigateur), ce qui empêche une base redémarrée
 * à froid de reprendre. Ce module ajoute deux protections, sans changer le moindre appel côté écrans :
 *
 *  1. Disjoncteur : après quelques échecs transitoires consécutifs (502/503/504/521/522/523/524 ou coupure réseau),
 *     les LECTURES sont refusées tout de suite (503 local, sans toucher le réseau) pendant un délai qui double à chaque
 *     échec (2 s → 30 s). Une seule lecture « sonde » passe ensuite ; si elle réussit, tout reprend.
 *  2. Fusion des doublons : deux lectures identiques (même URL, mêmes en-têtes) lancées en même temps ne font
 *     qu'un seul appel réseau.
 *
 * Les écritures (insert/update/delete) et les appels hors `/rest/v1/` (auth, storage, fonctions) passent toujours :
 * ils ne sont jamais bloqués, leur résultat alimente seulement le compteur d'échecs.
 */

const TRANSIENT_STATUSES = new Set([502, 503, 504, 521, 522, 523, 524]);

export interface ResilientFetchOptions {
  /** Échecs consécutifs avant ouverture du disjoncteur. */
  failureThreshold?: number;
  /** Premier délai de refus (ms). Doublé à chaque échec supplémentaire. */
  baseDelayMs?: number;
  /** Plafond du délai (ms). */
  maxDelayMs?: number;
  /** Horloge injectable (tests). */
  now?: () => number;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** Lecture = GET/HEAD sur l'API REST, ou RPC `get_*` (convention du projet pour les RPC en lecture seule). */
function isGuardedRead(url: string, method: string): boolean {
  const idx = url.indexOf("/rest/v1/");
  if (idx === -1) return false;
  if (method === "GET" || method === "HEAD") return true;
  if (method === "POST") {
    const path = url.slice(idx + "/rest/v1/".length);
    return path.startsWith("rpc/get_");
  }
  return false;
}

export function createResilientFetch(baseFetch: FetchLike, options: ResilientFetchOptions = {}): FetchLike {
  const threshold = options.failureThreshold ?? 3;
  const baseDelay = options.baseDelayMs ?? 2_000;
  const maxDelay = options.maxDelayMs ?? 30_000;
  const now = options.now ?? Date.now;

  let failures = 0;
  let openUntil = 0;
  let probing = false;
  const inflight = new Map<string, Promise<Response>>();

  const recordFailure = () => {
    failures += 1;
    if (failures >= threshold) {
      const delay = Math.min(maxDelay, baseDelay * 2 ** (failures - threshold));
      openUntil = now() + delay;
    }
  };
  const recordSuccess = () => {
    failures = 0;
    openUntil = 0;
  };

  const circuitOpenResponse = () => {
    const retryAfter = Math.max(1, Math.ceil((openUntil - now()) / 1000));
    return new Response(
      JSON.stringify({ code: "CIRCUIT_OPEN", message: "Service temporairement indisponible, nouvelle tentative automatique." }),
      { status: 503, headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter) } },
    );
  };

  // Appel réseau + comptage des échecs transitoires.
  const track = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      const res = await baseFetch(input, init);
      if (TRANSIENT_STATUSES.has(res.status)) recordFailure();
      else recordSuccess();
      return res;
    } catch (err) {
      // Une requête annulée volontairement n'est pas une panne.
      if (!(err instanceof DOMException && err.name === "AbortError")) recordFailure();
      throw err;
    }
  };

  return async (input, init) => {
    const url = urlOf(input);
    const method = (init?.method ?? (typeof input === "object" && !(input instanceof URL) ? input.method : "GET")).toUpperCase();

    if (!isGuardedRead(url, method)) return track(input, init);

    // Disjoncteur ouvert : refus immédiat, sauf une unique sonde une fois le délai écoulé.
    if (failures >= threshold) {
      if (now() < openUntil || probing) return circuitOpenResponse();
      probing = true;
      try {
        return await track(input, init);
      } finally {
        probing = false;
      }
    }

    // Fusion des lectures identiques simultanées (pas pour les requêtes annulables ni les objets Request).
    const canCoalesce = typeof input === "string" || input instanceof URL;
    if (!canCoalesce || init?.signal || init?.body) return track(input, init);

    const headers = Array.from(new Headers(init?.headers).entries()).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const key = `${method} ${url} ${JSON.stringify(headers)}`;

    let pending = inflight.get(key);
    if (!pending) {
      pending = track(input, init).finally(() => inflight.delete(key));
      inflight.set(key, pending);
    }
    // Chaque appelant lit sa propre copie : un corps ne peut être consommé qu'une fois.
    return (await pending).clone();
  };
}

/** Instance partagée, branchée sur le `fetch` global (résolu à chaque appel). */
export const resilientFetch: FetchLike = createResilientFetch((input, init) => globalThis.fetch(input, init));
