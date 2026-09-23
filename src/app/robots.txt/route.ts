import { site } from "@/lib/site";

// Route Handler plutôt que la convention metadata `robots.ts` : le chemin du
// projet contient une apostrophe, qui casse le metadata-route-loader de Next.
export const dynamic = "force-static";

// Tant que NEXT_PUBLIC_INDEXING n'est pas "true", tout est fermé aux robots
// (voir `site.indexing`) ; le sitemap n'est déclaré qu'une fois ouvert.
export function GET() {
  const body = (
    site.indexing
      ? [
          "User-agent: *",
          "Allow: /",
          "Disallow: /studio",
          "Disallow: /api/",
          "",
          `Sitemap: ${site.url}/sitemap.xml`,
        ]
      : ["User-agent: *", "Disallow: /"]
  )
    .concat("")
    .join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
