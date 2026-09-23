import { apartmentSlugs } from "@/lib/appartements";
import { routing } from "@/i18n/routing";
import { urlFor } from "@/lib/seo";

// Route Handler plutôt que la convention metadata `sitemap.ts` (voir robots.txt).
export const dynamic = "force-static";

// Date de génération = date du build (route statique) : le site n'a pas
// encore de date de modification par page (le branchement Sanity apportera
// `_updatedAt`).
const LAST_MODIFIED = new Date().toISOString();

/*
 * Une entrée <url> par page ET par langue (6 × pages publiques), chacune
 * avec l'ensemble de ses alternatives hreflang + x-default (FR). /studio,
 * /api et la réservation (modale, pas de page) n'y figurent pas.
 */
export function GET() {
  const paths = [
    "/",
    ...apartmentSlugs.map((s) => `/appartements/${s}`),
    "/mentions-legales",
  ];

  const urls = paths
    .flatMap((path) => {
      const alternates = [
        ...routing.locales.map(
          (loc) =>
            `    <xhtml:link rel="alternate" hreflang="${loc}" href="${urlFor(loc, path)}"/>`,
        ),
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${urlFor(routing.defaultLocale, path)}"/>`,
      ];
      return routing.locales.map((loc) =>
        [
          "  <url>",
          `    <loc>${urlFor(loc, path)}</loc>`,
          `    <lastmod>${LAST_MODIFIED}</lastmod>`,
          ...alternates,
          "  </url>",
        ].join("\n"),
      );
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
