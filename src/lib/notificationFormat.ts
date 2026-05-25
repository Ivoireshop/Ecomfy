/**
 * Shared formatter for new-order notifications.
 * Used both on the client (foreground sound/voice/announcement) and mirrored
 * server-side in the send-push-notification edge function.
 *
 * IMPORTANT: keep the keys/templates in sync with
 * supabase/functions/send-push-notification/index.ts
 */

export type NotifLang = "fr" | "en" | "es" | "pt" | "ar";

export type NotifTemplate = "detailed" | "compact" | "minimal" | "custom";

export interface NotifSettings {
  enabled?: boolean;
  language?: NotifLang;
  template?: NotifTemplate;
  max_products?: number;            // 1..5
  custom_title?: string;            // used when template === "custom" (supports {shop})
  include_customer_name?: boolean;
  include_phone?: boolean;
  include_place?: boolean;
  include_total?: boolean;
  include_products?: boolean;
}

export const DEFAULT_NOTIF_SETTINGS: Required<NotifSettings> = {
  enabled: true,
  language: "fr",
  template: "detailed",
  max_products: 2,
  custom_title: "",
  include_customer_name: true,
  include_phone: true,
  include_place: true,
  include_total: true,
  include_products: true,
};

export function mergeNotifSettings(raw: any): Required<NotifSettings> {
  const s = (raw && typeof raw === "object") ? raw : {};
  return { ...DEFAULT_NOTIF_SETTINGS, ...s };
}

const T: Record<NotifLang, Record<string, string>> = {
  fr: {
    default_title: "💰 Nouvelle commande {shop}",
    fallback_body: "Tu as une nouvelle commande.",
    other_singular: "autre",
    other_plural: "autres",
    product_default: "produit",
    currency_locale: "fr-FR",
    fcfa: "FCFA",
  },
  en: {
    default_title: "💰 New order — {shop}",
    fallback_body: "You have a new order.",
    other_singular: "more",
    other_plural: "more",
    product_default: "item",
    currency_locale: "en-US",
    fcfa: "XOF",
  },
  es: {
    default_title: "💰 Nuevo pedido — {shop}",
    fallback_body: "Tienes un nuevo pedido.",
    other_singular: "más",
    other_plural: "más",
    product_default: "producto",
    currency_locale: "es-ES",
    fcfa: "FCFA",
  },
  pt: {
    default_title: "💰 Novo pedido — {shop}",
    fallback_body: "Você recebeu um novo pedido.",
    other_singular: "outro",
    other_plural: "outros",
    product_default: "produto",
    currency_locale: "pt-BR",
    fcfa: "FCFA",
  },
  ar: {
    default_title: "💰 طلب جديد — {shop}",
    fallback_body: "لديك طلب جديد.",
    other_singular: "آخر",
    other_plural: "آخرين",
    product_default: "منتج",
    currency_locale: "ar",
    fcfa: "FCFA",
  },
};

export interface NotifOrderInput {
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_city?: string | null;
  customer_country?: string | null;
  total?: number | string | null;
  items?: Array<{ product_name?: string | null; quantity?: number | null }>;
}

export interface BuiltNotification {
  title: string;
  body: string;
  productLine: string;
  firstProductName: string;
}

export function buildOrderNotification(
  order: NotifOrderInput,
  shopName: string,
  rawSettings: any,
): BuiltNotification {
  const s = mergeNotifSettings(rawSettings);
  const lang = (s.language && T[s.language]) ? s.language : "fr";
  const dict = T[lang];

  const items = Array.isArray(order.items) ? order.items : [];
  const maxN = Math.max(1, Math.min(5, Number(s.max_products) || 2));
  const firstProductName = String(items[0]?.product_name || "").trim();

  let productLine = "";
  if (items.length > 0 && s.include_products) {
    if (items.length === 1 || maxN === 1) {
      const q = Number(items[0]?.quantity || 1);
      productLine = `📦 ${q}× ${firstProductName || dict.product_default}`;
      const extra = Math.max(0, items.length - 1);
      if (extra > 0) {
        productLine += ` +${extra} ${extra > 1 ? dict.other_plural : dict.other_singular}`;
      }
    } else {
      const head = items.slice(0, maxN).map((it) => {
        const q = Number(it?.quantity || 1);
        const n = String(it?.product_name || dict.product_default).trim();
        return `${q}× ${n}`;
      }).join(", ");
      const extra = Math.max(0, items.length - maxN);
      productLine = `📦 ${head}${extra > 0 ? ` +${extra} ${extra > 1 ? dict.other_plural : dict.other_singular}` : ""}`;
    }
  }

  const name = String(order.customer_name || "").trim();
  const phone = String(order.customer_phone || "").trim();
  const city = String(order.customer_city || "").trim();
  const country = String(order.customer_country || "").trim();
  const place = [city, country].filter(Boolean).join(", ");
  const totalNum = order.total != null && order.total !== "" ? Number(order.total) : NaN;
  const total = Number.isFinite(totalNum)
    ? `${totalNum.toLocaleString(dict.currency_locale)} ${dict.fcfa}`
    : "";

  // Build title
  const rawTitle = (s.template === "custom" && s.custom_title?.trim())
    ? s.custom_title.trim()
    : dict.default_title;
  const title = rawTitle.replace(/\{shop\}/g, shopName || "").trim().replace(/\s+—\s*$/, "");

  // Build body lines depending on template
  const lines: string[] = [];
  const want = {
    name: s.include_customer_name && s.template !== "minimal",
    phone: s.include_phone && (s.template === "detailed" || s.template === "custom"),
    place: s.include_place && s.template !== "minimal",
    total: s.include_total,
    products: s.include_products,
  };

  if (want.name && name) lines.push(`👤 ${name}`);
  if (want.products && productLine) lines.push(productLine);
  if (want.phone && phone) lines.push(`📞 ${phone}`);
  if (want.place && place) lines.push(`📍 ${place}`);
  if (want.total && total) lines.push(`💰 ${total}`);

  const body = lines.length ? lines.join("\n") : dict.fallback_body;
  return { title, body, productLine, firstProductName };
}