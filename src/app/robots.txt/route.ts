import { site } from "@/lib/site";

// Route Handler plutôt que la convention metadata `robots.ts` : le chemin du
// projet contient une apostrophe, qui casse le metadata-route-loader de Next.
export const dynamic = "force-static";

export function GET() {
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${site.url}/sitemap.xml`,
    `Host: ${site.url}`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
