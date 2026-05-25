export const SHOP_LANGUAGES = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "dioula", label: "Dioula", flag: "🇨🇮" },
  { code: "baoule", label: "Baoulé", flag: "🇨🇮" },
  { code: "bete", label: "Bété", flag: "🇨🇮" },
  { code: "attie", label: "Attié", flag: "🇨🇮" },
] as const;

export type ShopLang = (typeof SHOP_LANGUAGES)[number]["code"];

export const isRtlLang = (code: string) => code === "ar";

export const getLangLabel = (code: string) =>
  SHOP_LANGUAGES.find((l) => l.code === code)?.label ?? code;

export const getLangFlag = (code: string) =>
  SHOP_LANGUAGES.find((l) => l.code === code)?.flag ?? "🌐";