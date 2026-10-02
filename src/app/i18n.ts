import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { isLanguage, type Language } from "../core/languages";
import en from "../i18n/en.json";
import ptPT from "../i18n/pt-PT.json";

/** The browser's language when v1 supports it. */
export function browserLanguage(): Language | null {
  for (const lng of navigator.languages) {
    if (isLanguage(lng)) return lng;
    if (lng.startsWith("pt")) return "pt-PT";
    if (lng.startsWith("en")) return "en";
  }
  return null;
}

/**
 * The language a signed-in device shows: its own choice, else the browser's language when
 * supported, else the Family Language.
 */
export function deviceLanguage(chosen: string | null, familyLanguage: string): Language {
  if (isLanguage(chosen)) return chosen;
  return browserLanguage() ?? (isLanguage(familyLanguage) ? familyLanguage : "pt-PT");
}

void i18n.use(initReactI18next).init({
  resources: { "pt-PT": { translation: ptPT }, en: { translation: en } },
  lng: browserLanguage() ?? "pt-PT",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
