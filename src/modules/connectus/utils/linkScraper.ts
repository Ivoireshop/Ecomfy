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

/**
 * Formats external URLs so they always open the real destination site (e.g. eudiasse.com -> https://eudiasse.com)
 */
export function formatExternalUrl(url?: string | null): string {
  if (!url || !url.trim()) return "#";
  const trimmed = url.trim();
  if (trimmed.startsWith("/") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Extracts URLs from text content
 */
export function extractUrlsFromText(text: string): string[] {
  const urlRegex = /((?:https?:\/\/|www\.)[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/g;
  const matches = text.match(urlRegex);
  if (!matches) return [];
  return Array.from(new Set(matches)).map(url => formatExternalUrl(url));
}

/**
 * Scrapes metadata from a given URL or generates clean OpenGraph preview card data
 */
export function parseUrlMetadata(urlInput: string, contentText?: string): LinkMetadata {
  const url = formatExternalUrl(urlInput);
  try {
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname.replace(/^www\./, "");

    // Check if URL is an Ecomfy shop / product link
    const isEcomfyDomain = domain.includes("ecomfy") || domain.includes("localhost") || domain.includes("127.0.0.1");
    const pathParts = parsedUrl.pathname.split("/").filter(Boolean);

    let ecomfyShopSlug: string | undefined;
    let ecomfyProductId: string | undefined;

    if (pathParts.includes("shop")) {
      const shopIndex = pathParts.indexOf("shop");
      if (pathParts[shopIndex + 1]) {
        ecomfyShopSlug = pathParts[shopIndex + 1];
      }
    }

    const searchParams = parsedUrl.searchParams;
    if (searchParams.has("product")) {
      ecomfyProductId = searchParams.get("product") || undefined;
    } else if (searchParams.has("id")) {
      ecomfyProductId = searchParams.get("id") || undefined;
    }

    if (isEcomfyDomain && (ecomfyShopSlug || ecomfyProductId)) {
      return {
        url,
        domain: "ecomfy.cloud",
        title: ecomfyShopSlug ? `Boutique Ecomfy : ${ecomfyShopSlug}` : "Produit Ecomfy",
        description: "Découvrez cet article sur la boutique officielle Ecomfy avec commande rapide WhatsApp et livraison.",
        image: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&auto=format&fit=crop&q=80",
        isEcomfyLink: true,
        ecomfyShopSlug,
        ecomfyProductId,
      };
    }

    // Default Web Link OpenGraph Metadata
    return {
      url,
      domain,
      title: contentText ? contentText.slice(0, 60) : `Lien externe sur ${domain}`,
      description: `Consultez le contenu partagé sur ${domain}`,
      image: "https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=800&auto=format&fit=crop&q=80",
      isEcomfyLink: false,
    };
  } catch (e) {
    return {
      url,
      domain: "web",
      title: "Lien partagé",
      isEcomfyLink: false,
    };
  }
}
