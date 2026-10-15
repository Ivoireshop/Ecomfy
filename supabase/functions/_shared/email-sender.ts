// Identité d'expédition unique pour tous les mails envoyés directement via Resend.
// Le domaine ecomfy.cloud doit être vérifié dans Resend (SPF/DKIM).
export const BRAND_NAME = "Ecomfy";
// URL publique de l'application (secret Supabase APP_URL), utilisée pour les liens dans les mails.
export const APP_URL = (Deno.env.get("APP_URL") || "https://ecomfy.cloud").replace(/\/+$/, "");
export const NOREPLY_ADDRESS = "noreply@ecomfy.cloud";
export const SUPPORT_ADDRESS = "support@ecomfy.cloud";
export const REPLY_TO_ADDRESS = "contact@ecomfy.cloud";

/** Construit un en-tête From, ex. senderFrom("Ecomfy Réservations") → "Ecomfy Réservations <noreply@ecomfy.cloud>" */
export const senderFrom = (label: string = BRAND_NAME, address: string = NOREPLY_ADDRESS) =>
  `${label} <${address}>`;

// --- Garde-fou d'envoi (dev / recette) ------------------------------------------------------
// EMAIL_MODE : "live" (défaut, envoi normal) | "redirect" (tout part vers EMAIL_REDIRECT_TO) | "off" (aucune livraison).
// Toute autre valeur, ou "redirect" sans EMAIL_REDIRECT_TO, neutralise l'envoi : mieux vaut un mail perdu
// qu'un vrai client contacté depuis un environnement de test.
export const EMAIL_MODE = (Deno.env.get("EMAIL_MODE") || "live").trim().toLowerCase();
const EMAIL_REDIRECT_TO = (Deno.env.get("EMAIL_REDIRECT_TO") || "").trim();
// Adresse "puits" de Resend : accepte le mail sans le livrer à personne.
const SINK_ADDRESS = "delivered@resend.dev";

/** true quand aucun mail ne doit réellement partir (mode off, ou configuration invalide). */
export const isEmailSuppressed = () =>
  EMAIL_MODE === "off" ||
  (EMAIL_MODE !== "live" && !(EMAIL_MODE === "redirect" && EMAIL_REDIRECT_TO));

/**
 * Applique le mode d'envoi. À étaler dans l'appel Resend : `{ from, ...guardEmail([x], subject), html }`.
 * En redirection, le sujet est préfixé par les destinataires d'origine.
 */
export function guardEmail(to: string | string[], subject: string): { to: string[]; subject: string } {
  const original = Array.isArray(to) ? to : [to];
  if (EMAIL_MODE === "live") return { to: original, subject };

  const prefixed = `[→ ${original.join(", ")}] ${subject}`;
  if (isEmailSuppressed()) {
    console.warn(`[email-guard] mode=${EMAIL_MODE} : mail neutralisé (destinataires d'origine : ${original.join(", ")})`);
    return { to: [SINK_ADDRESS], subject: prefixed };
  }
  console.warn(`[email-guard] redirection de ${original.join(", ")} vers ${EMAIL_REDIRECT_TO}`);
  return { to: [EMAIL_REDIRECT_TO], subject: prefixed };
}
