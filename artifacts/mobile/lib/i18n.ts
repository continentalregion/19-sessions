import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import { translations } from "@/constants/translations";

const resources = Object.fromEntries(
  Object.entries(translations).map(([lang, value]) => [
    lang,
    { translation: value },
  ]),
);

i18next.use(initReactI18next).init({
  resources,
  lng: "it",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  compatibilityJSON: "v4",
});

export default i18next;
