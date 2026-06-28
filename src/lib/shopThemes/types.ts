export type ShopThemeSlug =
  | "classic-shop"
  | "fashion-shop"
  | "beauty-shop"
  | "tech-shop"
  | "luxury-shop"
  | "mobile-first-shop"
  | "landing-shop";

export interface ShopThemeProduct {
  id: string;
  name: string;
  slug?: string | null;
  price: number;
  compare_at_price?: number | null;
  currency?: string | null;
  short_description?: string | null;
  product_images?: { image_url: string; is_primary?: boolean }[];
  is_featured?: boolean;
  category?: string | null;
}

export interface ShopThemeData {
  shop: any;
  products: ShopThemeProduct[];
  primaryColor: string;
  currency: string;
  baseUrl: string;
  productHref: (p: ShopThemeProduct) => string;
  isPreview: boolean;
  customSettings: Record<string, any>;
}

export interface ShopThemeProps {
  data: ShopThemeData;
}

export interface ShopThemeMeta {
  slug: ShopThemeSlug;
  name: string;
  category: string;
  description: string;
  preview?: string;
}