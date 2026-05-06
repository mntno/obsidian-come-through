import { en } from "#/lang/en";
import { Api } from "#/utils/obs/api";

// Import other languages here in the future, e.g.:
// import { sv } from "./lang/sv";
// When a new language is added, the translator should always start by copying `en.ts` and then translating the values. This ensures the structure is always identical, virtually eliminating the risk of missing keys.
const translations: Record<string, typeof en> = {
    en,
    // sv,
};

const currentLang = Api.App.getLanguage();
export const t = currentLang in translations && translations[currentLang] !== undefined ? translations[currentLang] : en;
