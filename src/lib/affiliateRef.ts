export const REF_STORAGE_KEY = "ecomfy_affiliate_ref";

/**
 * Garde le code d'un lien `?ref=` ouvert sur le site. Séparé du hook d'affiliation pour que les pages
 * publiques de boutique puissent le conserver sans charger le service d'affiliation.
 */
export function captureAffiliateRefFromUrl(): void {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && ref.trim()) {
      localStorage.setItem(REF_STORAGE_KEY, ref.trim().toUpperCase());
    }
  } catch {
    // storage unavailable: the code can still travel in the signup metadata
  }
}
