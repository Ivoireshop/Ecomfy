// @ts-nocheck
/**
 * Nouvelle tentative contrôlée pour les appels IA payants (Studio).
 *
 * Avant : `generate-ai-image` enchaînait jusqu'à 3 modèles × (édition + génération) = 6 appels OpenAI facturables pour un
 * seul clic, sans délai maximal et sans distinguer une panne passagère (à retenter) d'un refus définitif (contenu refusé,
 * clé invalide, compte sans solde) qu'il est inutile et coûteux de répéter.
 *
 * Ici : un budget TOTAL d'appels par requête, un délai maximal par appel, et une classification de l'échec qui décide
 * de la suite :
 *   - retryable         : panne passagère (429 de débit, 5xx, délai dépassé) -> même modèle, après une attente ;
 *   - model_unavailable : modèle inconnu ou non autorisé pour ce compte      -> modèle suivant ;
 *   - fatal             : refus définitif                                    -> on s'arrête tout de suite.
 *
 * Module pur (aucun import, aucun accès réseau ou base hors `fetch` passé par l'appelant) : testé avec vitest.
 */

export type FailureKind = "retryable" | "model_unavailable" | "fatal";

export interface Failure {
  kind: FailureKind;
  /** Code stable, enregistré dans ai_generation_log.error_code et renvoyé au client. */
  code: string;
  status: number;
  detail: string;
}

export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_ATTEMPT_TIMEOUT_MS = 90_000;
export const DEFAULT_BASE_DELAY_MS = 1_500;

/** Classe une réponse d'erreur OpenAI. `status` vaut 0 pour une erreur réseau, -1 pour un délai dépassé. */
export function classifyOpenAiFailure(status: number, bodyText: string): Failure {
  const body = (bodyText || "").toLowerCase();
  const detail = (bodyText || "").slice(0, 300);
  const f = (kind: FailureKind, code: string): Failure => ({ kind, code, status, detail });

  if (status === -1) return f("retryable", "timeout");
  if (status === 0) return f("retryable", "network");

  if (status === 401) return f("fatal", "provider_auth");
  if (status === 402) return f("fatal", "provider_quota");

  if (status === 429) {
    // « insufficient_quota » = le compte OpenAI n'a plus de solde : réessayer ne sert à rien.
    if (body.includes("insufficient_quota") || body.includes("billing")) return f("fatal", "provider_quota");
    return f("retryable", "rate_limited");
  }

  if (status >= 500) return f("retryable", "provider_error");

  if (
    status === 404 ||
    body.includes("model_not_found") ||
    body.includes("does not exist") ||
    body.includes("must be verified") ||
    body.includes("do not have access to the model") ||
    body.includes("does not have access to model")
  ) {
    return f("model_unavailable", "model_unavailable");
  }

  if (
    body.includes("content_policy") ||
    body.includes("moderation_blocked") ||
    body.includes("safety system") ||
    body.includes("safety_violations")
  ) {
    return f("fatal", "content_policy");
  }

  return f("fatal", "bad_request");
}

/** Message affichable à l'utilisateur pour un code d'échec. Jamais de détail technique du fournisseur. */
export function userMessageForFailure(code: string): string {
  switch (code) {
    case "content_policy":
      return "Cette demande a été refusée par le filtre de sécurité de l'IA. Reformulez votre description ou changez d'image.";
    case "rate_limited":
    case "timeout":
    case "network":
    case "provider_error":
      return "Le service de génération est momentanément surchargé. Votre crédit n'a pas été débité, réessayez dans un instant.";
    case "provider_quota":
    case "provider_auth":
      return "Le service de génération est indisponible pour le moment. Votre crédit n'a pas été débité. L'équipe Ecomfy est prévenue.";
    case "model_unavailable":
      return "Le moteur de génération n'est pas disponible pour le moment. Votre crédit n'a pas été débité.";
    default:
      return "La génération n'a pas pu aboutir. Votre crédit n'a pas été débité, vérifiez votre demande puis réessayez.";
  }
}

/** Les échecs qui indiquent un problème de notre côté (clé, solde, modèle) : à remonter à l'équipe, pas à l'utilisateur. */
export function isOperatorAlertCode(code: string): boolean {
  return code === "provider_quota" || code === "provider_auth" || code === "model_unavailable";
}

/**
 * `fetch` avec délai maximal. Ne lève jamais : renvoie {status, text} où status vaut 0 (réseau) ou -1 (délai).
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_ATTEMPT_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; text: string; json: () => any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { ...init, signal: controller.signal });
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      text,
      json: () => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      },
    };
  } catch (e) {
    const aborted = e?.name === "AbortError";
    return { ok: false, status: aborted ? -1 : 0, text: String(e?.message || e), json: () => null };
  } finally {
    clearTimeout(timer);
  }
}

export type AttemptOutcome<T> = { ok: true; value: T } | { ok: false; failure: Failure };

export interface RetryReport<T> {
  ok: boolean;
  value?: T;
  /** Modèle qui a répondu (succès) ou dernier modèle essayé (échec). */
  model: string | null;
  /** Nombre d'appels réellement envoyés au fournisseur. */
  attempts: number;
  failure?: Failure;
  /** Un code par appel raté, dans l'ordre : sert au diagnostic. */
  trail: string[];
}

export interface RetryOptions {
  /** Budget total d'appels pour la requête, tous modèles confondus. */
  maxAttempts?: number;
  baseDelayMs?: number;
  /**
   * Heure limite absolue (Date.now() + budget). Une Edge Function est coupée côté client au bout de ~150 s : on
   * n'ouvre pas de nouvel appel s'il reste moins de `minAttemptMs`, il serait payé sans que personne n'en reçoive le résultat.
   */
  deadlineAt?: number;
  minAttemptMs?: number;
  /** Injectable pour les tests. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

/**
 * Exécute `call(model)` selon la politique ci-dessus.
 * `models` est l'ordre de préférence ; on ne passe au modèle suivant que si le courant est indisponible.
 */
export async function runWithRetry<T>(
  models: string[],
  call: (model: string, attemptNo: number, remainingMs: number) => Promise<AttemptOutcome<T>>,
  opts: RetryOptions = {},
): Promise<RetryReport<T>> {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const baseDelay = opts.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = opts.now ?? Date.now;
  const deadlineAt = opts.deadlineAt ?? Infinity;
  const minAttemptMs = opts.minAttemptMs ?? 20_000;

  const trail: string[] = [];
  let modelIdx = 0;
  let attempts = 0;
  let retriesOnModel = 0;
  let last: Failure | undefined;

  while (attempts < maxAttempts && modelIdx < models.length) {
    if (attempts > 0 && deadlineAt - now() < minAttemptMs) break;
    const model = models[modelIdx];
    attempts++;
    const out = await call(model, attempts, deadlineAt - now());
    if (out.ok) return { ok: true, value: out.value, model, attempts, trail };

    last = out.failure;
    trail.push(last.code);

    if (last.kind === "fatal") break;

    if (last.kind === "model_unavailable") {
      modelIdx++;
      retriesOnModel = 0;
      continue;
    }

    // retryable : attente exponentielle (1,5 s, 3 s, …) plus un peu d'aléa pour ne pas rejouer en rafale.
    retriesOnModel++;
    if (attempts < maxAttempts) {
      await sleep(baseDelay * 2 ** (retriesOnModel - 1) + Math.floor(Math.random() * 300));
    }
  }

  return { ok: false, model: models[Math.min(modelIdx, models.length - 1)] ?? null, attempts, failure: last, trail };
}
