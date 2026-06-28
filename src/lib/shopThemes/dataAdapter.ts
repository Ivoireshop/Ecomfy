import type { ShopThemeData, ShopThemeProduct } from "./types";

export function formatPrice(n: number, currency = "XOF") {
  try {
    return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " " + currency;
  } catch {
    return `${n} ${currency}`;
  }
}

export function buildShopThemeData(input: {
  shop: any;
  products: any[];
  customSettings?: Record<string, any> | null;
}): ShopThemeData {
  const { shop, products, customSettings } = input;
  const isPreview = !!shop?._isPreview;
  const baseUrl = isPreview ? `/shop-preview/${shop.id}` : `/shop/${shop.slug}`;
  const primaryColor =
    customSettings?.primary_color || shop?.primary_color || "#EC4899";
  const currency = (products[0]?.currency as string) || "XOF";

  const productHref = (p: ShopThemeProduct) =>
    p.slug ? `${baseUrl}/p/${p.slug}` : `${baseUrl}/product?product=${p.id}`;

  return {
    shop,
    products: (products || []) as ShopThemeProduct[],
    primaryColor,
    currency,
    baseUrl,
    productHref,
    isPreview,
    customSettings: customSettings || {},
  };
}

export function getPrimaryImage(p: ShopThemeProduct): string {
  const imgs = p.product_images || [];
  return (
    imgs.find((i) => i.is_primary)?.image_url ||
    imgs[0]?.image_url ||
    "/placeholder.svg"
  );
}