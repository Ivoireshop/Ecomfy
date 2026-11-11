// Lecture des erreurs renvoyées par les Edge Functions (audit M3).
//
// Les fonctions répondent désormais avec le vrai code HTTP (401, 403, 429…). `supabase.functions.invoke` met alors
// `data` à null et `error` à une FunctionsHttpError dont le message est « Edge Function returned a non-2xx status
// code » : inutilisable pour l'utilisateur. Le texte utile est dans le corps de la réponse (`error.context`).
// `readFunctionError` le retrouve, et reste compatible avec les anciennes réponses 200 + { success: false }.

const STATUS_MESSAGES: Record<number, string> = {
  400: "Demande invalide. Vérifiez les informations saisies.",
  401: "Votre session a expiré. Reconnectez-vous puis réessayez.",
  403: "Vous n'avez pas le droit d'effectuer cette action.",
  404: "Élément introuvable.",
  409: "Cette action est déjà en cours ou a déjà été effectuée.",
  429: "Trop de tentatives. Patientez un instant avant de réessayer.",
};

/** Message générique pour un code HTTP, jamais le texte technique de la bibliothèque. */
export function messageForStatus(status: number | undefined, fallback: string): string {
  if (status && STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
  return fallback;
}

function textOf(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

/**
 * @param error    `error` renvoyé par `supabase.functions.invoke`
 * @param data     `data` renvoyé par `supabase.functions.invoke` (corps d'une réponse 2xx)
 * @param fallback message affiché si le serveur n'en donne pas
 */
export async function readFunctionError(error: unknown, data: unknown, fallback: string): Promise<string> {
  const fromData = textOf((data as { error?: unknown } | null | undefined)?.error);
  if (fromData) return fromData;

  const context = (error as { context?: unknown } | null | undefined)?.context;
  if (context && typeof context === "object") {
    const res = context as { status?: number; clone?: () => { json: () => Promise<unknown> }; json?: () => Promise<unknown> };
    try {
      // clone() : le corps d'une Response ne se lit qu'une fois, un autre appelant peut vouloir le relire.
      const body = (await (res.clone ? res.clone() : res).json?.()) as { error?: unknown } | undefined;
      const fromBody = textOf(body?.error);
      if (fromBody) return fromBody;
    } catch {
      // corps absent ou non JSON : on retombe sur le code HTTP
    }
    return messageForStatus(res.status, fallback);
  }
  return fallback;
}
