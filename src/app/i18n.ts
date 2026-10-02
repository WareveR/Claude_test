import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../i18n/en.json";
import ptPT from "../i18n/pt-PT.json";

void i18n.use(initReactI18next).init({
  resources: { "pt-PT": { translation: ptPT }, en: { translation: en } },
  lng: "pt-PT",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
