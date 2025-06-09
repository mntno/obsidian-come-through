import { getLanguage } from "obsidian";
import { en } from "./lang/en";

// Import other languages here in the future, e.g.:
// import { sv } from "./lang/sv";
// When a new language is added, the translator should always start by copying `en.ts` and then translating the values. This ensures the structure is always identical, virtually eliminating the risk of missing keys.

const strings: Record<string, typeof en> = {
    en,
    // sv,
};

// Determine the user's language from Obsidian's settings
const currentLang = getLanguage();

// Select the appropriate strings, falling back to English if the language is not supported
const t = strings[currentLang] || en;

export default t;
