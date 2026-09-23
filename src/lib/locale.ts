import { routing, type Locale } from "@/i18n/routing";

/* ============================================================
   Locales — source unique des libellés et réglages par langue.
   Les six locales sont déclarées dans src/i18n/routing.ts ; ici vivent
   ce qui en dépend : autonyme (menu de langue), tag BCP 47 (Intl),
   libellé Open Graph, jours de semaine du calendrier.
   ============================================================ */

/** Nom de la langue dans sa propre langue (menu déroulant du header). */
export const LOCALE_NAMES: Record<Locale, string> = {
  fr: "Français",
  en: "English",
  de: "Deutsch",
  nl: "Nederlands",
  es: "Español",
  zh: "中文",
};

/** Tag BCP 47 pour Intl.* (dates, nombres, monnaie). */
export const LOCALE_TAGS: Record<Locale, string> = {
  fr: "fr-FR",
  en: "en-GB",
  de: "de-DE",
  nl: "nl-NL",
  es: "es-ES",
  zh: "zh-CN",
};

/** Locale Open Graph (`og:locale`). */
export const OG_LOCALES: Record<Locale, string> = {
  fr: "fr_FR",
  en: "en_GB",
  de: "de_DE",
  nl: "nl_NL",
  es: "es_ES",
  zh: "zh_CN",
};

/** Nom de la langue en anglais — pour le prompt système de l'assistant. */
export const LOCALE_ENGLISH_NAMES: Record<Locale, string> = {
  fr: "French",
  en: "English",
  de: "German",
  nl: "Dutch",
  es: "Spanish",
  zh: "Simplified Chinese",
};

/** Initiales des jours, lundi en tête (grille européenne du calendrier). */
export const WEEKDAYS: Record<Locale, string[]> = {
  fr: ["L", "M", "M", "J", "V", "S", "D"],
  en: ["M", "T", "W", "T", "F", "S", "S"],
  de: ["M", "D", "M", "D", "F", "S", "S"],
  nl: ["M", "D", "W", "D", "V", "Z", "Z"],
  es: ["L", "M", "X", "J", "V", "S", "D"],
  zh: ["一", "二", "三", "四", "五", "六", "日"],
};

/** `"de"` → `"de"`, valeur inconnue → locale par défaut. */
export function toLocale(value: unknown): Locale {
  return typeof value === "string" &&
    (routing.locales as readonly string[]).includes(value)
    ? (value as Locale)
    : routing.defaultLocale;
}

/** Note voyageurs formatée selon la locale (« 4,97 » en FR, « 4.97 » en EN…). */
export function formatRating(rating: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_TAGS[locale], {
    maximumFractionDigits: 2,
  }).format(rating);
}
