import { supabase } from "@/integrations/supabase/client";

export interface ProductThemeRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  preview_image: string | null;
  theme_type: string;
  is_premium: boolean;
  price: number;
  is_active: boolean;
  sort_order: number;
  configuration_json: Record<string, any>;
}

export interface ProductThemeSettings {
  product_id: string;
  shop_id: string;
  theme_slug?: string | null;
  background_color?: string | null;
  section_bg_color?: string | null;
  card_bg_color?: string | null;
  text_color?: string | null;
  title_color?: string | null;
  button_color?: string | null;
  button_text_color?: string | null;
  border_color?: string | null;
  badge_color?: string | null;
  background_mode?: "solid" | "gradient" | "image" | null;
  gradient_from?: string | null;
  gradient_to?: string | null;
  background_image_url?: string | null;
  visible_sections?: string[] | null;
  section_order?: string[] | null;
  allow_out_of_stock_orders?: boolean | null;
  custom_css_settings?: Record<string, any> | null;
}

/**
 * Détermine si un produit peut être commandé (ajoute au panier / checkout).
 * - Si is_published === false -> Non (produit réellement désactivé par le marchand).
 * - Si stock_quantity est null ou > 0 -> Oui.
 * - Si stock_quantity <= 0 -> Oui uniquement si allowOutOfStockOrders est vrai.
 */
export function isProductOrderable(product: any, allowOutOfStockOrders?: boolean): boolean {
  if (!product) return false;
  if (product.is_published === false) return false;
  if (product.stock_quantity === null || product.stock_quantity === undefined || Number(product.stock_quantity) > 0) {
    return true;
  }
  return allowOutOfStockOrders === true;
}

export interface ProductAudio {
  id: string;
  product_id: string;
  shop_id: string;
  user_id: string;
  audio_url: string;
  storage_path: string | null;
  title: string | null;
  description: string | null;
  customer_name: string | null;
  duration_seconds: number | null;
  file_type: string | null;
  file_size: number | null;
  is_active: boolean;
  sort_order: number;
}

/** WCAG relative luminance for a hex color. */
function luminance(hex: string): number {
  const m = hex.replace("#", "");
  const n = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(a: string, b: string): number {
  try {
    const la = luminance(a);
    const lb = luminance(b);
    const [hi, lo] = la > lb ? [la, lb] : [lb, la];
    return (hi + 0.05) / (lo + 0.05);
  } catch {
    return 1;
  }
}

/** If text/background contrast < 4.5, swap text to black or white whichever is more readable. */
export function ensureReadableTextColor(bg: string, text: string): string {
  const r = contrastRatio(bg, text);
  if (r >= 4.5) return text;
  return contrastRatio(bg, "#FFFFFF") >= contrastRatio(bg, "#111111") ? "#FFFFFF" : "#111111";
}

export interface ProductVideo {
  id: string;
  url: string;
  storage_path?: string | null;
  title?: string | null;
  duration?: number | null;
  file_size?: number | null;
  sort_order: number;
  created_at?: string;
}

export function isDarkColor(hex: string): boolean {
  if (!isValidHex(hex)) return false;
  return luminance(hex) < 0.35;
}

export function getCheckoutThemeStyles(bgColor?: string, primaryColor?: string) {
  const bg = bgColor && isValidHex(bgColor) ? bgColor : "#FFFFFF";
  const dark = isDarkColor(bg);

  return {
    isDark: dark,
    containerBg: bg,
    textColor: dark ? "#FFFFFF" : "#0F172A",
    mutedTextColor: dark ? "rgba(255, 255, 255, 0.7)" : "#64748B",
    headingColor: dark ? "#FFFFFF" : (primaryColor || "#0F172A"),
    inputBg: dark ? "rgba(255, 255, 255, 0.08)" : "#FFFFFF",
    inputBorder: dark ? "rgba(255, 255, 255, 0.2)" : "#E2E8F0",
    inputTextColor: dark ? "#FFFFFF" : "#0F172A",
    inputPlaceholderClass: dark ? "placeholder:text-white/40" : "placeholder:text-gray-400",
    summaryBg: dark ? "rgba(255, 255, 255, 0.06)" : "#F8FAFC",
    summaryBorder: dark ? "rgba(255, 255, 255, 0.12)" : "#F1F5F9",
    itemBg: dark ? "rgba(255, 255, 255, 0.1)" : "#FFFFFF",
    itemBorder: dark ? "rgba(255, 255, 255, 0.15)" : "#F1F5F9",
  };
}

export function isValidHex(v: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim());
}

export async function fetchProductThemes(): Promise<ProductThemeRow[]> {
  const { data, error } = await supabase
    .from("product_themes" as any)
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) return [];
  return (data as any[]) as ProductThemeRow[];
}

export async function fetchProductThemeSettings(productId: string): Promise<ProductThemeSettings | null> {
  if (!productId) return null;
  const { data, error } = await supabase
    .from("product_theme_settings" as any)
    .select("*")
    .eq("product_id", productId)
    .maybeSingle();
  if (error) return null;
  return (data as any) as ProductThemeSettings | null;
}

export async function upsertProductThemeSettings(
  payload: ProductThemeSettings
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("product_theme_settings" as any)
    .upsert(payload as any, { onConflict: "product_id" });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export interface ProductVideoData {
  videos: ProductVideo[];
  section_title?: string;
  section_subtitle?: string;
}

export async function fetchProductVideoData(productId: string): Promise<ProductVideoData> {
  if (!productId) return { videos: [] };

  let localData: ProductVideoData = { videos: [] };
  try {
    const cached = localStorage.getItem(`ecomfy_product_videos_${productId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) localData = { videos: parsed };
      else if (parsed && Array.isArray(parsed.videos)) localData = parsed;
    }
  } catch {}

  try {
    const themeSettings = await fetchProductThemeSettings(productId);
    const custom = themeSettings?.custom_css_settings;
    if (custom) {
      const vids = Array.isArray(custom.videos) ? (custom.videos as ProductVideo[]) : [];
      const title = typeof custom.video_section_title === "string" ? custom.video_section_title : undefined;
      const subtitle = typeof custom.video_section_subtitle === "string" ? custom.video_section_subtitle : undefined;
      const result: ProductVideoData = {
        videos: vids.length > 0 ? vids : localData.videos,
        section_title: title !== undefined ? title : localData.section_title,
        section_subtitle: subtitle !== undefined ? subtitle : localData.section_subtitle,
      };
      try {
        localStorage.setItem(`ecomfy_product_videos_${productId}`, JSON.stringify(result));
      } catch {}
      return result;
    }
  } catch {}

  return localData;
}

export async function fetchProductVideos(productId: string): Promise<ProductVideo[]> {
  const data = await fetchProductVideoData(productId);
  return data.videos;
}

export async function saveProductVideos(
  productId: string,
  shopId: string,
  videos: ProductVideo[],
  extra?: { section_title?: string; section_subtitle?: string }
) {
  if (!productId) return;

  const dataToSave: ProductVideoData = {
    videos,
    section_title: extra?.section_title,
    section_subtitle: extra?.section_subtitle,
  };

  try {
    localStorage.setItem(`ecomfy_product_videos_${productId}`, JSON.stringify(dataToSave));
  } catch {}

  try {
    const existing = await fetchProductThemeSettings(productId);
    const currentCustom = existing?.custom_css_settings || {};

    await upsertProductThemeSettings({
      product_id: productId,
      shop_id: shopId,
      ...existing,
      custom_css_settings: {
        ...currentCustom,
        videos: videos,
        video_section_title: extra?.section_title !== undefined ? extra.section_title : currentCustom.video_section_title,
        video_section_subtitle: extra?.section_subtitle !== undefined ? extra.section_subtitle : currentCustom.video_section_subtitle,
      },
    });
  } catch (err) {
    console.warn("saveProductVideos error:", err);
  }
}

export async function resetProductThemeSettings(productId: string) {
  await supabase.from("product_theme_settings" as any).delete().eq("product_id", productId);
}

export async function fetchProductAudios(productId: string, publicOnly = false): Promise<ProductAudio[]> {
  if (!productId) return [];
  let q = supabase
    .from("product_audios" as any)
    .select("*")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (publicOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) return [];
  return (data as any[]) as ProductAudio[];
}

export const ACCEPTED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
  "audio/opus",
  "audio/webm",
];

export const MAX_AUDIO_SIZE_BYTES = 8 * 1024 * 1024; // 8 Mo

export function isAcceptedAudio(file: File): boolean {
  if (ACCEPTED_AUDIO_TYPES.includes(file.type)) return true;
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  return ["mp3", "wav", "m4a", "aac", "ogg", "opus", "webm"].includes(ext);
}

export async function uploadProductAudio(
  file: File,
  shopId: string,
  productId: string
): Promise<{ url: string; path: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Connexion requise");
  const ext = (file.name.split(".").pop() || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp3";
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${user.id}/product-audios/${shopId}/${productId}/${rand}.${ext}`;
  const { error } = await supabase.storage.from("shop-images").upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("shop-images").getPublicUrl(path);
  return { url: data.publicUrl, path };
}

/** Build inline style object from theme settings, applied on root product page wrapper. */
export function buildProductPageStyle(
  s: ProductThemeSettings | null
): React.CSSProperties | undefined {
  if (!s) return undefined;
  const style: React.CSSProperties & Record<string, string> = {};
  if (s.background_mode === "gradient" && s.gradient_from && s.gradient_to) {
    style.background = `linear-gradient(135deg, ${s.gradient_from}, ${s.gradient_to})`;
  } else if (s.background_mode === "image" && s.background_image_url) {
    style.backgroundImage = `url(${s.background_image_url})`;
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
  } else if (s.background_color) {
    style.background = s.background_color;
  }
  if (s.text_color) style.color = s.text_color;
  // Expose as CSS variables for child overrides
  if (s.button_color) style["--pv-btn-bg"] = s.button_color;
  if (s.button_text_color) style["--pv-btn-fg"] = s.button_text_color;
  if (s.title_color) style["--pv-title"] = s.title_color;
  if (s.card_bg_color) style["--pv-card-bg"] = s.card_bg_color;
  if (s.border_color) style["--pv-border"] = s.border_color;
  if (s.badge_color) style["--pv-badge"] = s.badge_color;
  return style;
}
