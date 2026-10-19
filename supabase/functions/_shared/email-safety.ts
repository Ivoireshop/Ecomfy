// Helpers purs pour construire des e-mails HTML sûrs (aucune dépendance Deno : testables sous Node).

/** Échappe une valeur avant insertion dans un gabarit HTML (texte ou valeur d'attribut entre guillemets). */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const EMAIL_RE = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;

export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 255 && EMAIL_RE.test(value);
}

const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export function isValidHostname(value: unknown): value is string {
  return typeof value === "string" && HOSTNAME_RE.test(value);
}

/**
 * Renvoie l'origine (schéma + hôte) de `candidate` si elle figure dans `allowed`, sinon `fallback`.
 * Empêche qu'un appelant fasse pointer les liens d'un e-mail vers un domaine qu'il contrôle.
 */
export function pickAllowedOrigin(candidate: unknown, allowed: string[], fallback: string): string {
  if (typeof candidate !== "string") return fallback;
  let origin: string;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") return fallback;
    origin = url.origin;
  } catch {
    return fallback;
  }
  const normalized = allowed.map((a) => a.trim().replace(/\/+$/, "").toLowerCase()).filter(Boolean);
  return normalized.includes(origin.toLowerCase()) ? origin : fallback;
}
