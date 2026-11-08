export interface LinkMetadata {
  url: string;
  domain: string;
  title: string;
  description?: string;
  image?: string;
  isEcomfyLink?: boolean;
  ecomfyShopSlug?: string;
  ecomfyProductId?: string;
}

/** Ajoute https:// aux liens saisis sans protocole (eudiasse.com -> https://eudiasse.com). */
export function formatExternalUrl(url?: string | null): string {
  if (!url || !url.trim()) return "#";
  const trimmed = url.trim();
  if (trimmed.startsWith("/") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

// Un lien = http(s)://…, www.… ou un nom de domaine suivi d'une extension courante.
// (Sans cette liste, « fin.Ensuite » ou « ok.Merci » étaient pris pour des sites.)
const URL_REGEX =
  /(?:https?:\/\/[^\s]+|www\.[^\s]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|co|ci|fr|app|shop|cloud|store|me|info|biz|africa|dev|xyz)\b(?:\/[^\s]*)?)/gi;

export function extractUrlsFromText(text: string): string[] {
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  const cleaned = matches.map((m) => m.replace(/[.,;:!?)\]]+$/, ""));
  return Array.from(new Set(cleaned)).map((url) => formatExternalUrl(url));
}

/**
 * Carte d'aperçu d'un lien. Le navigateur ne peut pas lire la page d'un autre site (CORS) : on n'affiche donc
 * que ce qui est connu avec certitude (le domaine et l'adresse), sans image ni description inventées.
 */
export function parseUrlMetadata(urlInput: string): LinkMetadata {
  const url = formatExternalUrl(urlInput);
  try {
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname.replace(/^www\./, "");
    const pathParts = parsedUrl.pathname.split("/").filter(Boolean);

    const shopIndex = pathParts.indexOf("shop");
    const ecomfyShopSlug = shopIndex >= 0 ? pathParts[shopIndex + 1] : undefined;
    const ecomfyProductId = parsedUrl.searchParams.get("product") || parsedUrl.searchParams.get("id") || undefined;
    const isEcomfyDomain = domain.includes("ecomfy") || domain === "localhost" || domain === "127.0.0.1";

    if (isEcomfyDomain && (ecomfyShopSlug || ecomfyProductId)) {
      return {
        url,
        domain,
        title: ecomfyProductId && !ecomfyShopSlug ? "Produit Ecomfy" : `Boutique Ecomfy · ${ecomfyShopSlug}`,
        description: "Ouvrir la boutique sur Ecomfy",
        isEcomfyLink: true,
        ecomfyShopSlug,
        ecomfyProductId,
      };
    }

    return {
      url,
      domain,
      title: domain,
      description: parsedUrl.pathname.length > 1 ? `${domain}${parsedUrl.pathname}`.slice(0, 120) : undefined,
      isEcomfyLink: false,
    };
  } catch {
    return { url, domain: "web", title: "Lien partagé", isEcomfyLink: false };
  }
}
