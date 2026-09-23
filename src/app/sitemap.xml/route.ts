import { apartmentSlugs } from "@/lib/appartements";
import { routing } from "@/i18n/routing";
import { urlFor } from "@/lib/seo";

// Route Handler plutôt que la convention metadata `sitemap.ts` (voir robots.txt).
export const dynamic = "force-static";

export function GET() {
  const paths = [
    "/",
    ...apartmentSlugs.map((s) => `/appartements/${s}`),
    "/mentions-legales",
  ];

  const urls = paths
    .map((path) => {
      const canonical = urlFor(routing.defaultLocale, path);
      const alternates = routing.locales.map(
        (loc) =>
          `    <xhtml:link rel="alternate" hreflang="${loc}" href="${urlFor(loc, path)}"/>`,
      );
      return [
        "  <url>",
        `    <loc>${canonical}</loc>`,
        ...alternates,
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${canonical}"/>`,
        `    <changefreq>monthly</changefreq>`,
        `    <priority>${path === "/" ? "1.0" : "0.8"}</priority>`,
        "  </url>",
      ].join("\n");
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
