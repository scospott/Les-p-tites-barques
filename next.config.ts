import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Images are local placeholders for the demo; real photos are dropped into
  // /public/images later without code changes (see <SafeImage>).
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async redirects() {
    return [
      /*
       * L'Antillaise s'appelait « guadeloupe » (slug du logement) jusqu'en
       * septembre 2026. 308 : les liens déjà partagés suivent. La page
       * DESTINATION /guadeloupe, elle, ne bouge pas.
       */
      {
        source: "/:locale(en|de|nl|es|zh)/appartements/guadeloupe",
        destination: "/:locale/appartements/l-antillaise",
        permanent: true,
      },
      // Français : langue par défaut, servie sans préfixe — un seul saut.
      ...["/fr/appartements/guadeloupe", "/appartements/guadeloupe"].map((source) => ({
        source,
        destination: "/appartements/l-antillaise",
        permanent: true,
      })),
    ];
  },
  async headers() {
    return [
      /*
       * En-têtes de sécurité, sur toutes les réponses. Pas de
       * Content-Security-Policy stricte pour l'instant : le Studio Sanity
       * (/studio, scripts et styles inline, API sanity.io) et l'iframe
       * Google Maps des fiches la casseraient — à écrire le jour où l'on
       * pourra la tester route par route.
       * HSTS `preload` : une fois le domaine inscrit sur hstspreload.org,
       * le retour en HTTP (sous-domaines compris) n'est plus possible
       * avant des mois — c'est voulu, mais irréversible à court terme.
       */
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
      /*
       * Doublons *.vercel.app : noindex TOUJOURS, quel que soit
       * NEXT_PUBLIC_INDEXING — y compris pour les fichiers statiques, /api
       * et /studio que le middleware ne voit pas (cf. src/middleware.ts).
       */
      {
        source: "/:path*",
        has: [{ type: "host", value: "(?<sub>.*)\\.vercel\\.app" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      /*
       * Pré-lancement : en-tête noindex sur toutes les réponses tant que
       * NEXT_PUBLIC_INDEXING n'est pas "true" (même règle que la balise meta
       * robots et robots.txt, voir `site.indexing`). Couvre aussi ce que la
       * balise ne peut pas couvrir : images, PDF, routes API.
       */
      ...(process.env.NEXT_PUBLIC_INDEXING === "true"
        ? []
        : [
            {
              source: "/:path*",
              headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
            },
          ]),
      {
        /*
         * Frames des héros scroll-scrub. Par défaut, un fichier de /public est
         * servi en `max-age=0, must-revalidate` : chaque visite revalidait donc
         * les ~120 frames de la séquence (autant d'allers-retours réseau avant
         * le premier dessin). Ces fichiers sont immuables — leur contenu ne
         * change jamais sans que le nom du dossier change lors d'une nouvelle
         * extraction ffmpeg — d'où un cache d'un an en `immutable` : les
         * visites suivantes ne repartent plus sur le réseau du tout.
         */
        source: "/heroes/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Même raisonnement pour les photos des logements et de l'accueil.
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
