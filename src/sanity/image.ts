import createImageUrlBuilder, { type SanityImageSource } from "@sanity/image-url";

import { dataset, projectId } from "./env";

const builder = createImageUrlBuilder({ projectId, dataset });

/** URL d'une image Sanity, à dimensionner par chaînage (`.width(1200)`…). */
export function urlForImage(source: SanityImageSource) {
  return builder.image(source);
}
