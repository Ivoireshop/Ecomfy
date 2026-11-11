// Fonctions pures de invite-shop-collaborator (testées dans supabase/tests/invite-shop-collaborator.test.ts).

/** Échappe le texte inséré dans le HTML du mail (nom de boutique, adresse, libellés). */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Neutralise % _ \ pour une recherche `ilike` sur une valeur exacte (sinon « a_b@x.com » reconnaît « aXb@x.com »). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Origine utilisée pour le lien d'acceptation. L'en-tête Origin vient du client : sans liste blanche, un
 * propriétaire pourrait faire envoyer, depuis noreply@ecomfy.cloud, un lien vers n'importe quel site (hameçonnage).
 * Autorisées : APP_URL et la liste `extraAllowed` (secret INVITE_ALLOWED_ORIGINS, séparée par des virgules,
 * utile en dev / préproduction). Sinon : APP_URL.
 */
export function resolveInviteOrigin(requestOrigin: string | null, appUrl: string, extraAllowed = ""): string {
  const base = originOf(appUrl) ?? appUrl.replace(/\/+$/, "");
  const allowed = new Set<string>([base]);
  for (const item of extraAllowed.split(",")) {
    const o = originOf(item.trim());
    if (o) allowed.add(o);
  }
  const requested = requestOrigin ? originOf(requestOrigin) : null;
  return requested && allowed.has(requested) ? requested : base;
}

export const MAX_INVITES_PER_HOUR = 20;
export const MAX_COLLABORATORS_PER_SHOP = 50;
