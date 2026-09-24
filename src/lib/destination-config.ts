import type { DestinationId } from "./destinations";

/* ============================================================
   Pages destination (/saint-malo, /guadeloupe) — réglages STRUCTURELS.
   Le texte (titre, intro, FAQ, SEO, logements et lieux) vient de Sanity
   (document « destination », cf. getDestination) ; restent ici la route
   et les images LOCALES :
   - héros : version allégée (1440-1600 px, JPEG q66-70) de la vue aérienne
     des barques / de la photo-01 de L'Antillaise — le texte du héros est
     l'élément LCP mobile, la photo pleine taille lui disputait la bande
     passante ;
   - image Open Graph 1200 × 630 (scripts/generate-og-images.ts).
   Les slugs ne sont pas traduits (même chemin dans les six langues).
   ============================================================ */

export interface DestinationConfig {
  id: DestinationId;
  path: `/${string}`;
  heroImage: string;
  ogImage: string;
}

export const destinationConfig: Record<DestinationId, DestinationConfig> = {
  "saint-malo": {
    id: "saint-malo",
    path: "/saint-malo",
    heroImage: "/images/destinations/saint-malo-barques-vue-aerienne.jpg",
    ogImage: "/og/sejour-saint-malo-barques-vue-aerienne.jpg",
  },
  guadeloupe: {
    id: "guadeloupe",
    path: "/guadeloupe",
    heroImage: "/images/destinations/deshaies-terrasse-vue-mer.jpg",
    ogImage: "/og/sejour-deshaies-guadeloupe-terrasse-vue-mer.jpg",
  },
};

export const destinationList = Object.values(destinationConfig);

/** Coordonnées de la destination pour les données structurées. */
export function destinationGeo(
  id: DestinationId,
  homes: { mapPin?: { lat: number; lng: number } }[],
  fallback: { lat: number; lng: number },
): { lat: number; lng: number } {
  // Guadeloupe : le marqueur du globe est au centre de l'archipel ; la page
  // parle de Deshaies → position du quartier du studio.
  const pin = id === "guadeloupe" ? homes[0]?.mapPin : undefined;
  return pin ? { lat: pin.lat, lng: pin.lng } : fallback;
}
