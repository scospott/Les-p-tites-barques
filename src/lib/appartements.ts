import type { Locale } from "@/i18n/routing";

/* ============================================================
   Logements — TYPES et utilitaires. Le contenu vient de Sanity
   (src/sanity/adapters.ts → `getApartments()`), les réglages structurels
   (héros, tarifs de démonstration, mise en page de la carte) de
   src/lib/apartment-config.ts.

   `Apartment` est la forme que lisent les composants : chaque champ
   traduisible est résolu dans les six langues (`pick(champ, locale)`).
   L'ancien fichier de données (FR + EN + overlays DE/NL/ES/ZH) est figé
   dans scripts/sanity-source/, pour la migration uniquement.
   ============================================================ */

export type Localized = Record<Locale, string>;
export type LocalizedList = Record<Locale, string[]>;

export interface ApartmentFact {
  label: Localized;
  value: Localized;
}

/** Catégorie d'équipements (accordéon). `id` mappe une icône côté composant. */
export interface EquipCategory {
  id: string;
  title: string;
  items: string[];
}

/** Avis voyageur — conservé dans sa langue d'origine (non traduit). */
export interface Review {
  name: string;
  /** Pays du voyageur (optionnel — absent sur certains avis). */
  country?: string;
  /** Mois du séjour, format ISO « AAAA-MM » — affiché localisé (optionnel). */
  date?: string;
  text: string;
}

/** Point d'intérêt « Alentours » — `query` est passé à Google Maps. */
export interface MapPoint {
  label: string;
  query: string;
  /**
   * Mode de déplacement de l'itinéraire : à pied pour ce qui se fait depuis
   * le pas de la porte, en voiture pour les excursions. Absent → voiture.
   */
  mode?: "walking" | "driving";
}

/** Tarifs du parcours de réservation (PLACEHOLDERS, en euros). */
export interface Pricing {
  /** Tarif haute saison, € / nuit. */
  high: number;
  /** Tarif basse saison, € / nuit. */
  low: number;
  /** Forfait ménage affiché dans le récapitulatif. */
  cleaning: number;
}

export type ApartmentStatus = "complete" | "partial" | "placeholder";

/**
 * Forme d'un logement, générique sur le type des champs localisés (six
 * langues résolues pour `Apartment`).
 */
interface ApartmentShape<S, SL> {
  slug: string;
  /** Dernière modification (Sanity `_updatedAt`) — sitemap. */
  updatedAt?: string;
  /**
   * Photo principale (carte d'accueil, pin du globe, modal Réserver, hero).
   * Nom de fichier DESCRIPTIF (SEO image) : version web (1400 px, JPEG
   * q80) de la photo de galerie correspondante, qui garde son
   * `photo-NN.jpg` en 2560 px. Les cartes n'affichent jamais la vitrine à
   * plus de ~650 px de large : la pleine résolution y était perdue.
   */
  mainImage: string;
  /** Résumé capacité (« 2 voyageurs · 1 chambre · 1 lit · 1 salle de bain »). */
  capacity?: S;
  /**
   * Nombre maximum de voyageurs — borne haute du stepper du parcours de
   * réservation. Cohérent avec le 1er segment de `capacity`.
   */
  maxGuests?: number;
  region: "saint-malo" | "guadeloupe";
  status: ApartmentStatus;
  /**
   * Galerie (carrousel 3D + lightbox) : chemins /public, dans l'ordre
   * d'affichage. Liste explicite = contrôle de l'ordre, pas de scan de dossier.
   */
  gallery: string[];
  /**
   * Texte alternatif de chaque photo de `gallery`, même ordre, même longueur.
   * Absent → « {nom} — photo N ».
   */
  galleryAlts?: SL;
  /**
   * Nombre minimal de cartes du carrousel. Si la galerie compte moins de
   * photos, les emplacements restants affichent un placeholder élégant
   * (galerie incomplète, ex. Guadeloupe).
   */
  gallerySlots?: number;
  name: S;
  locality: S;
  tagline: S;
  /** Balise title (≤ 60 car.) et meta description (≤ 155 car.) de la fiche. */
  seo?: { title: S; description: S };
  /** Questions suggérées par l'assistante quand on parle de CE logement (4). */
  chatSuggestions?: SL;
  /** Texte de présentation (paragraphes). Absent si inconnu. */
  description?: SL;
  /** « Ce que l'on aime » — atouts. Absent si inconnu. */
  highlights?: SL;
  /**
   * Chiffres clés (surface, plage, stationnement, n° d'enregistrement…).
   * N'est PLUS affiché sur la fiche : c'est la base de connaissance de
   * l'assistante (cf. lib/assistant-prompt.ts) qui s'en nourrit.
   */
  facts?: { label: S; value: S }[];
  /**
   * FAQ de la fiche (accordéon sous Équipements + JSON-LD FAQPage). Chaque
   * réponse ne reprend QUE ce que contient déjà la fiche (facts,
   * équipements, description, adresse) — la base de l'assistante. Rien
   * d'inventé : une question sans réponse dans les données n'y figure pas.
   */
  faq?: { q: S; a: S }[];
  /**
   * Surface habitable — extraite de `facts` par `localize()`, affichée en
   * chip de capacité. Valeur identique dans toutes les langues (« 43 m² »).
   */
  surface?: string;
  /**
   * N° d'enregistrement du meublé de tourisme — extrait de `facts` par
   * `localize()`. Mention LÉGALE affichée sous la description : ne pas la
   * retirer. Absent pour les logements qui n'en ont pas encore.
   */
  registration?: string;
  /** Équipements. Absent si inconnu. */
  amenities?: SL;
  /** Note hôte (sur 10). Absente si inconnue. */
  hostRating?: number;
  /** Note sur la situation / le quartier. */
  locationNote?: S;

  /* ---- Architecture unifiée (héros / équipements / avis) ---- */
  /** Équipements catégorisés (accordéon). Absent → placeholder « à renseigner ». */
  equipements?: EquipCategory[];
  /** Note globale des avis (échelle `ratingScale`). */
  rating?: number;
  /** Échelle de la note : 5 (Airbnb) ou 10 (Booking). */
  ratingScale?: 5 | 10;
  /** Nombre d'avis (si connu). */
  reviewCount?: number;
  /** Badge plateforme (ex. « Coup de cœur voyageurs »). */
  reviewBadge?: S;
  /** Témoignages (langue d'origine). Vide → placeholder « à renseigner ». */
  reviews?: Review[];

  /* ---- Section « Alentours » (itinéraires + carte) ---- */
  /** Adresse de l'appartement (origine des itinéraires + carte embed). */
  address?: string;
  /** Points d'intérêt affichés en pills (itinéraire depuis `address`). */
  mapPoints?: MapPoint[];
  /**
   * Position sur la carte de destination de l'accueil (DestinationMap) —
   * coordonnées du quartier, jamais de l'adresse exacte. `card` place la
   * vignette au-dessus (défaut) ou au-dessous du point, pour que deux biens
   * proches (les deux Remparts) ne se chevauchent pas.
   */
  mapPin?: {
    lat: number;
    lng: number;
    /** Côté de la vignette sur la carte (cf. DestinationMap MapCardSide). */
    card?: "top" | "bottom" | "bottom-left";
    /** Côté sur la carte compacte (mobile) si différent. */
    compactCard?: "top" | "bottom" | "bottom-left";
  };
  /** Libellé court sous le nom, sur la carte de destination. */
  mapPlace?: S;
  /**
   * Le détail signature du lieu (encadré sous la description). Optionnel —
   * TODO à fournir par la cliente, on n'invente rien.
   */
  signature?: S;
  /** Tarifs du parcours de réservation (PLACEHOLDERS — TODO tarifs réels). */
  pricing?: Pricing;
  /**
   * Héros scrub (clés dans heroSequences), dans l'ordre : [héros 1, héros 2].
   * Absent → Ken Burns image sur les deux.
   */
  scrubHeroes?: string[];
  /**
   * Pas de héros 2 : la section est retirée de la fiche (ni clip ni Ken Burns).
   */
  noHero2?: boolean;
  /** Photo du héros 1 (Ken Burns) quand ce héros n'a pas de clip — défaut : `mainImage`. */
  hero1Image?: string;
  /** Photo du héros 2 (Ken Burns) quand ce héros n'a pas de clip — défaut : 1re photo de galerie. */
  hero2Image?: string;
  /**
   * Réglages de cadrage du héros 2, quand la photo ne supporte pas le
   * traitement par défaut (bande large + Ken Burns ample). Absent : cadrage
   * centré et Ken Burns standard, comme sur les autres fiches.
   */
  hero2Framing?: {
    /** Ancrage `object-position`, ex. « center 40% ». Défaut : centré. */
    position?: string;
    /** Ken Burns apaisé (1,00 → 1,04 au lieu de 1,06 → 1,18). */
    calmZoom?: boolean;
  };
}

export type Apartment = ApartmentShape<Localized, LocalizedList>;

/** Ville du logement, lue dans l'adresse (« …, 35400 Saint-Malo, France »). */
export function cityOf(a: Apartment): string | undefined {
  const part = a.address?.split(",").map((p) => p.trim()).find((p) => /^\d{5}\s/.test(p));
  return part?.replace(/^\d{5}\s+/, "");
}

/** Petit utilitaire pour lire un champ localisé. */
export function pick<T>(value: Record<Locale, T>, locale: Locale): T {
  return value[locale];
}

/**
 * Ce qu'il faut d'un logement aux composants CLIENT (fenêtre « Réserver »,
 * carte de l'accueil, assistante, 404) : transmis une fois par le layout
 * (<ApartmentsProvider>), sans les textes longs ni les galeries.
 */
export type ApartmentSummary = Pick<
  Apartment,
  | "slug"
  | "region"
  | "status"
  | "name"
  | "locality"
  | "tagline"
  | "mainImage"
  | "rating"
  | "mapPin"
  | "mapPlace"
  | "chatSuggestions"
>;

export function toSummary(a: Apartment): ApartmentSummary {
  return {
    slug: a.slug,
    region: a.region,
    status: a.status,
    name: a.name,
    locality: a.locality,
    tagline: a.tagline,
    mainImage: a.mainImage,
    rating: a.rating,
    mapPin: a.mapPin,
    mapPlace: a.mapPlace,
    chatSuggestions: a.chatSuggestions,
  };
}
