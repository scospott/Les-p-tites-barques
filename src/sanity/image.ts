import createImageUrlBuilder, { type SanityImageSource } from "@sanity/image-url";

import { dataset, projectId } from "./env";

const builder = createImageUrlBuilder({ projectId, dataset });

/** URL d'une image Sanity, à dimensionner par chaînage (`.width(1200)`…). */
export function urlForImage(source: SanityImageSource) {
  return builder.image(source);
}

/* ============================================================
   Images du CDN Sanity servies par <SafeImage> (et le carrousel 3D).

   Les adaptateurs transmettent l'URL BRUTE de l'asset
   (https://cdn.sanity.io/images/<projet>/<dataset>/<id>-<L>x<H>.jpg) ; le
   rendu y ajoute les paramètres du CDN : `auto=format` (AVIF / WebP selon
   le navigateur), largeur, qualité. `srcset` + `sizes` du composant :
   le navigateur ne télécharge que la largeur utile.
   Les photos locales (héros, posters, vues aériennes) ne passent pas ici.
   ============================================================ */

const SANITY_CDN = "https://cdn.sanity.io/images/";

/** Largeurs proposées au navigateur (jamais au-delà de l'original). */
const WIDTHS = [480, 768, 1024, 1440, 1920, 2400];

export const isSanityImage = (src: string | undefined): src is string =>
  !!src && src.startsWith(SANITY_CDN);

/** Largeur d'origine, lue dans le nom de l'asset (`…-1400x934.jpg`). */
function originalWidth(src: string): number | undefined {
  const m = src.match(/-(\d+)x\d+\.\w+(?:\?|$)/);
  return m ? Number(m[1]) : undefined;
}

/** URL d'une image Sanity à une largeur donnée, format automatique. */
export function sanityImageUrl(src: string, width?: number, quality = 82): string {
  const params = new URLSearchParams({ auto: "format", q: String(quality), fit: "max" });
  if (width) params.set("w", String(width));
  return `${src.split("?")[0]}?${params}`;
}

/** `src` + `srcSet` pour une image Sanity. */
export function sanitySrcSet(src: string): { src: string; srcSet: string } {
  const max = originalWidth(src) ?? 2400;
  const widths = WIDTHS.filter((w) => w < max).concat(max);
  return {
    src: sanityImageUrl(src, Math.min(1440, max)),
    srcSet: widths.map((w) => `${sanityImageUrl(src, w)} ${w}w`).join(", "),
  };
}
