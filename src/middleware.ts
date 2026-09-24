import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { site } from "./lib/site";

const intl = createMiddleware(routing);

/*
 * Doublons *.vercel.app — le site répond aussi sur l'URL Vercel du projet
 * (et sur chaque URL de preview). Ces hôtes ne doivent jamais être indexés :
 * - toujours `X-Robots-Tag: noindex, nofollow`, quel que soit
 *   NEXT_PUBLIC_INDEXING (le canonical, lui, pointe déjà vers
 *   NEXT_PUBLIC_SITE_URL : cf. `urlFor` dans lib/seo.ts) ;
 * - le jour J (INDEXING=true), l'hôte vercel.app de PRODUCTION redirige en
 *   308 vers le domaine. Les previews (VERCEL_ENV=preview) ne redirigent
 *   pas : elles doivent rester consultables pour la recette.
 * Les fichiers statiques, /api et /studio échappent au matcher ci-dessous :
 * leur en-tête noindex sur vercel.app est posé par next.config (`has: host`).
 */
export default function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const onVercelApp = host.endsWith(".vercel.app");

  if (onVercelApp && site.indexing && process.env.VERCEL_ENV === "production") {
    const target = new URL(req.nextUrl.pathname + req.nextUrl.search, site.url);
    return NextResponse.redirect(target, 308);
  }

  const res = intl(req);
  if (onVercelApp) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  // Skip Next internals, the API routes, the embedded Sanity Studio and any
  // path containing a dot (static files). `/studio` must NOT be locale-
  // prefixed: the Studio is a single French app served outside [locale].
  matcher: ["/((?!api|studio|_next|_vercel|.*\\..*).*)"],
};
