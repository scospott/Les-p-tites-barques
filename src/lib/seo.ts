import type { Metadata } from "next";
import { routing, type Locale } from "@/i18n/routing";
import { OG_LOCALES } from "./locale";
import { OG_FILES } from "./og-images";
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

export interface OgImage {
  url: string;
  width: number;
  height: number;
  alt: string;
}

/** Image Open Graph par défaut (accueil, pages sans visuel dédié). */
export const DEFAULT_OG_IMAGE: Omit<OgImage, "alt"> = {
  url: "/og.png",
  width: 1200,
  height: 630,
};

/**
 * Métadonnées complètes d'une page : title (absolu, sans gabarit), description,
 * canonical + hreflang, Open Graph et Twitter. Next fusionne `openGraph`
 * de façon superficielle : chaque page doit donc fournir le bloc entier,
 * sans quoi og:locale / og:site_name du layout disparaissent.
 */
export function buildPageMetadata({
  locale,
  path,
  title,
  description,
  image,
  type = "website",
}: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  image: OgImage;
  type?: "website" | "article";
}): Metadata {
  const url = urlFor(locale, path);
  return {
    title: { absolute: title },
    description,
    alternates: buildAlternates(locale, path),
    openGraph: {
      type,
      siteName: site.name,
      title,
      description,
      url,
      locale: OG_LOCALES[locale],
      alternateLocale: routing.locales
        .filter((l) => l !== locale)
        .map((l) => OG_LOCALES[l]),
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: image.url, alt: image.alt }],
    },
  };
}

/** Image Open Graph dédiée d'un logement (scripts/generate-og-images.ts). */
export function ogImageFor(apt: { slug: string }, name: string): OgImage {
  const file = OG_FILES[apt.slug] ?? `${apt.slug}.jpg`;
  return { url: `/og/${file}`, width: 1200, height: 630, alt: name };
}
