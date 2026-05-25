import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import fr from "./locales/fr.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import pt from "./locales/pt.json";
import ar from "./locales/ar.json";

export const SUPPORTED_LANGUAGES = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
] as const;

export type SupportedLang = (typeof SUPPORTED_LANGUAGES)[number]["code"];

const RTL_LANGS: SupportedLang[] = ["ar"];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      es: { translation: es },
      pt: { translation: pt },
      ar: { translation: ar },
    },
    fallbackLng: "fr",
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "visualpro_lang",
      caches: ["localStorage"],
    },
  });

const applyDir = (lng: string) => {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lng;
  document.documentElement.dir = RTL_LANGS.includes(lng as SupportedLang) ? "rtl" : "ltr";
};

applyDir(i18n.language);
i18n.on("languageChanged", applyDir);

export default i18n;