import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { isLanguage } from "../core/languages";
import en from "../i18n/en.json";
import ptPT from "../i18n/pt-PT.json";

/** The browser's language when v1 supports it; the per-device choice arrives with #55. */
function browserLanguage() {
  for (const lng of navigator.languages) {
    if (isLanguage(lng)) return lng;
    if (lng.startsWith("pt")) return "pt-PT";
    if (lng.startsWith("en")) return "en";
  }
  return "pt-PT";
}

void i18n.use(initReactI18next).init({
  resources: { "pt-PT": { translation: ptPT }, en: { translation: en } },
  lng: browserLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
