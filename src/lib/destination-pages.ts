import type { Apartment, MapPoint } from "./appartements";
import { apartments } from "./appartements";
import { destinations, type DestinationId } from "./destinations";

/* ============================================================
   Pages destination (/saint-malo, /guadeloupe) — le cœur du SEO local.

   Ici : ce qui ne se traduit pas (chemin, photos, géographie). Les textes
   (title, description, H1, intro, FAQ, touristType) vivent dans
   messages/<locale>.json, namespace `destination.<messagesKey>`.

   Les slugs ne sont PAS traduits, comme /appartements et
   /mentions-legales : même chemin dans les six langues.

   FAQ : réponses tirées de la base de l'assistante (facts, équipements,
   locationNote des logements + règles de réservation). Deux sujets du
   cahier des charges n'y figurent pas faute de donnée — on n'invente rien :
   TODO saison (meilleure période, tarifs saisonniers réels) et animaux
   (acceptés ou non) : à obtenir de Gwenaëlle. Ils sont remplacés par
   « séjour minimum » et « venir avec un bébé », présents dans la base.
   ============================================================ */

export interface DestinationPage {
  id: DestinationId;
  /** Chemin sans préfixe de locale. */
  path: `/${string}`;
  /** Clé du namespace `destination` dans les messages. */
  messagesKey: "saintMalo" | "guadeloupe";
  /**
   * Photo du héros (Ken Burns) — version allégée dédiée (public/images/
   * destinations, 1440-1600 px, JPEG q66-70) de la vue aérienne des barques /
   * de la photo-01 de L'Antillaise : le texte du héros est l'élément LCP
   * mobile et la photo pleine taille lui disputait la bande passante.
   */
  heroImage: string;
  /** Image Open Graph 1200 × 630 (scripts/generate-og-images.ts). */
  ogImage: string;
  /** Libellé du lien « Découvrir … » et du fil d'Ariane (nom propre). */
  label: string;
  /** Lieu schema.org (`name` du TouristDestination). */
  placeName: string;
  /** Région puis pays — `containedInPlace` imbriqués. */
  region: string;
}

export const destinationPages: Record<DestinationId, DestinationPage> = {
  "saint-malo": {
    id: "saint-malo",
    path: "/saint-malo",
    messagesKey: "saintMalo",
    heroImage: "/images/destinations/saint-malo-barques-vue-aerienne.jpg",
    ogImage: "/og/sejour-saint-malo-barques-vue-aerienne.jpg",
    label: "Saint-Malo",
    placeName: "Saint-Malo",
    region: "Bretagne",
  },
  guadeloupe: {
    id: "guadeloupe",
    path: "/guadeloupe",
    messagesKey: "guadeloupe",
    heroImage: "/images/destinations/deshaies-terrasse-vue-mer.jpg",
    ogImage: "/og/sejour-deshaies-guadeloupe-terrasse-vue-mer.jpg",
    label: "Guadeloupe",
    placeName: "Deshaies",
    region: "Guadeloupe",
  },
};

export const destinationPageList = Object.values(destinationPages);

/** Page destination d'un logement. */
export function destinationOf(apt: Apartment): DestinationPage {
  return destinationPages[apt.region];
}

/** Logements d'une destination, dans l'ordre d'affichage du site. */
export function apartmentsIn(id: DestinationId): Apartment[] {
  return apartments.filter((a) => a.region === id);
}

/**
 * Lieux des itinéraires proposés sur les fiches de la destination, sans
 * doublon (même requête Google Maps = même lieu).
 */
export function placesIn(id: DestinationId): MapPoint[] {
  const seen = new Map<string, MapPoint>();
  for (const a of apartmentsIn(id)) {
    for (const p of a.mapPoints ?? []) if (!seen.has(p.query)) seen.set(p.query, p);
  }
  return [...seen.values()];
}

/** Coordonnées de la destination (marqueur du globe). */
export function geoOf(id: DestinationId): { lat: number; lng: number } {
  // Guadeloupe : le marqueur du globe est au centre de l'archipel ; la page
  // parle de Deshaies → position du quartier du studio (mapPin).
  const pin = id === "guadeloupe" ? apartmentsIn(id)[0]?.mapPin : undefined;
  const d = destinations[id];
  return pin ? { lat: pin.lat, lng: pin.lng } : { lat: d.lat, lng: d.lng };
}
