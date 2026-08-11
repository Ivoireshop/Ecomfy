export const SHOP_LANGUAGES = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
] as const;

export type ShopLang = (typeof SHOP_LANGUAGES)[number]["code"];

export const isRtlLang = (code: string) => code === "ar";

export const getLangLabel = (code: string) =>
  SHOP_LANGUAGES.find((l) => l.code === code)?.label ?? code;

export const getLangFlag = (code: string) =>
  SHOP_LANGUAGES.find((l) => l.code === code)?.flag ?? "🌐";