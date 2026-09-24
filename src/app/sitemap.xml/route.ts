import { getTranslations } from "next-intl/server";

import { apartments, pick } from "@/lib/appartements";
import { destinationPageList } from "@/lib/destination-pages";
import { routing, type Locale } from "@/i18n/routing";
import { urlFor } from "@/lib/seo";
import { site } from "@/lib/site";

// Route Handler plutôt que la convention metadata `sitemap.ts` (voir robots.txt).
export const dynamic = "force-static";

// Date de génération = date du build (route statique) : le site n'a pas
// encore de date de modification par page (le branchement Sanity apportera
// `_updatedAt`).
const LAST_MODIFIED = new Date().toISOString();

/** Échappement XML (titres d'images : apostrophes, esperluettes…). */
const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

interface SitemapImage {
  loc: string;
  title: string;
}

/*
 * Une entrée <url> par page ET par langue (6 × pages publiques), chacune
 * avec l'ensemble de ses alternatives hreflang + x-default (FR). /studio,
 * /api et la réservation (modale, pas de page) n'y figurent pas.
 *
 * Sitemap images (xmlns:image) : chaque fiche logement liste les photos de
 * sa galerie (titre = texte alternatif de la photo dans la langue de
 * l'entrée, sinon « {nom} — photo N ») ; chaque page destination, la photo
 * de son héros.
 */
export async function GET() {
  const pages: {
    path: string;
    images?: (locale: Locale) => Promise<SitemapImage[]>;
  }[] = [
    { path: "/" },
    ...destinationPageList.map((d) => ({
      path: d.path,
      images: async (locale: Locale) => {
        const t = await getTranslations({
          locale,
          namespace: `destination.${d.messagesKey}`,
        });
        return [{ loc: `${site.url}${d.heroImage}`, title: t("heroAlt") }];
      },
    })),
    ...apartments.map((a) => ({
      path: `/appartements/${a.slug}`,
      images: async (locale: Locale) => {
        const t = await getTranslations({ locale, namespace: "apartment" });
        const name = pick(a.name, locale);
        const alts = a.galleryAlts ? pick(a.galleryAlts, locale) : undefined;
        return a.gallery.map((src, i) => ({
          loc: `${site.url}${src}`,
          title: alts?.[i] ?? t("galleryPhoto", { name, index: i + 1 }),
        }));
      },
    })),
    { path: "/mentions-legales" },
  ];

  const entries: string[] = [];
  for (const { path, images } of pages) {
    const alternates = [
      ...routing.locales.map(
        (loc) =>
          `    <xhtml:link rel="alternate" hreflang="${loc}" href="${urlFor(loc, path)}"/>`,
      ),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${urlFor(routing.defaultLocale, path)}"/>`,
    ];
    for (const loc of routing.locales) {
      const imgs = images ? await images(loc) : [];
      entries.push(
        [
          "  <url>",
          `    <loc>${urlFor(loc, path)}</loc>`,
          `    <lastmod>${LAST_MODIFIED}</lastmod>`,
          ...alternates,
          ...imgs.map((img) =>
            [
              "    <image:image>",
              `      <image:loc>${esc(img.loc)}</image:loc>`,
              `      <image:title>${esc(img.title)}</image:title>`,
              "    </image:image>",
            ].join("\n"),
          ),
          "  </url>",
        ].join("\n"),
      );
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.join("\n")}
</urlset>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
