/**
 * Détection des pages publiques de boutique, servies par un chargement allégé.
 *
 * Le trafic des publicités (Facebook, TikTok, Google) arrive sur la fiche produit ou la vitrine d'une
 * boutique. Ces visiteurs n'ont pas besoin du tableau de bord, de la barre latérale, de la page
 * d'accueil Ecomfy, de l'internationalisation ni du client de requêtes : tout cela pesait plus de 280 Ko
 * compressés dans le fichier principal. `main.tsx` choisit donc, d'après l'URL, entre `ShopApp`
 * (boutique) et `App` (le reste du site).
 *
 * Ce fichier ne doit rien importer : il est chargé par le point d'entrée avant tout le reste.
 */

export type LeanShopKind = "product" | "shop" | "order";

/** Domaines d'Ecomfy ou d'hébergement : tout autre nom d'hôte est la boutique d'un marchand (domaine personnalisé). */
const MAIN_DOMAINS = ["ecomfy.cloud", "localhost", "127.0.0.1"];
const HOSTING_SUFFIXES = [".vercel.app", ".netlify.app", ".onrender.com", ".pages.dev"];

export function isCustomShopHostname(hostname: string, isDev = false): boolean {
  // En développement (Vite), la page d'accueil et le tableau de bord doivent rester accessibles.
  if (isDev) return false;
  const host = (hostname || "").toLowerCase().replace(/^www\./, "");
  if (!host) return false;
  if (MAIN_DOMAINS.includes(host)) return false;
  if (HOSTING_SUFFIXES.some((s) => host.endsWith(s))) return false;
  return true;
}

/**
 * Renvoie le type de page publique de boutique pour cette URL, ou `null` si c'est une page du site complet.
 * - `/shop/:slug/p/:produit` et `/shop/:slug/product` : fiche produit
 * - `/shop/:slug`, et `/` sur un domaine personnalisé : vitrine
 * - `/order-confirmed` : confirmation de commande (atteinte depuis la fiche, l'état du routeur doit survivre)
 * Les aperçus (`/shop-preview/...`) exigent une connexion : ils restent dans le site complet.
 */
export function getLeanShopKind(pathname: string, hostname: string, isDev = false): LeanShopKind | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (/^\/shop\/[^/]+\/p\/[^/]+$/.test(path) || /^\/shop\/[^/]+\/product$/.test(path)) return "product";
  if (/^\/shop\/[^/]+$/.test(path)) return "shop";
  if (path === "/order-confirmed") return "order";
  if (path === "/" && isCustomShopHostname(hostname, isDev)) return "shop";
  return null;
}
