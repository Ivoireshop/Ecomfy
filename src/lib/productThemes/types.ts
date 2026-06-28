import type { ProductAudio, ProductThemeSettings } from "@/lib/productAppearance";

export type ThemeSlug =
  | "classic-premium"
  | "landing-ad"
  | "health-wellness"
  | "luxury-dark"
  | "storytelling"
  | "mobile-first"
  | "promo-offer";

export interface ThemeData {
  product: any;
  shop: any;
  images: { image_url: string; is_primary?: boolean }[];
  audios: ProductAudio[];
  primaryImage: string;
  price: number;
  oldPrice: number | null;
  discount: number;
  currency: string;
  ctaText: string;
  whatsappUrl: string | null;
  phoneTel: string | null;
  classicCheckoutUrl: string;
  productUrl: string;
  primaryColor: string;
  faq: { q: string; a: string }[];
  benefits: string[];
  shortDescription: string;
  longDescriptionHTML: string;
  settings: ProductThemeSettings | null;
}

export interface ThemeProps {
  data: ThemeData;
}

export interface ThemeMeta {
  slug: ThemeSlug;
  name: string;
  category: string;
  description: string;
}