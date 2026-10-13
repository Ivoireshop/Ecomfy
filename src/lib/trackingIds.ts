/**
 * Validation stricte des identifiants de suivi saisis par les marchands.
 * Ces valeurs finissent dans des URLs de scripts tiers et des appels de pixels :
 * tout ce qui ne correspond pas exactement au format attendu est ignoré (audit C8).
 */

const GA4_ID = /^G-[A-Z0-9]{4,20}$/;
const FACEBOOK_PIXEL_ID = /^\d{5,20}$/;
const TIKTOK_PIXEL_ID = /^[A-Z0-9]{8,32}$/i;
const SNAPCHAT_PIXEL_ID = /^[A-Za-z0-9-]{8,64}$/;

export const isValidGa4Id = (v: unknown): v is string => typeof v === "string" && GA4_ID.test(v);
export const isValidFacebookPixelId = (v: unknown): v is string => typeof v === "string" && FACEBOOK_PIXEL_ID.test(v);
export const isValidTiktokPixelId = (v: unknown): v is string => typeof v === "string" && TIKTOK_PIXEL_ID.test(v);
export const isValidSnapchatPixelId = (v: unknown): v is string => typeof v === "string" && SNAPCHAT_PIXEL_ID.test(v);

/**
 * Extrait un identifiant GA4 (G-XXXXXXX) d'un texte collé par le marchand, par exemple
 * le snippet gtag complet. Seul l'identifiant extrait est utilisé : le reste du texte
 * n'est jamais injecté dans la page. Renvoie null si aucun identifiant valide n'est trouvé.
 */
export function extractGa4Id(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const match = input.match(/(?<![A-Za-z0-9-])G-[A-Z0-9]{4,20}(?![A-Za-z0-9-])/i);
  if (!match) return null;
  const id = match[0].toUpperCase();
  return isValidGa4Id(id) ? id : null;
}
