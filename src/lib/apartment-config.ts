import type { ApartmentStatus, Pricing } from "./appartements";

/* ============================================================
   Réglages STRUCTURELS des logements — ce qui reste dans le code quand
   tout le contenu éditorial vient de Sanity. Indexé par slug.

   - Héros : séquences scroll-scrub (public/heroes, cf. heroSequences),
     photo Ken Burns locale de Paramé, cadrage — des médias lourds et
     réglés à la main, hors back-office.
   - `pricing` : tarifs de DÉMONSTRATION du parcours de réservation.
     TODO tarifs réels à confirmer avec la cliente ; ils iront dans Sanity
     (ou Smoobu) quand ils existeront — pas avant, pour ne jamais afficher
     un faux prix « officiel ».
   - `card` / `compactCard` : côté de la vignette sur la carte de l'accueil
     (mise en page, pas du contenu : réglé pour que deux biens proches ne
     se chevauchent pas).

   Un logement créé dans le Studio sans entrée ici fonctionne : héros Ken
   Burns sur sa vitrine, pas de tarifs (bloc réservation en mode « à
   renseigner »), vignette au-dessus du point.
   ============================================================ */

export type MapCardSide = "top" | "bottom" | "bottom-left";

export interface ApartmentConfig {
  /** Héros scrub (clés dans heroSequences), dans l'ordre : [héros 1, héros 2]. */
  scrubHeroes?: string[];
  /** Pas de héros 2 : la section est retirée de la fiche. */
  noHero2?: boolean;
  /** Photo LOCALE du héros 1 (Ken Burns) si pas de clip — défaut : la vitrine. */
  hero1Image?: string;
  /** Photo LOCALE du héros 2 (Ken Burns) si pas de clip — défaut : 1re photo de galerie. */
  hero2Image?: string;
  hero2Framing?: { position?: string; calmZoom?: boolean };
  /** Nombre minimal de cartes du carrousel (placeholders au-delà). */
  gallerySlots?: number;
  pricing?: Pricing;
  card?: MapCardSide;
  compactCard?: MapCardSide;
  status?: ApartmentStatus;
}

export const apartmentConfig: Record<string, ApartmentConfig> = {
  "les-remparts-mer": {
    scrubHeroes: ["remparts-mer-1", "remparts-mer-2"],
    pricing: { high: 180, low: 150, cleaning: 50 },
    card: "top",
  },
  "les-remparts-plage": {
    scrubHeroes: ["remparts-plage-1", "remparts-plage-2"],
    pricing: { high: 170, low: 140, cleaning: 50 },
    // Vignette sous le point, décalée à gauche : la gare maritime du Naye
    // est juste au sud de l'intra-muros. Mobile : centrée.
    card: "bottom-left",
    compactCard: "bottom",
  },
  parame: {
    // Un seul clip : héros 2 en Ken Burns sur une photo pro PAYSAGE locale
    // (les vélos électriques sur la terrasse), ancrée à 40 % et zoom apaisé.
    scrubHeroes: ["parame-1"],
    hero2Image: "/images/parame-pro/photo-02.jpg",
    hero2Framing: { position: "center 40%", calmZoom: true },
    pricing: { high: 130, low: 110, cleaning: 40 },
    card: "top",
  },
  // L'Antillaise (Deshaies) — slug `guadeloupe` jusqu'en septembre 2026,
  // redirigé en 308 (cf. next.config.ts).
  "l-antillaise": {
    scrubHeroes: ["guadeloupe-1"],
    noHero2: true,
    pricing: { high: 120, low: 100, cleaning: 45 },
    // Sous le point : les plages de Grande Anse et de Rifflet sont juste au nord.
    card: "bottom",
  },
};

/** Héros scrub d'un logement — lu par le préchargement (hero-prefetch). */
export function scrubHeroesOf(slug: string): string[] {
  return apartmentConfig[slug]?.scrubHeroes ?? [];
}
