import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // FR est la langue par défaut (sans préfixe d'URL) ; les cinq autres sont
  // servies sous /en, /de, /nl, /es, /zh. Les noms affichés, les tags BCP 47
  // et les libellés Open Graph vivent dans src/lib/locale.ts.
  locales: ["fr", "en", "de", "nl", "es", "zh"],
  defaultLocale: "fr",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
