// src/lib/seoShop.ts
// Helpers partagés par le module SEO Intelligence : accès aux tables shop_seo_*,
// champs réels de la boutique (business_name, seo_title...) et URLs publiques.

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Les tables shop_seo_* ne figurent pas encore dans les types générés par Supabase.
export const seoDb = supabase as unknown as SupabaseClient<any>;

export const PLATFORM_HOST = "ecomfy.cloud";

/** Longueurs recommandées, utilisées à la fois par l'audit et par l'éditeur de balises. */
export const SEO_LIMITS = {
  titleMin: 30,
  titleMax: 65,
  descMin: 70,
  descMax: 160,
  productDescMin: 50,
} as const;

export function getShopName(shop: any): string {
  return shop?.business_name || shop?.name || "Ma boutique";
}

/** Titre réellement servi par la boutique : seo_title, sinon le nom. */
export function getEffectiveShopTitle(shop: any): string {
  return String(shop?.seo_title || getShopName(shop) || "").trim();
}

/** Description réellement servie par la boutique : seo_description, sinon la description commerciale. */
export function getEffectiveShopDescription(shop: any): string {
  return String(shop?.seo_description || shop?.business_description || shop?.description || "").trim();
}

/** verify-domain-dns enregistre « active » une fois le DNS vérifié (« verified » n'existe que côté assistant). */
export function isDomainActive(shop: any): boolean {
  return shop?.domain_status === "active" || shop?.domain_status === "verified";
}

function hasVerifiedCustomDomain(shop: any): boolean {
  return !!shop?.custom_domain && isDomainActive(shop);
}

/** Hôte affiché pour la boutique (domaine personnalisé vérifié, sinon ecomfy.cloud). */
export function getShopDomain(shop: any): string {
  return hasVerifiedCustomDomain(shop) ? String(shop.custom_domain) : PLATFORM_HOST;
}

/** URL publique de la page d'accueil de la boutique. */
export function getShopHomeUrl(shop: any): string {
  if (hasVerifiedCustomDomain(shop)) return `https://${shop.custom_domain}/`;
  return `https://${PLATFORM_HOST}/shop/${shop?.slug || ""}`;
}

/** URL publique d'une fiche produit. */
export function getProductUrl(shop: any, product: any): string {
  const host = getShopDomain(shop);
  return `https://${host}/shop/${shop?.slug || ""}/p/${product?.slug || product?.id}`;
}

export function productImages(product: any): { image_url: string; alt_text: string | null }[] {
  const imgs = product?.product_images;
  return Array.isArray(imgs) ? imgs : [];
}
