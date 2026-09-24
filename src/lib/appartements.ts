import type { Locale } from "@/i18n/routing";
import de from "./apartments-i18n/de.json";
import nl from "./apartments-i18n/nl.json";
import es from "./apartments-i18n/es.json";
import zh from "./apartments-i18n/zh.json";

/* ============================================================
   Données des 4 logements — Les P'tites Barques
   RÈGLE D'OR : ne rien inventer. Les champs absents sont volontairement
   omis et affichés comme « [CONTENU À FOURNIR] » côté UI.
   Les 4 logements ont un contenu réel complet : 6 avis, surface, adresse,
   infos clés (facts) et équipements. Notes/nb d'avis = Airbnb.
   Ces données alimentent aussi l'assistant (lib/assistant-knowledge.ts).
   ORDRE D'AFFICHAGE (accueil, modal Réserver, footer, carte) = ordre de ce
   tableau : Remparts Mer, Remparts Plage, Paramé, Guadeloupe (L'Antillaise
   en dernier).

   i18n — la SOURCE est rédigée en FR + EN ici même (`{ fr, en }`). Les
   quatre autres langues (DE, NL, ES, ZH) vivent dans
   `src/lib/apartments-i18n/<locale>.json`, indexées par slug et par champ,
   et sont FUSIONNÉES au chargement du module (`localize` ci-dessous) : les
   composants lisent `apartments` avec `pick(champ, locale)` dans les six
   langues. Une traduction manquante retombe sur l'anglais — jamais de
   trou à l'écran.

   ⚠️ `pricing` (tarifs du bloc réservation) = PLACEHOLDERS cohérents par
   logement — TODO tarifs réels à confirmer avec la cliente.
   `mapPin` = coordonnées du QUARTIER (jamais l'adresse exacte), pour la
   carte de destination de l'accueil (DestinationMap).
   ============================================================ */

/** Champ localisé complet (6 langues) — ce que lisent les composants. */
export type Localized = Record<Locale, string>;
export type LocalizedList = Record<Locale, string[]>;

/** Champ localisé SOURCE (rédigé en FR + EN dans ce fichier). */
type L2 = { fr: string; en: string };
type L2List = { fr: string[]; en: string[] };

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
 * Forme d'un logement, générique sur le type des champs localisés :
 * `ApartmentSource` (FR + EN, tel que rédigé ici) et `Apartment` (six
 * langues, après fusion des overlays).
 */
interface ApartmentShape<S, SL> {
  slug: string;
  /** Photo principale (carte d'accueil, pin du globe, modal Réserver, hero). */
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
   * l'assistante (cf. lib/assistant-knowledge.ts) qui s'en nourrit.
   */
  facts?: { label: S; value: S }[];
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
type ApartmentSource = ApartmentShape<L2, L2List>;

/* ---- Fusion des traductions DE / NL / ES / ZH ---- */

/** Traductions d'un logement dans une langue (fichier apartments-i18n). */
interface ApartmentTranslation {
  name?: string;
  seoTitle?: string;
  chatSuggestions?: string[];
  seoDescription?: string;
  locality?: string;
  tagline?: string;
  capacity?: string;
  description?: string[];
  highlights?: string[];
  amenities?: string[];
  facts?: { label?: string; value?: string }[];
  locationNote?: string;
  reviewBadge?: string;
  mapPlace?: string;
  signature?: string;
  galleryAlts?: string[];
}
type TranslationFile = Record<string, ApartmentTranslation>;

type ExtraLocale = Exclude<Locale, "fr" | "en">;
const EXTRA: Record<ExtraLocale, TranslationFile> = {
  de: de as TranslationFile,
  nl: nl as TranslationFile,
  es: es as TranslationFile,
  zh: zh as TranslationFile,
};
const EXTRA_LOCALES = Object.keys(EXTRA) as ExtraLocale[];

/** `{ fr, en }` + traductions → six langues (repli : anglais). */
function loc(
  base: L2,
  read: (t: ApartmentTranslation) => string | undefined,
  slug: string,
): Localized {
  const out = { fr: base.fr, en: base.en } as Localized;
  for (const l of EXTRA_LOCALES) {
    const tr = EXTRA[l][slug];
    const v = tr ? read(tr) : undefined;
    out[l] = typeof v === "string" && v.trim() ? v : base.en;
  }
  return out;
}

/** Idem pour une liste : la traduction n'est retenue que si elle a la même longueur. */
function locList(
  base: L2List,
  read: (t: ApartmentTranslation) => string[] | undefined,
  slug: string,
): LocalizedList {
  const out = { fr: base.fr, en: base.en } as LocalizedList;
  for (const l of EXTRA_LOCALES) {
    const tr = EXTRA[l][slug];
    const v = tr ? read(tr) : undefined;
    out[l] =
      Array.isArray(v) && v.length === base.en.length && v.every((x) => typeof x === "string")
        ? v
        : base.en;
  }
  return out;
}

/**
 * Surface et n° d'enregistrement vivent dans `facts` — la source unique, qui
 * alimente aussi l'assistante. La fiche les affiche à part (chip de capacité
 * et mention légale) : on les extrait ici par leur libellé SOURCE (jamais
 * traduit) plutôt que de dupliquer les valeurs. Celles-ci sont identiques
 * dans les 6 langues (« 43 m² », « 352880059872D ») — rien à localiser.
 */
const SURFACE_LABEL = "Surface";
const REGISTRATION_LABEL = "N\u00b0 d\u2019enregistrement";

function factValue(a: ApartmentSource, label: string): string | undefined {
  return a.facts?.find((f) => f.label.fr === label)?.value.fr;
}

function localize(a: ApartmentSource): Apartment {
  const s = a.slug;
  return {
    ...a,
    surface: factValue(a, SURFACE_LABEL),
    registration: factValue(a, REGISTRATION_LABEL),
    name: loc(a.name, (t) => t.name, s),
    locality: loc(a.locality, (t) => t.locality, s),
    tagline: loc(a.tagline, (t) => t.tagline, s),
    seo: a.seo
      ? {
          title: loc(a.seo.title, (t) => t.seoTitle, s),
          description: loc(a.seo.description, (t) => t.seoDescription, s),
        }
      : undefined,
    capacity: a.capacity ? loc(a.capacity, (t) => t.capacity, s) : undefined,
    description: a.description
      ? locList(a.description, (t) => t.description, s)
      : undefined,
    highlights: a.highlights
      ? locList(a.highlights, (t) => t.highlights, s)
      : undefined,
    amenities: a.amenities ? locList(a.amenities, (t) => t.amenities, s) : undefined,
    galleryAlts: a.galleryAlts
      ? locList(a.galleryAlts, (t) => t.galleryAlts, s)
      : undefined,
    chatSuggestions: a.chatSuggestions
      ? locList(a.chatSuggestions, (t) => t.chatSuggestions, s)
      : undefined,
    facts: a.facts?.map((f, i) => ({
      label: loc(f.label, (t) => t.facts?.[i]?.label, s),
      value: loc(f.value, (t) => t.facts?.[i]?.value, s),
    })),
    locationNote: a.locationNote
      ? loc(a.locationNote, (t) => t.locationNote, s)
      : undefined,
    reviewBadge: a.reviewBadge
      ? loc(a.reviewBadge, (t) => t.reviewBadge, s)
      : undefined,
    mapPlace: a.mapPlace ? loc(a.mapPlace, (t) => t.mapPlace, s) : undefined,
    signature: a.signature ? loc(a.signature, (t) => t.signature, s) : undefined,
  };
}

/** Points d'intérêt communs aux 3 logements de Saint-Malo. */
/* Depuis l'intra-muros, tout se fait à pied sauf Solidor (Saint-Servan). */
const SAINT_MALO_POINTS: MapPoint[] = [
  { label: "La Gare", query: "Gare de Saint-Malo", mode: "walking" },
  { label: "Intra-Muros", query: "Saint-Malo Intra-Muros", mode: "walking" },
  { label: "Le Sillon", query: "Plage du Sillon, Saint-Malo", mode: "walking" },
  { label: "Bon Secours", query: "Plage de Bon-Secours, Saint-Malo", mode: "walking" },
  { label: "Solidor", query: "Tour Solidor, Saint-Malo", mode: "driving" },
];
/* Depuis Paramé : le Sillon à pied, le reste en voiture (ou en vélo électrique). */
const PARAME_POINTS: MapPoint[] = [
  { label: "Le Sillon", query: "Plage du Sillon, Saint-Malo", mode: "walking" },
  { label: "Intra-Muros", query: "Saint-Malo Intra-Muros", mode: "driving" },
  { label: "La Gare", query: "Gare de Saint-Malo", mode: "driving" },
  { label: "Bon Secours", query: "Plage de Bon-Secours, Saint-Malo", mode: "driving" },
  { label: "Solidor", query: "Tour Solidor, Saint-Malo", mode: "driving" },
];
const REMPARTS_ADDRESS =
  "3 Place aux Herbes, Intra-Muros, 35400 Saint-Malo, France";

const sources: ApartmentSource[] = [
  /* ------------------------------------------------------ 1. LES REMPARTS MER */
  {
    slug: "les-remparts-mer",
    chatSuggestions: {
      fr: ["Où se garer ?", "Comment se passe l’arrivée ?", "Quels équipements ?", "Que faire aux alentours ?"],
      en: ["Where can I park?", "How does check-in work?", "What amenities are there?", "What is there to do nearby?"],
    },
    seo: {
      title: {
        fr: "Remparts Mer · Appartement rénové intra-muros, Saint-Malo",
        en: "Remparts Mer · Renovated flat in Saint-Malo's old town",
      },
      description: {
        fr: "T2 rénové en 2025 au cœur de l'intra-muros de Saint-Malo, à 2 min à pied de la plage de Bon-Secours. Réservation directe, sans frais de service.",
        en: "One-bedroom flat renovated in 2025 in the heart of Saint-Malo's walled town, 2 min on foot from Bon-Secours beach. Book direct, with no service fees.",
      },
    },
    // TODO tarifs réels à confirmer avec la cliente (placeholders cohérents)
    pricing: { high: 180, low: 150, cleaning: 50 },
    maxGuests: 2,
    mapPin: { lat: 48.6502, lng: -2.0274, card: "top" },
    mapPlace: { fr: "Intra-Muros", en: "Intra-Muros" },
    // Photos PRO du photographe (public/images/remparts-mer-pro, versions web
    // 2560 px). Vitrine = LA CHAMBRE (lit, verrière atelier, deux fenêtres) —
    // carte accueil + modal Réserver + pin de carte. `principale-mer.jpg` sert
    // encore de couverture « Saint-Malo » au sélecteur de destination mobile.
    mainImage: "/images/remparts-mer-pro/photo-13.jpg",
    region: "saint-malo",
    status: "complete",
    gallery: [
      "/images/remparts-mer-pro/photo-01.jpg",
      "/images/remparts-mer-pro/photo-02.jpg",
      "/images/remparts-mer-pro/photo-03.jpg",
      "/images/remparts-mer-pro/photo-04.jpg",
      "/images/remparts-mer-pro/photo-05.jpg",
      "/images/remparts-mer-pro/photo-06.jpg",
      "/images/remparts-mer-pro/photo-07.jpg",
      "/images/remparts-mer-pro/photo-08.jpg",
      "/images/remparts-mer-pro/photo-09.jpg",
      "/images/remparts-mer-pro/photo-10.jpg",
      "/images/remparts-mer-pro/photo-11.jpg",
      "/images/remparts-mer-pro/photo-12.jpg",
      "/images/remparts-mer-pro/photo-13.jpg",
      "/images/remparts-mer-pro/photo-14.jpg",
      "/images/remparts-mer-pro/photo-15.jpg",
      "/images/remparts-mer-pro/photo-16.jpg",
      "/images/remparts-mer-pro/photo-17.jpg",
      "/images/remparts-mer-pro/photo-18.jpg",
      "/images/remparts-mer-pro/photo-19.jpg",
      "/images/remparts-mer-pro/photo-20.jpg",
    ],
    name: { fr: "Les Remparts Mer", en: "Les Remparts Mer" },
    locality: {
      fr: "Saint-Malo — côté mer",
      en: "Saint-Malo — sea side",
    },
    tagline: {
      fr: "Proche des remparts, côté mer.",
      en: "Near the ramparts, on the sea side.",
    },
    capacity: {
      fr: "2 voyageurs · 1 chambre · 1 lit · 1 salle de bain",
      en: "2 guests · 1 bedroom · 1 bed · 1 bathroom",
    },
    description: {
      fr: [
        "Profitez d'un logement élégant et central. Le logement Remparts Mer des P'tites Barques est à 2 minutes à pied de la plage de Bon-Secours. Entièrement rénovée en 2025, cette ancienne mercerie est devenue un très beau T2 haut de gamme : entrée sur vitrine, cuisine équipée, salle de bain avec WC séparé, magnifique chambre avec verrière et grand salon lumineux. Décoration soignée et confort maximum, un véritable cocon pour un séjour malouin réussi. (Ancien commerce : hauteur sous plafond d'entrée 1,98 m ; escaliers, non adapté PMR.)",
      ],
      en: [
        "Enjoy an elegant, central home. The Remparts Mer home of Les P'tites Barques is a 2-minute walk from Bon-Secours beach. Fully renovated in 2025, this former haberdashery has become a beautiful, high-end one-bedroom flat: a shopfront entrance, a fitted kitchen, a bathroom with separate WC, a magnificent bedroom with an atelier-style glass partition and a large, bright living room. Refined décor and maximum comfort — a true cocoon for a successful Saint-Malo stay. (Former shop: 1.98 m ceiling height at the entrance; stairs, not wheelchair accessible.)",
      ],
    },
    facts: [
      {
        label: { fr: "Surface", en: "Surface" },
        value: { fr: "43 m²", en: "43 m²" },
      },
      {
        label: { fr: "Plage", en: "Beach" },
        value: {
          fr: "Bon-Secours à 200 m",
          en: "Bon-Secours, 200 m away",
        },
      },
      {
        label: { fr: "Emplacement", en: "Location" },
        value: {
          fr: "Cœur de l’intra-muros",
          en: "Heart of the walled town",
        },
      },
      {
        label: { fr: "Stationnement", en: "Parking" },
        value: { fr: "Pas de parking sur place", en: "No on-site parking" },
      },
      {
        label: { fr: "N° d’enregistrement", en: "Registration no." },
        value: { fr: "352880059872D", en: "352880059872D" },
      },
    ],
    locationNote: {
      fr: "À Saint-Malo, à proximité des remparts, côté mer.",
      en: "In Saint-Malo, near the ramparts, on the sea side.",
    },
    // Les 2 héros sont des scrub (clips Seedance tirés des photos pro).
    scrubHeroes: ["remparts-mer-1", "remparts-mer-2"],
    // Liste complète (Booking), nettoyée : catégories habituelles, sans doublons.
    equipements: [
      {
        id: "bain",
        title: "Salle de bain",
        items: [
          "Sèche-cheveux",
          "Baignoire ou douche",
          "Articles de toilette gratuits",
          "Serviettes",
          "Papier toilette",
          "Salle de bain privative",
          "WC",
        ],
      },
      {
        id: "chambre",
        title: "Chambre & linge",
        items: [
          "Linge de maison",
          "Armoire/penderie",
          "Dressing",
          "Lave-linge",
          "Sèche-linge",
          "Étendoir",
          "Portant",
          "Fer et matériel de repassage",
          "Lit pliant",
        ],
      },
      {
        id: "multimedia",
        title: "Multimédia",
        items: ["Télévision écran plat", "Chaînes câble/satellite"],
      },
      {
        id: "cuisine",
        title: "Cuisine & repas",
        items: [
          "Cuisine équipée",
          "Réfrigérateur",
          "Congélateur",
          "Lave-vaisselle",
          "Four",
          "Plaque de cuisson",
          "Micro-ondes",
          "Machine à café",
          "Bouilloire",
          "Grille-pain",
          "Ustensiles de cuisine",
          "Chaise haute",
          "Table à manger",
          "Coin repas",
        ],
      },
      { id: "salon", title: "Salon", items: ["Coin salon", "Canapé"] },
      { id: "chauffage", title: "Chauffage", items: ["Chauffage"] },
      { id: "internet", title: "Internet & bureau", items: ["Wifi gratuit"] },
      {
        id: "emplacement",
        title: "Emplacement",
        items: ["En bord de plage", "Accès plage", "Entrée privée"],
      },
      {
        id: "stationnement",
        title: "Stationnement",
        items: ["Pas de parking sur place"],
      },
      {
        id: "divers",
        title: "Divers",
        items: ["Établissement non-fumeurs", "Chambres familiales"],
      },
      { id: "langues", title: "Langues", items: ["Anglais", "Français"] },
    ],
    rating: 4.97,
    ratingScale: 5,
    reviewCount: 64,
    reviewBadge: {
      fr: "Coup de cœur voyageurs · Top 5% Airbnb",
      en: "Guest favourite · Top 5% on Airbnb",
    },
    reviews: [
      {
        name: "Florent",
        country: "France",
        text: "L'appartement a été rénové récemment avec beaucoup de goût. Spacieux et très bien équipé, il y a tout ce qu'il faut ! L'emplacement est parfait, dans la vieille ville et à quelques minutes de la plage et des remparts.",
      },
      {
        name: "Stéphane",
        country: "France",
        text: "Nous avons tout apprécié : l'accueil, la disponibilité et la gentillesse de Gwenaëlle, le logement décoré avec goût, neuf et très confortable. À 2 minutes de la plage de Bon-Secours, au calme tout en étant à côté de tout.",
      },
      {
        name: "Sylvie",
        country: "France",
        text: "Un cocon dans le centre historique de Saint-Malo. Très joliment décorée et idéalement placée, avec les remparts à deux pas. Un grand merci à Gwenaëlle et son mari, particulièrement accueillants !",
      },
      {
        name: "Julien",
        country: "France",
        text: "J'ai adoré l'emplacement. Intra-muros, sans être sur-fréquenté mais à deux pas de toutes commodités. L'appartement est rénové et on s'y sent très bien.",
      },
      {
        name: "Gaspard",
        country: "France",
        text: "Accueil chaleureux, maison impeccable et joliment décorée. Emplacement parfait pour un couple.",
      },
      {
        name: "Gilles",
        country: "France",
        text: "Toutes les petites attentions, la localisation, la parfaite propreté. Absolument parfait !",
      },
    ],
    address: REMPARTS_ADDRESS,
    mapPoints: SAINT_MALO_POINTS,
  },
  /* ---------------------------------------------------- 2. LES REMPARTS PLAGE */
  {
    slug: "les-remparts-plage",
    chatSuggestions: {
      fr: ["Pour combien de voyageurs ?", "La plage est-elle proche ?", "Quels équipements ?", "Comment se passe l’arrivée ?"],
      en: ["How many guests can stay?", "Is the beach close by?", "What amenities are there?", "How does check-in work?"],
    },
    seo: {
      title: {
        fr: "Remparts Plage · Appartement à 2 min de la plage, Saint-Malo",
        en: "Remparts Plage · Flat 2 min from the beach, Saint-Malo",
      },
      description: {
        fr: "T2 atypique sur plusieurs niveaux dans l'intra-muros de Saint-Malo, plage de Bon-Secours à 2 min à pied. Réservation directe, sans frais de service.",
        en: "Characterful split-level flat inside Saint-Malo's walled town, Bon-Secours beach 2 min on foot. Book direct, with no service fees.",
      },
    },
    // TODO tarifs réels à confirmer avec la cliente (placeholders cohérents)
    pricing: { high: 170, low: 140, cleaning: 50 },
    maxGuests: 3,
    // Vignette sous le point, décalée à gauche : la gare maritime du Naye
    // est juste au sud de l'intra-muros et resterait sinon sous la vignette.
    // Mobile : centrée (une vignette décalée sortirait du cadre).
    mapPin: { lat: 48.6486, lng: -2.0252, card: "bottom-left", compactCard: "bottom" },
    mapPlace: { fr: "Intra-Muros", en: "Intra-Muros" },
    // Photos PRO (public/images/remparts-plage-pro, versions web 2560 px).
    // Vitrine = le salon au MUR VÉGÉTAL, la signature du logement.
    mainImage: "/images/remparts-plage-pro/photo-04.jpg",
    // Les 2 héros sont des scrub (clips Seedance tirés des photos pro).
    scrubHeroes: ["remparts-plage-1", "remparts-plage-2"],
    region: "saint-malo",
    status: "complete",
    gallery: [
      "/images/remparts-plage-pro/photo-01.jpg",
      "/images/remparts-plage-pro/photo-02.jpg",
      "/images/remparts-plage-pro/photo-03.jpg",
      "/images/remparts-plage-pro/photo-04.jpg",
      "/images/remparts-plage-pro/photo-05.jpg",
      "/images/remparts-plage-pro/photo-06.jpg",
      "/images/remparts-plage-pro/photo-07.jpg",
      "/images/remparts-plage-pro/photo-08.jpg",
      "/images/remparts-plage-pro/photo-09.jpg",
      "/images/remparts-plage-pro/photo-10.jpg",
      "/images/remparts-plage-pro/photo-11.jpg",
      "/images/remparts-plage-pro/photo-12.jpg",
      "/images/remparts-plage-pro/photo-13.jpg",
      "/images/remparts-plage-pro/photo-14.jpg",
      "/images/remparts-plage-pro/photo-15.jpg",
      "/images/remparts-plage-pro/photo-16.jpg",
      "/images/remparts-plage-pro/photo-17.jpg",
      "/images/remparts-plage-pro/photo-18.jpg",
      "/images/remparts-plage-pro/photo-19.jpg",
      "/images/remparts-plage-pro/photo-20.jpg",
    ],
    name: { fr: "Les Remparts Plage", en: "Les Remparts Plage" },
    locality: {
      fr: "Saint-Malo — côté plage",
      en: "Saint-Malo — beach side",
    },
    tagline: {
      fr: "Proche des remparts, côté plage.",
      en: "Near the ramparts, on the beach side.",
    },
    capacity: {
      fr: "3 voyageurs · 1 chambre · 2 lits · 1 salle de bain",
      en: "3 guests · 1 bedroom · 2 beds · 1 bathroom",
    },
    description: {
      fr: [
        "Les P'tites Barques sont au cœur de la cité corsaire, à 2 minutes à pied de la plage de Bon-Secours. Cette ancienne mercerie totalement rénovée en 2025 offre une cuisine équipée côté vitrine, un salon orné d'un magnifique mur végétal, une grande salle de bain et, en souplex, une très belle chambre avec dressing et chambre bébé. Un T2 atypique qui enchante par la qualité de ses équipements et sa décoration soignée. (Vitrine avec rideaux ; hauteur sous plafond 1,98 m côté cuisine ; chambre en souplex sans fenêtre mais VMC double flux ; escaliers, non adapté PMR.)",
      ],
      en: [
        "Les P'tites Barques sit in the heart of the corsair city, a 2-minute walk from Bon-Secours beach. This former haberdashery, fully renovated in 2025, offers a fitted kitchen by the shopfront, a living room adorned with a magnificent green wall, a large bathroom and, on the lower level (souplex), a beautiful bedroom with a dressing room and a baby room. An atypical one-bedroom flat that delights with the quality of its fittings and its refined décor. (Shopfront with curtains; 1.98 m ceiling height on the kitchen side; souplex bedroom with no window but dual-flow ventilation; stairs, not wheelchair accessible.)",
      ],
    },
    facts: [
      {
        label: { fr: "Type", en: "Type" },
        value: {
          fr: "T2 atypique sur plusieurs niveaux — ancienne mercerie rénovée en 2025",
          en: "Unusual split-level one-bedroom flat — former haberdashery renovated in 2025",
        },
      },
      {
        label: { fr: "Plage", en: "Beach" },
        value: {
          fr: "Bon-Secours à 2 min à pied",
          en: "Bon-Secours, a 2-minute walk",
        },
      },
      {
        label: { fr: "Chambre", en: "Bedroom" },
        value: {
          fr: "En souplex — VMC double flux",
          en: "Lower level (souplex) — dual-flow ventilation",
        },
      },
      {
        label: { fr: "Accessibilité", en: "Accessibility" },
        value: { fr: "Non adapté PMR", en: "Not wheelchair accessible" },
      },
      {
        label: { fr: "N° d’enregistrement", en: "Registration no." },
        value: { fr: "3528800598833", en: "3528800598833" },
      },
    ],
    locationNote: {
      fr: "À Saint-Malo, à proximité des remparts, côté plage.",
      en: "In Saint-Malo, near the ramparts, on the beach side.",
    },
    equipements: [
      {
        id: "bain",
        title: "Salle de bain",
        items: [
          "Sèche-cheveux",
          "Produits de nettoyage",
          "Savon pour le corps",
          "Eau chaude",
          "Gel douche",
        ],
      },
      {
        id: "chambre",
        title: "Chambre & linge",
        items: [
          "Lave-linge",
          "Sèche-linge",
          "Cintres",
          "Linge de lit",
          "Oreillers et couvertures supplémentaires",
          "Fer à repasser",
          "Étendoir",
          "Espace de rangement",
        ],
      },
      {
        id: "multimedia",
        title: "Multimédia",
        items: ["Télévision", "Piano", "Système audio", "Livres et de quoi lire"],
      },
      {
        id: "famille",
        title: "Famille",
        items: [
          "Lit bébé",
          "Livres et jouets enfants",
          "Chaise haute",
          "Baignoire bébé",
          "Vaisselle enfants",
          "Table à langer",
          "Recommandations baby-sitters",
          "Salle de jeux enfants",
        ],
      },
      { id: "chauffage", title: "Chauffage", items: ["Chauffage"] },
      { id: "internet", title: "Internet & bureau", items: ["Wifi"] },
      {
        id: "cuisine",
        title: "Cuisine & repas",
        items: [
          "Micro-ondes",
          "Nécessaire de cuisine (casseroles, huile, sel, poivre)",
          "Vaisselle et couverts",
          "Mini réfrigérateur",
          "Congélateur",
          "Lave-vaisselle",
          "Four",
          "Bouilloire",
          "Cafetière",
          "Verres à vin",
          "Grille-pain",
          "Plaques de cuisson",
          "Kitchenette",
          "Table à manger",
          "Café",
        ],
      },
      {
        id: "emplacement",
        title: "Emplacement",
        items: ["Accès à la plage", "Entrée privée"],
      },
      {
        id: "stationnement",
        title: "Stationnement",
        items: ["Stationnement payant sur place"],
      },
      { id: "services", title: "Services", items: ["Clés remises par l'hôte"] },
    ],
    rating: 4.93,
    ratingScale: 5,
    reviewCount: 74,
    reviewBadge: {
      fr: "Coup de cœur voyageurs · Top 10% Airbnb",
      en: "Guest favourite · Top 10% on Airbnb",
    },
    reviews: [
      {
        name: "Maxime",
        country: "France",
        text: "Parfait pour un week-end avec notre bébé : chaise haute, lit bébé, gigoteuse, jouets, tout y était ! La literie est top, la propreté impeccable, la décoration magnifique. Merci pour les petites attentions bretonnes à l'arrivée. Nous reviendrons, c'est certain !",
      },
      {
        name: "Vincent",
        country: "France",
        text: "Logement atypique et superbe, extrêmement bien placé au cœur de la vieille ville. Tout est accessible à pied. Merci à Gwenaëlle pour sa réactivité, sa gentillesse et ses petites attentions (boisson & biscuits à l'arrivée) !",
      },
      {
        name: "Lise",
        country: "France",
        text: "Un vrai coup de cœur ! Séjour superbe, tout était impeccable : très propre, parfaitement équipé, décoration soignée et chaleureuse. Emplacement idéal, au calme et au cœur d'intra-muros. On reviendra avec grand plaisir !",
      },
      {
        name: "Guillaume",
        country: "France",
        text: "Conforme aux photos, agencement peu commun mais très agréable, décoration très bien choisie. Parfaitement situé pour découvrir le cœur de Saint-Malo. Gros point positif pour la propreté. On peut réserver les yeux fermés.",
      },
      {
        name: "Hannah",
        country: "Royaume-Uni",
        text: "Quel bel appartement, tant de soin a été apporté à cet endroit charmant. Emplacement idéal, absolument impeccable. Certainement l'un des meilleurs appartements dans lesquels j'ai séjourné. Nous reviendrons assurément !",
      },
      {
        name: "Audrey",
        country: "France",
        text: "Un logement impeccable, très cosy, aménagé avec beaucoup de goût et idéalement situé ! Et Gwenaëlle est adorable ! Je recommande ++",
      },
    ],
    address: REMPARTS_ADDRESS,
    mapPoints: SAINT_MALO_POINTS,
  },

  /* ---------------------------------------------------------- 3. PARAMÉ */
  {
    slug: "parame",
    chatSuggestions: {
      fr: ["Les vélos sont-ils fournis ?", "Y a-t-il une terrasse ?", "Où se garer ?", "Que faire aux alentours ?"],
      en: ["Are bikes provided?", "Is there a terrace?", "Where can I park?", "What is there to do nearby?"],
    },
    seo: {
      title: {
        fr: "Paramé · Maison avec terrasse près de la plage, Saint-Malo",
        en: "Paramé · House with terrace near the beach, Saint-Malo",
      },
      description: {
        fr: "Tiny house de 37 m² avec deux terrasses et vélos électriques à Paramé, plage du Sillon accessible à pied. Réservation directe, sans frais de service.",
        en: "37 m² tiny house with two terraces and electric bikes in Paramé, Le Sillon beach within walking distance. Book direct, with no service fees.",
      },
    },
    // TODO tarifs réels à confirmer avec la cliente (placeholders cohérents)
    pricing: { high: 130, low: 110, cleaning: 40 },
    maxGuests: 3,
    mapPin: { lat: 48.661, lng: -1.981, card: "top" },
    mapPlace: { fr: "Paramé", en: "Paramé" },
    // Photos PRO (public/images/parame-pro, versions web 2560 px).
    // Vitrine = la tiny house noire et sa terrasse.
    mainImage: "/images/parame-pro/photo-04.jpg",
    // Héros 1 = scrub (clip Seedance tiré des photos pro). Paramé n'a qu'un
    // clip : le héros 2 reste PROVISOIRE en Ken Burns image sur une photo pro
    // PAYSAGE, en attendant un second clip. Photo 2 de la série pro
    // (`lesptitesbarques-2`) : les vélos électriques sur la terrasse, un des
    // atouts annoncés du logement.
    scrubHeroes: ["parame-1"],
    hero2Image: "/images/parame-pro/photo-02.jpg",
    // La photo est en 3:2 : la bande (ratio ~2,2 à 2,45) en rogne déjà 33 à
    // 39 % de la hauteur. Le Ken Burns standard, qui démarre à 1,06 pour
    // finir à 1,18, en faisait un gros plan. Ancrage remonté à 40 % pour
    // garder le touret, la cagette et la chaise entiers plutôt que du sol.
    hero2Framing: { position: "center 40%", calmZoom: true },
    region: "saint-malo",
    status: "complete",
    gallery: [
      "/images/parame-pro/photo-01.jpg",
      "/images/parame-pro/photo-02.jpg",
      "/images/parame-pro/photo-03.jpg",
      "/images/parame-pro/photo-04.jpg",
      "/images/parame-pro/photo-05.jpg",
      "/images/parame-pro/photo-06.jpg",
      "/images/parame-pro/photo-07.jpg",
      "/images/parame-pro/photo-08.jpg",
      "/images/parame-pro/photo-09.jpg",
      "/images/parame-pro/photo-10.jpg",
      "/images/parame-pro/photo-11.jpg",
      "/images/parame-pro/photo-12.jpg",
      "/images/parame-pro/photo-13.jpg",
      "/images/parame-pro/photo-14.jpg",
      "/images/parame-pro/photo-15.jpg",
      "/images/parame-pro/photo-16.jpg",
      "/images/parame-pro/photo-17.jpg",
      "/images/parame-pro/photo-18.jpg",
      "/images/parame-pro/photo-19.jpg",
      "/images/parame-pro/photo-20.jpg",
      "/images/parame-pro/photo-21.jpg",
      "/images/parame-pro/photo-22.jpg",
      "/images/parame-pro/photo-23.jpg",
      "/images/parame-pro/photo-24.jpg",
    ],
    name: { fr: "Paramé", en: "Paramé" },
    locality: { fr: "Paramé, Saint-Malo", en: "Paramé, Saint-Malo" },
    tagline: {
      fr: "Une tiny house douillette, à cinq minutes de l’intra-muros.",
      en: "A cosy tiny house, five minutes from the old town.",
    },
    capacity: {
      fr: "3 voyageurs · 1 chambre · 2 lits · 1 salle de bain",
      en: "3 guests · 1 bedroom · 2 beds · 1 bathroom",
    },
    description: {
      fr: [
        "Cap sur Saint-Malo à bord des P'tites Barques. Immergez-vous à deux (+ enfant) dans la vie malouine dans une charmante tiny house de 37 m² accolée à notre maison. Au cœur de Paramé (tous commerces, marché local), accès à pied à la plage de Rochebonne et au Sillon. Espace salon/salle à manger, kitchenette équipée, salle de bain, chambre en mezzanine et deux terrasses. Accueil chaleureux, cadeaux de bienvenue, draps/serviettes/produits inclus, ainsi que 2 vélos électriques.",
      ],
      en: [
        "Set sail for Saint-Malo aboard Les P'tites Barques. Settle in for two (+ a child) and dive into Malouin life in a charming 37 m² tiny house adjoining our home. In the heart of Paramé (all shops, local market), with Rochebonne beach and the Sillon a short walk away. A living/dining area, a fitted kitchenette, a bathroom, a mezzanine bedroom and two terraces. A warm welcome, welcome gifts, linen/towels/toiletries included, plus 2 electric bikes.",
      ],
    },
    highlights: {
      fr: [
        "Plage de Rochebonne et le Sillon à pied",
        "Au cœur de Paramé : commerces et marché local",
        "Vélos électriques avec siège enfant à disposition",
        "À 5 min en voiture de l’intra-muros",
      ],
      en: [
        "Rochebonne beach and the Sillon on foot",
        "In the heart of Paramé: shops and local market",
        "Electric bikes with a child seat provided",
        "5 minutes by car from the old walled town",
      ],
    },
    facts: [
      {
        label: { fr: "Surface", en: "Surface" },
        value: { fr: "37 m²", en: "37 m²" },
      },
      {
        label: { fr: "Type", en: "Type" },
        value: {
          fr: "Tiny house accolée à la maison de l’hôte",
          en: "Tiny house adjoining the host’s home",
        },
      },
      {
        label: { fr: "N° d’enregistrement", en: "Registration no." },
        value: { fr: "352880046886D", en: "352880046886D" },
      },
    ],
    amenities: {
      fr: [
        "Séjour / salle à manger",
        "Kitchenette équipée",
        "Salle de bain",
        "Chambre en mezzanine",
        "Deux terrasses",
        "Vélos électriques (siège enfant)",
      ],
      en: [
        "Living / dining area",
        "Fitted kitchenette",
        "Bathroom",
        "Mezzanine bedroom",
        "Two terraces",
        "Electric bikes (child seat)",
      ],
    },
    hostRating: 9.6,
    locationNote: {
      fr: "Quartier de Paramé, à 5 min en voiture du centre historique (intra-muros). Commerces, parcs, marché, et plage de Rochebonne accessible à pied. Vélos électriques fournis.",
      en: "Paramé district, 5 minutes by car from the historic centre (intra-muros). Shops, parks, a market, and Rochebonne beach within walking distance. Electric bikes provided.",
    },
    equipements: [
      { id: "vue", title: "Vue", items: ["Vue sur le jardin"] },
      {
        id: "bain",
        title: "Salle de bain",
        items: [
          "Sèche-cheveux",
          "Produits de nettoyage",
          "Shampoing bio",
          "Savon corps bio",
          "Eau chaude",
          "Gel douche",
        ],
      },
      {
        id: "chambre",
        title: "Chambre & linge",
        items: [
          "Lave-linge (gratuit)",
          "Produits de base (serviettes, draps, savon, papier toilette)",
          "Cintres",
          "Linge de lit coton",
          "Oreillers et couvertures supplémentaires",
          "Stores occultants",
          "Étendoir",
          "Dressing",
        ],
      },
      {
        id: "multimedia",
        title: "Multimédia",
        items: [
          "Connexion Ethernet",
          'TV HD 43" câble haut de gamme',
          "Système audio",
          "Livres et de quoi lire",
        ],
      },
      {
        id: "famille",
        title: "Famille",
        items: [
          "Lit bébé (sur demande, draps fournis)",
          "Chaise haute (sur demande)",
          "Baignoire bébé (sur demande)",
          "Vaisselle enfants",
          "Table à langer",
          "Recommandations baby-sitters",
          "Vélos enfants",
        ],
      },
      { id: "chauffage", title: "Chauffage", items: ["Chauffage central"] },
      { id: "securite", title: "Sécurité", items: ["Détecteur de fumée"] },
      {
        id: "internet",
        title: "Internet & bureau",
        items: ["Wifi", "Espace de travail dédié", "Routeur wifi portable"],
      },
      {
        id: "cuisine",
        title: "Cuisine & repas",
        items: [
          "Cuisine",
          "Micro-ondes",
          "Nécessaire de cuisine (casseroles, huile, sel, poivre)",
          "Vaisselle et couverts",
          "Mini réfrigérateur",
          "Congélateur",
          "Bouilloire",
          "Cafetière expresso",
          "Verres à vin",
          "Grille-pain",
          "Plaques de cuisson",
          "Table à manger",
          "Café",
        ],
      },
      {
        id: "emplacement",
        title: "Emplacement",
        items: ["Accès partagé à la plage", "Entrée privée"],
      },
      {
        id: "exterieur",
        title: "Extérieur",
        items: [
          "Patio/balcon privé",
          "Arrière-cour privée (clôture partielle)",
          "Mobilier d'extérieur",
          "Hamac",
          "Espace repas en plein air",
          "Vélos",
        ],
      },
      {
        id: "stationnement",
        title: "Stationnement",
        items: [
          "Stationnement gratuit sur place",
          "Stationnement gratuit dans la rue",
        ],
      },
      {
        id: "services",
        title: "Services",
        items: ["Dépôt de bagages", "Arrivée autonome", "Boîte à clé sécurisée"],
      },
    ],
    rating: 4.99,
    ratingScale: 5,
    reviewCount: 135,
    reviewBadge: {
      fr: "Coup de cœur voyageurs · Top 1% Airbnb",
      en: "Guest favourite · Top 1% on Airbnb",
    },
    reviews: [
      {
        name: "Pierre-Henry",
        country: "France",
        text: "Logement très pratique et bien équipé, avec tout le nécessaire pour un bébé. Nous y reviendrons avec grand plaisir.",
      },
      {
        name: "Ronan",
        country: "France",
        text: "Espace optimisé, parfaitement rénové et très bien organisé. Les deux terrasses et les vélos électriques en libre-service sont un vrai plus. Quartier très calme. Une excellente adresse malouine.",
      },
      {
        name: "Christine",
        country: "France",
        text: "Excellent séjour. Tout est super bien pensé et agencé, la décoration très jolie, linge de qualité. Les vélos électriques un vrai atout. On reviendra !",
      },
      {
        name: "Kévin",
        country: "France",
        text: "Un lieu mignon et particulièrement bien pensé. La petite bouteille de cidre et les crêpes dentelles à l'arrivée étaient le petit plus inattendu. Bravo pour ce lieu plein de charme !",
      },
      {
        name: "Emma",
        country: "France",
        text: "Logement propre et agréable, très bien situé. Le prêt des vélos est bien utile pour se balader dans Saint-Malo. Hôtes de bons conseils et accueillants.",
      },
      {
        name: "Ilse",
        country: "Belgique",
        text: "Votre maison est vraiment fantastique. Pouvoir utiliser les vélos électriques a rendu le séjour encore plus agréable. Nous espérons revenir !",
      },
    ],
    address: "25 Rue Herbert Clos Neuf, Paramé, 35400 Saint-Malo, France",
    mapPoints: PARAME_POINTS,
  },

  /* ---------------------------------------------------------- 4. GUADELOUPE */
  {
    slug: "guadeloupe",
    chatSuggestions: {
      fr: ["Le studio est-il climatisé ?", "Quelles plages à pied ?", "Y a-t-il un parking ?", "Comment se passe l’arrivée ?"],
      en: ["Is the studio air-conditioned?", "Which beaches are within walking distance?", "Is there parking?", "How does check-in work?"],
    },
    seo: {
      title: {
        fr: "L'Antillaise · Location vue mer à Deshaies, Guadeloupe",
        en: "L'Antillaise · Sea-view rental in Deshaies, Guadeloupe",
      },
      description: {
        fr: "Studio climatisé avec terrasse vue mer de 20 m² à Deshaies, plages de Rifflet et Grande Anse à pied. Réservation directe, sans frais de service.",
        en: "Air-conditioned studio with a 20 m² sea-view terrace in Deshaies, Rifflet and Grande Anse beaches within walking distance. Book direct, no service fees.",
      },
    },
    // TODO tarifs réels à confirmer avec la cliente (placeholders cohérents)
    pricing: { high: 120, low: 100, cleaning: 45 },
    maxGuests: 2,
    // Vignette SOUS le point : les plages de Grande Anse et de Rifflet (POI)
    // sont juste au nord du bourg et resteraient cachées par la carte.
    mapPin: { lat: 16.3055, lng: -61.7935, card: "bottom" },
    mapPlace: { fr: "Deshaies", en: "Deshaies" },
    mainImage: "/images/guadeloupe/photo-01.jpg",
    // Héros 1 = clip scrub ; pas de héros 2 sur cette fiche.
    scrubHeroes: ["guadeloupe-1"],
    noHero2: true,
    region: "guadeloupe",
    status: "complete",
    // Galerie complète : 40 photos (sources hors dépôt, dans
    // Assets/petites-barques/photos-originales/guadeloupe/, ordre alphabétique
    // des UUID d'origine). `galleryAlts` : une description par photo, même ordre.
    gallery: [
      "/images/guadeloupe/photo-01.jpg",
      "/images/guadeloupe/photo-02.jpg",
      "/images/guadeloupe/photo-03.jpg",
      "/images/guadeloupe/photo-04.jpg",
      "/images/guadeloupe/photo-05.jpg",
      "/images/guadeloupe/photo-06.jpg",
      "/images/guadeloupe/photo-07.jpg",
      "/images/guadeloupe/photo-08.jpg",
      "/images/guadeloupe/photo-09.jpg",
      "/images/guadeloupe/photo-10.jpg",
      "/images/guadeloupe/photo-11.jpg",
      "/images/guadeloupe/photo-12.jpg",
      "/images/guadeloupe/photo-13.jpg",
      "/images/guadeloupe/photo-14.jpg",
      "/images/guadeloupe/photo-15.jpg",
      "/images/guadeloupe/photo-16.jpg",
      "/images/guadeloupe/photo-17.jpg",
      "/images/guadeloupe/photo-18.jpg",
      "/images/guadeloupe/photo-19.jpg",
      "/images/guadeloupe/photo-20.jpg",
      "/images/guadeloupe/photo-21.jpg",
      "/images/guadeloupe/photo-22.jpg",
      "/images/guadeloupe/photo-23.jpg",
      "/images/guadeloupe/photo-24.jpg",
      "/images/guadeloupe/photo-25.jpg",
      "/images/guadeloupe/photo-26.jpg",
      "/images/guadeloupe/photo-27.jpg",
      "/images/guadeloupe/photo-28.jpg",
      "/images/guadeloupe/photo-29.jpg",
      "/images/guadeloupe/photo-30.jpg",
      "/images/guadeloupe/photo-31.jpg",
      "/images/guadeloupe/photo-32.jpg",
      "/images/guadeloupe/photo-33.jpg",
      "/images/guadeloupe/photo-34.jpg",
      "/images/guadeloupe/photo-35.jpg",
      "/images/guadeloupe/photo-36.jpg",
      "/images/guadeloupe/photo-37.jpg",
      "/images/guadeloupe/photo-38.jpg",
      "/images/guadeloupe/photo-39.jpg",
      "/images/guadeloupe/photo-40.jpg",
    ],
    galleryAlts: {
      fr: [
        "Terrasse couverte vue mer : canapé, fauteuils et table basse en bois sous les palmiers",
        "Chambre : lit double au jeté vert sauge, banquette et coin cuisine au fond",
        "Coin repas de la terrasse : table haute en bois, chaises vert d’eau et bouquets suspendus",
        "Plantes suspendues et miroir rond en bois, table haute de la terrasse en arrière-plan",
        "Lit double sous une moustiquaire blanche, cadres de coquillages au mur",
        "Vue d’ensemble de la terrasse : salon, hamac et table haute, palmiers au fond",
        "Entrée de la terrasse : hamac, table haute et tapis « Home sweet home »",
        "La mer et les palmiers reflétés dans le grand miroir rond de la terrasse",
        "Kitchenette : plaque de cuisson, micro-ondes, grille-pain et étagères en bois",
        "Miroir rond en bois reflétant la terrasse, la mer et l’enseigne",
        "Cadres d’oursins et de coquillages au mur de la chambre",
        "Coussins brodés « La p’tite barque » et motif palmier",
        "Salle d’eau : douche à l’italienne, vasque et miroir rond",
        "Chambre lumineuse : lit à moustiquaire et parquet clair",
        "Lit à moustiquaire, serviettes pliées et coussins palmiers",
        "Chambre : lit double, télévision, banquette et climatisation",
        "Deux hamacs sur la terrasse, jardin et mer au loin",
        "Équipement bébé posé sur le lit : baignoire, bavoirs, paniers et vaisselle",
        "Lit parapluie et équipement bébé dans la chambre",
        "Salon de terrasse face à la mer et aux mornes, enseigne au mur",
        "Vue aérienne de la côte : Grande Anse à 20 min à pied, Gadet à 5 min à pied",
        "Bouquets de fleurs séchées dans des flacons suspendus",
        "Salon de la terrasse : canapé et fauteuils gris, hamac et table haute",
        "Terrasse : canapé face à la porte de la chambre, hamac et miroir rond",
        "Lit parapluie au pied du lit, avec le kit bébé",
        "Kitchenette : réfrigérateur, micro-ondes et grille-pain, près de l’entrée",
        "Chambre : lit double, banquette sous la fenêtre et porte vers la terrasse",
        "Serviette brodée « La p’tite barque » posée sur le lit",
        "Chambre climatisée : lit double, penderie ouverte et lampes de chevet",
        "Hamac sur la terrasse, la mer entre les palmiers",
        "Lit double fait, coussins palmiers et serviettes « La p’tite barque »",
        "Table haute et tabourets sous la véranda, salon de terrasse à côté",
        "Cadres d’oursins sur fond de raphia",
        "Chambre avec lit parapluie au pied du lit double",
        "Miroir rond, échelle à plantes et store en bambou sur la terrasse",
        "Terrasse côté entrée : hamac, table haute et garde-corps blanc",
        "Table haute en bois, chaises vert d’eau et miroir rond",
        "Enseigne en bois « La p’tite barque antillaise », la mer en arrière-plan",
        "Salon de terrasse : canapé, fauteuils et table basse en bois",
        "La terrasse en bois vue d’ensemble, palmiers et mer au fond",
      ],
      en: [
        "Covered sea-view terrace: sofa, armchairs and wooden coffee table beneath the palm trees",
        "Bedroom: double bed with a sage-green throw, bench seat and kitchenette in the background",
        "Terrace dining area: tall wooden table, pale green chairs and hanging bouquets",
        "Hanging plants and a round wooden mirror, with the terrace’s tall table behind",
        "Double bed under a white mosquito net, framed seashells on the wall",
        "The whole terrace: lounge area, hammock and tall table, palm trees beyond",
        "Terrace entrance: hammock, tall table and a “Home sweet home” doormat",
        "The sea and palm trees reflected in the terrace’s large round mirror",
        "Kitchenette: hob, microwave, toaster and wooden shelves",
        "Round wooden mirror reflecting the terrace, the sea and the sign",
        "Framed sea urchin and seashell prints on the bedroom wall",
        "Pillows embroidered with “La p’tite barque” and a palm-tree pattern",
        "Shower room: walk-in shower, washbasin and round mirror",
        "Bright bedroom: bed with mosquito net and light wood floor",
        "Bed with mosquito net, folded towels and palm-print pillows",
        "Bedroom: double bed, TV, bench seat and air conditioning",
        "Two hammocks on the terrace, with the garden and the sea in the distance",
        "Baby equipment laid out on the bed: bath, bibs, baskets and tableware",
        "Travel cot and baby equipment in the bedroom",
        "Terrace lounge facing the sea and the hills, sign on the wall",
        "Aerial view of the coast: Grande Anse a 20-minute walk away, Gadet a 5-minute walk",
        "Dried-flower bouquets in hanging glass bottles",
        "Terrace lounge: grey sofa and armchairs, hammock and tall table",
        "Terrace: sofa facing the bedroom door, hammock and round mirror",
        "Travel cot at the foot of the bed, with the baby kit",
        "Kitchenette: fridge, microwave and toaster, near the entrance",
        "Bedroom: double bed, bench seat under the window and door to the terrace",
        "Towel embroidered with “La p’tite barque” on the bed",
        "Air-conditioned bedroom: double bed, open wardrobe and bedside lamps",
        "Hammock on the terrace, the sea between the palm trees",
        "Made double bed, palm-print pillows and “La p’tite barque” towels",
        "Tall table and stools on the veranda, with the terrace lounge alongside",
        "Framed sea urchins on a raffia background",
        "Bedroom with a travel cot at the foot of the double bed",
        "Round mirror, plant ladder and bamboo blind on the terrace",
        "Terrace by the entrance: hammock, tall table and white railing",
        "Tall wooden table, pale green chairs and round mirror",
        "Wooden “La p’tite barque antillaise” sign, with the sea behind",
        "Terrace lounge: sofa, armchairs and wooden coffee table",
        "The wooden terrace as a whole, palm trees and sea beyond",
      ],
    },
    name: { fr: "Guadeloupe", en: "Guadeloupe" },
    locality: { fr: "Grande Anse, Guadeloupe", en: "Grande Anse, Guadeloupe" },
    tagline: {
      fr: "Un nouveau nid, au-dessus de la plage de Grande Anse.",
      en: "A new nest, above Grande Anse beach.",
    },
    capacity: {
      fr: "2 voyageurs · Studio · 1 lit · 1 salle de bain",
      en: "2 guests · Studio · 1 bed · 1 bathroom",
    },
    description: {
      fr: [
        "Cap sur la commune de Deshaies dans la résidence les Rêves d'Or ! Rénové en 2025, ce studio climatisé, confortable et élégant offre une vue mer unique depuis sa grande terrasse. Chambre spacieuse et lumineuse (lit 160 cm, couchage bébé possible), kitchenette et salle de bain modernes. Quatre plages magnifiques accessibles à pied : Rifflet (2 min), Gadet (5 min), Grande Anse et la Perle (20 min). Terrasse vue mer de 20 m² : coin détente (2 hamacs), espace repas et salon de jardin. Parking privatif gratuit.",
      ],
      en: [
        "Heading to the town of Deshaies, in the Rêves d'Or residence! Renovated in 2025, this air-conditioned studio — comfortable and elegant — offers a unique sea view from its large terrace. A spacious, light-filled bedroom (160 cm bed, baby bedding possible), with a modern kitchenette and bathroom. Four beautiful beaches within walking distance: Rifflet (2 min), Gadet (5 min), Grande Anse and La Perle (20 min). A 20 m² sea-view terrace: a relaxation corner (2 hammocks), a dining area and garden furniture. Free private parking.",
      ],
    },
    highlights: {
      fr: [
        "Vue mer unique",
        "Au-dessus de la plage de Grande Anse",
        "« Un petit coin de paradis »",
      ],
      en: [
        "Unique sea view",
        "Above Grande Anse beach",
        "“A little piece of paradise”",
      ],
    },
    facts: [
      {
        label: { fr: "Surface", en: "Surface" },
        value: { fr: "20 m²", en: "20 m²" },
      },
      {
        label: { fr: "Type", en: "Type" },
        value: {
          fr: "Studio en rez-de-chaussée, vue mer — résidence les Rêves d'Or",
          en: "Ground-floor sea-view studio — Rêves d'Or residence",
        },
      },
      {
        label: { fr: "Plages à pied", en: "Beaches on foot" },
        value: {
          fr: "Rifflet (2 min), Gadet (5 min), Grande Anse et la Perle (20 min)",
          en: "Rifflet (2 min), Gadet (5 min), Grande Anse and La Perle (20 min)",
        },
      },
      {
        label: { fr: "Stationnement", en: "Parking" },
        value: { fr: "Parking privé gratuit", en: "Free private parking" },
      },
      {
        label: { fr: "Wifi", en: "Wifi" },
        value: { fr: "197 Mb/s", en: "197 Mb/s" },
      },
      {
        label: { fr: "Conciergerie", en: "Concierge" },
        value: { fr: "Marjorie, sur place", en: "Marjorie, on site" },
      },
    ],
    // note hôte : [CONTENU À FOURNIR]
    locationNote: {
      fr: "Deshaies, petit village de pêcheurs du nord-ouest de Basse-Terre : commerces de proximité, restaurants, plages magnifiques, nature luxuriante. Parking de résidence gratuit (emplacement 4), arrêt de bus devant la résidence.",
      en: "Deshaies, a small fishing village in north-west Basse-Terre: local shops, restaurants, beautiful beaches and lush nature. Free residence parking (space 4), bus stop in front of the residence.",
    },
    equipements: [
      {
        id: "bain",
        title: "Salle de bain",
        items: [
          "Sèche-cheveux",
          "Produits de nettoyage",
          "Savon pour le corps",
          "Eau chaude",
          "Gel douche",
        ],
      },
      {
        id: "chambre",
        title: "Chambre & linge",
        items: [
          "Lave-linge",
          "Produits de base (serviettes, draps, savon, papier toilette)",
          "Cintres",
          "Linge de lit coton",
          "Oreillers et couvertures supplémentaires",
          "Stores occultants",
          "Fer à repasser",
          "Étendoir",
          "Moustiquaire",
          "Dressing",
        ],
      },
      {
        id: "divertissement",
        title: "Divertissement",
        items: ["Télévision", "Livres et de quoi lire"],
      },
      {
        id: "famille",
        title: "Famille",
        items: [
          "Lit parapluie (draps fournis)",
          "Chaise haute",
          "Baignoire bébé",
          "Vaisselle enfants",
          "Table à langer",
          "Jeux de société",
        ],
      },
      {
        id: "chauffage",
        title: "Chauffage & climatisation",
        items: ["Climatisation", "Ventilateurs portables"],
      },
      { id: "securite", title: "Sécurité", items: ["Détecteur de fumée"] },
      { id: "internet", title: "Internet & bureau", items: ["Wifi"] },
      {
        id: "cuisine",
        title: "Cuisine & repas",
        items: [
          "Cuisine équipée",
          "Réfrigérateur",
          "Micro-ondes",
          "Nécessaire de cuisine (casseroles, huile, sel, poivre)",
          "Vaisselle et couverts",
          "Mini réfrigérateur",
          "Congélateur",
          "Cuisinière",
          "Bouilloire",
          "Cafetière expresso",
          "Verres à vin",
          "Grille-pain",
          "Plaques de cuisson",
          "Table à manger",
          "Café",
        ],
      },
      {
        id: "emplacement",
        title: "Emplacement",
        items: ["Au bord de l'eau", "Accès à la plage", "Entrée privée"],
      },
      {
        id: "exterieur",
        title: "Extérieur",
        items: [
          "Patio/balcon privé",
          "Mobilier d'extérieur",
          "Hamac",
          "Espace repas en plein air",
          "Essentiels plage (serviettes, parasol, matériel snorkeling)",
        ],
      },
      {
        id: "stationnement",
        title: "Stationnement",
        items: ["Stationnement gratuit sur place"],
      },
      {
        id: "services",
        title: "Services",
        items: [
          "Dépôt de bagages",
          "Séjours longue durée",
          "Arrivée autonome",
          "Boîte à clé sécurisée",
          "Ménage disponible",
        ],
      },
    ],
    rating: 4.87,
    ratingScale: 5,
    reviewCount: 38,
    reviewBadge: { fr: "Coup de cœur voyageurs", en: "Guest favourite" },
    reviews: [
      {
        name: "Laetitia",
        country: "France",
        text: "Studio charmant, avec une vue superbe. Bien équipé, confortable, très propre et bien situé. Et en prime, le plaisir d'aller à pied à la plage. Je recommande sans hésitation !",
      },
      {
        name: "Rodolphe",
        country: "France",
        text: "L'emplacement proche de plusieurs plages magnifiques, la grande terrasse vue mer, l'agencement du logement, le grand professionnalisme de l'accueil.",
      },
      {
        name: "Frédéric",
        country: "Suisse",
        text: "L'emplacement incroyable, la chance d'avoir le coucher de soleil juste en face de la terrasse ! Parfait pour se reposer au calme au cœur de la nature.",
      },
      {
        name: "Mathéo",
        country: "France",
        text: "J'ai aimé la localisation à quelques pas de la plage de Grande Anse, la propreté, l'équipement (clim, machine à laver, moustiquaire), la terrasse, et les petites attentions : cocktail, fruits, bidons d'eau.",
      },
      {
        name: "Leo",
        country: "Finlande",
        text: "Superbe terrasse avec accès à la mer en 5 min à pied ! Très belle décoration et tout ce dont nous avions besoin. Je recommande.",
      },
      {
        name: "Martine",
        country: "Canada",
        text: "Tout : l'emplacement, les gens, le confort et la proximité de la plage qui est magnifique. Magnifiques vacances !",
      },
    ],
    address: "25 Boulevard Vwè Moune, 97126 Deshaies, Guadeloupe",
    mapPoints: [
      { label: "Plage de Rifflet", query: "Plage de Rifflet, Deshaies", mode: "walking" },
      { label: "Plage de Gadet", query: "Plage de Gadet, Deshaies", mode: "walking" },
      { label: "Grande Anse", query: "Plage de Grande Anse, Deshaies", mode: "driving" },
      { label: "Jardin Botanique", query: "Jardin Botanique de Deshaies", mode: "driving" },
      { label: "Bourg de Deshaies", query: "Deshaies, Guadeloupe", mode: "walking" },
    ],
  },

];

/** Les 4 logements, dans l'ordre d'affichage, localisés en six langues. */
export const apartments: Apartment[] = sources.map(localize);

export const apartmentSlugs = apartments.map((a) => a.slug);

/** Ville du logement, lue dans l'adresse (« …, 35400 Saint-Malo, France »). */
export function cityOf(a: Apartment): string | undefined {
  const part = a.address?.split(",").map((p) => p.trim()).find((p) => /^\d{5}\s/.test(p));
  return part?.replace(/^\d{5}\s+/, "");
}

export function getApartment(slug: string): Apartment | undefined {
  return apartments.find((a) => a.slug === slug);
}

/** Petit utilitaire pour lire un champ localisé. */
export function pick<T>(value: Record<Locale, T>, locale: Locale): T {
  return value[locale];
}
