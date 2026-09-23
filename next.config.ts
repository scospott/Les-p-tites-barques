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
  async headers() {
    return [
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
