import { lazy, type LazyExoticComponent, type ComponentType } from "react";
import type { ThemeMeta, ThemeProps, ThemeSlug } from "./types";

type LazyTheme = LazyExoticComponent<ComponentType<ThemeProps>>;

export const THEME_REGISTRY: Record<ThemeSlug, { meta: ThemeMeta; component: LazyTheme }> = {
  "classic-premium": {
    meta: { slug: "classic-premium", name: "Classique Premium", category: "general", description: "Sobre, moderne, adapté à tous les produits." },
    component: lazy(() => import("./themes/classic-premium")),
  },
  "landing-ad": {
    meta: { slug: "landing-ad", name: "Landing Page Publicitaire", category: "conversion", description: "Orienté conversion publicitaire Facebook / TikTok." },
    component: lazy(() => import("./themes/landing-ad")),
  },
  "health-wellness": {
    meta: { slug: "health-wellness", name: "Santé & Bien-être", category: "wellness", description: "Rassurant pour produits naturels, beauté, santé." },
    component: lazy(() => import("./themes/health-wellness")),
  },
  "luxury-dark": {
    meta: { slug: "luxury-dark", name: "Luxe Premium", category: "luxury", description: "Élégant, sombre, espaces larges, raffiné." },
    component: lazy(() => import("./themes/luxury-dark")),
  },
  storytelling: {
    meta: { slug: "storytelling", name: "Storytelling Produit", category: "story", description: "Raconte l'histoire de transformation." },
    component: lazy(() => import("./themes/storytelling")),
  },
  "mobile-first": {
    meta: { slug: "mobile-first", name: "Mobile First", category: "mobile", description: "Optimisé téléphone, CTA toujours visible." },
    component: lazy(() => import("./themes/mobile-first")),
  },
  "promo-offer": {
    meta: { slug: "promo-offer", name: "Offre Spéciale", category: "promo", description: "Pour promotions, urgence, stock limité." },
    component: lazy(() => import("./themes/promo-offer")),
  },
};

export function isKnownTheme(slug: string | null | undefined): slug is ThemeSlug {
  return !!slug && slug in THEME_REGISTRY;
}

export const THEME_SLUGS: ThemeSlug[] = Object.keys(THEME_REGISTRY) as ThemeSlug[];