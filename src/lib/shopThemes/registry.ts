import { lazy } from "react";
import type { ComponentType } from "react";
import type { ShopThemeMeta, ShopThemeProps, ShopThemeSlug } from "./types";
import classicPreview from "@/assets/themes/classic-shop.jpg";
import fashionPreview from "@/assets/themes/fashion-shop.jpg";
import beautyPreview from "@/assets/themes/beauty-shop.jpg";
import techPreview from "@/assets/themes/tech-shop.jpg";
import luxuryPreview from "@/assets/themes/luxury-shop.jpg";
import mobileFirstPreview from "@/assets/themes/mobile-first-shop.jpg";
import landingPreview from "@/assets/themes/landing-shop.jpg";

type ThemeEntry = {
  meta: ShopThemeMeta;
  Component: ComponentType<ShopThemeProps>;
};

export const SHOP_THEME_REGISTRY: Record<ShopThemeSlug, ThemeEntry> = {
  "classic-shop": {
    meta: {
      slug: "classic-shop",
      name: "Classic",
      category: "general",
      description: "Design polyvalent, propre et professionnel — adapté à toutes les boutiques.",
      preview: classicPreview,
    },
    Component: lazy(() => import("./themes/ClassicShop")),
  },
  "fashion-shop": {
    meta: {
      slug: "fashion-shop",
      name: "Fashion",
      category: "mode",
      description: "Élégant et éditorial — pensé pour la mode, les sacs et les accessoires.",
      preview: fashionPreview,
    },
    Component: lazy(() => import("./themes/FashionShop")),
  },
  "beauty-shop": {
    meta: {
      slug: "beauty-shop",
      name: "Beauty",
      category: "beaute",
      description: "Doux et rassurant — idéal pour cosmétiques, soins et bien-être.",
      preview: beautyPreview,
    },
    Component: lazy(() => import("./themes/BeautyShop")),
  },
  "tech-shop": {
    meta: {
      slug: "tech-shop",
      name: "Tech",
      category: "tech",
      description: "Moderne et structuré — pour produits électroniques et high-tech.",
      preview: techPreview,
    },
    Component: lazy(() => import("./themes/TechShop")),
  },
  "luxury-shop": {
    meta: {
      slug: "luxury-shop",
      name: "Luxury",
      category: "premium",
      description: "Haut de gamme et raffiné — visuels larges et ambiance élégante.",
      preview: luxuryPreview,
    },
    Component: lazy(() => import("./themes/LuxuryShop")),
  },
  "mobile-first-shop": {
    meta: {
      slug: "mobile-first-shop",
      name: "Mobile First",
      category: "mobile",
      description: "Conçu d'abord pour téléphone — rapide, boutons visibles, navigation simple.",
      preview: mobileFirstPreview,
    },
    Component: lazy(() => import("./themes/MobileFirstShop")),
  },
  "landing-shop": {
    meta: {
      slug: "landing-shop",
      name: "Landing",
      category: "conversion",
      description: "Orienté publicité — appels à l'action forts et offres en avant.",
      preview: landingPreview,
    },
    Component: lazy(() => import("./themes/LandingShop")),
  },
};

export const SHOP_THEME_LIST = Object.values(SHOP_THEME_REGISTRY).map((e) => e.meta);

export function getShopTheme(slug: string | null | undefined) {
  if (!slug) return null;
  return SHOP_THEME_REGISTRY[slug as ShopThemeSlug] || null;
}