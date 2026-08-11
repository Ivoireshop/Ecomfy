import DOMPurify from "dompurify";
import type { ProductAudio, ProductThemeSettings } from "@/lib/productAppearance";
import type { ThemeData } from "./types";

function safeNum(n: any): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function buildWhatsappUrl(phone: string | null, message: string): string | null {
  if (!phone) return null;
  const clean = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (!clean) return null;
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

function parseFAQ(product: any): { q: string; a: string }[] {
  const raw = product?.faq || product?.faqs || product?.questions_answers;
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((it: any) => ({
        q: String(it?.question || it?.q || "").trim(),
        a: String(it?.answer || it?.a || "").trim(),
      }))
      .filter((x) => x.q && x.a);
  }
  return [];
}

function parseBenefits(product: any): string[] {
  const raw =
    product?.benefits ||
    product?.key_benefits ||
    product?.features ||
    product?.highlights;
  if (Array.isArray(raw)) {
    return raw.map((b: any) => String(typeof b === "string" ? b : b?.text || b?.label || "")).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(/[\n•·\-]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1)
      .slice(0, 8);
  }
  return [];
}

export function buildThemeData(input: {
  product: any;
  shop: any;
  audios: ProductAudio[];
  settings: ProductThemeSettings | null;
}): ThemeData {
  const { product, shop, audios, settings } = input;
  const images = product?.product_images || [];
  const primaryImage =
    images.find((i: any) => i.is_primary)?.image_url || images[0]?.image_url || shop?.logo_url || "";

  const price = safeNum(product?.price);
  const oldPrice =
    product?.compare_at_price && safeNum(product.compare_at_price) > price
      ? safeNum(product.compare_at_price)
      : null;
  const discount = oldPrice ? Math.round((1 - price / oldPrice) * 100) : 0;

  const currency = String(product?.currency || "XOF");
  const phone: string | null = shop?.whatsapp_number || shop?.phone || null;
  const phoneTel = phone ? phone.replace(/[^\d+]/g, "") : null;

  let productUrl = "";
  let classicCheckoutUrl = "?classic=1#order";
  
  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    productUrl = url.origin + url.pathname + url.search;
    url.searchParams.set("classic", "1");
    url.hash = "order";
    classicCheckoutUrl = url.toString();
  }

  const whatsappUrl = buildWhatsappUrl(
    phone,
    `Bonjour, je suis intéressé par "${product?.name}" — ${productUrl}`
  );

  const shortDescription = String(product?.short_description || "").trim();
  const longDescriptionRaw = String(product?.description || "").trim();
  const longDescriptionHTML = longDescriptionRaw
    ? DOMPurify.sanitize(longDescriptionRaw)
    : "";

  return {
    product,
    shop,
    images,
    audios,
    primaryImage,
    price,
    oldPrice,
    discount,
    currency,
    ctaText: settings?.custom_css_settings?.cta_text || "Commander maintenant",
    whatsappUrl,
    phoneTel,
    classicCheckoutUrl,
    productUrl,
    primaryColor: settings?.button_color || shop?.primary_color || "#EC4899",
    faq: parseFAQ(product),
    benefits: parseBenefits(product),
    shortDescription,
    longDescriptionHTML,
    settings,
  };
}

export function formatPrice(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " " + currency;
  } catch {
    return `${n} ${currency}`;
  }
}