import type { Metadata } from "next";
import { routing, type Locale } from "@/i18n/routing";
import { site } from "./site";

/** URL absolue d'un chemin pour une locale (FR sans préfixe, les autres préfixées). */
export function urlFor(locale: Locale, path: string): string {
  const p = path === "/" ? "" : path.replace(/\/$/, "");
  if (locale === routing.defaultLocale) return `${site.url}${p}` || site.url;
  return `${site.url}/${locale}${p}`;
}

/** Bloc `alternates` (canonical + hreflang pour les 6 locales + x-default). */
export function buildAlternates(
  locale: Locale,
  path: string,
): Metadata["alternates"] {
  const languages: Record<string, string> = {};
  for (const loc of routing.locales) languages[loc] = urlFor(loc, path);
  languages["x-default"] = urlFor(routing.defaultLocale, path);
  return {
    canonical: urlFor(locale, path),
    languages,
  };
}
