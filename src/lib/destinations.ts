/* ============================================================
   Destinations — source unique pour le globe (marqueurs 3D) et les
   cartes vectorielles 2D (DestinationMap).

   `geo` pointe un GeoJSON vendoré dans public/geo/ (trait de côte
   recollé et simplifié hors ligne) ; son `bbox` porte le cadre affiché,
   c'est lui qui fixe le cadrage de la carte.
   - Saint-Malo : trait de côte OpenStreetMap (ODbL) — la baie, avec les
     3 logements (Intra-Muros ×2 + Paramé).
   - Guadeloupe : geoBoundaries (CC BY 4.0) — l'archipel entier, avec le
     studio de Deshaies (Basse-Terre) en pin.

   `pois` : points d'intérêt RÉELS (positions OpenStreetMap) posés sur la
   carte en petit picto + label serif discret — plages, gares, aéroport —
   distincts des pins logements. Les libellés sont traduits via les
   messages (`map.poi.<id>`).
   ============================================================ */

export type DestinationId = "saint-malo" | "guadeloupe";

export type PoiIcon = "beach" | "train" | "ferry" | "plane" | "town";

export interface Poi {
  /** Clé de traduction `map.poi.<id>`. */
  id: string;
  icon: PoiIcon;
  lat: number;
  lng: number;
  /**
   * Côté du label par rapport au picto : `end` = label À GAUCHE du point
   * (sur l'eau, contre une côte), `start` = à droite, `below` = centré
   * sous le picto (défaut). Choisi pour qu'aucun label n'en chevauche un
   * autre ni un pin logement.
   */
  anchor?: "start" | "end" | "below";
  /** Ancrage sur la carte COMPACTE (mobile, cadre portrait) si différent. */
  compactAnchor?: "start" | "end" | "below";
  /** Masqué sur la carte compacte (deux repères trop proches à cette échelle). */
  compactHidden?: boolean;
}

export interface Destination {
  id: DestinationId;
  /** Nom affiché (identique dans toutes les langues — nom propre). */
  label: string;
  /** Position du marqueur sur le globe. */
  lat: number;
  lng: number;
  /** GeoJSON du trait de côte (public/geo). */
  geo: string;
  /**
   * Cadrage de la carte 2D : `cover` remplit le conteneur (littoral qui
   * sort du cadre), `contain` montre tout le cadre (île entourée d'océan).
   */
  fit: "cover" | "contain";
  /**
   * Cadre RESSERRÉ [ouest, sud, est, nord] pour la carte compacte (conteneur
   * portrait, mobile) : montré en entier (`contain`), il garde les
   * logements ET leurs vignettes dans le cadre. Absent → `bbox` du GeoJSON.
   */
  compactView?: [number, number, number, number];
  /** Points d'intérêt réels (OSM). */
  pois: Poi[];
}

export const destinations: Record<DestinationId, Destination> = {
  "saint-malo": {
    id: "saint-malo",
    label: "Saint-Malo",
    lat: 48.649,
    lng: -2.026,
    geo: "/geo/saint-malo.json",
    fit: "cover",
    // Mobile : de Bon-Secours à Rochebonne, les 3 logements dans le cadre.
    compactView: [-2.046, 48.63, -1.968, 48.68],
    pois: [
      // Positions OSM (Nominatim, août 2026) — plages : centroïde du polygone
      // « beach », gares : le nœud de la station / du terminal.
      // Plage de Bon-Secours — pied des remparts, flanc ouest de l'intra-muros
      // (label sur l'eau).
      {
        id: "bon-secours",
        icon: "beach",
        lat: 48.6487,
        lng: -2.0293,
        anchor: "end",
        // Mobile : au bord gauche du cadre, entre les deux vignettes
        // intra-muros — aucune place lisible pour le label.
        compactHidden: true,
      },
      // Plage du Sillon — la grande plage le long de la digue, à l'est de
      // l'intra-muros, jusqu'à Rochebonne.
      { id: "sillon", icon: "beach", lat: 48.6567, lng: -2.0087, anchor: "start" },
      // Plage de Rochebonne — Paramé, prolongement du Sillon vers l'est
      // (point OSM du boulevard de Rochebonne, en haut de plage).
      {
        id: "rochebonne",
        icon: "beach",
        lat: 48.6636,
        lng: -1.9895,
        anchor: "end",
        // Mobile : à 600 m du pin Paramé, le label passerait sous sa vignette.
        compactHidden: true,
      },
      // Gare de Saint-Malo (SNCF) — au sud, av. Anita Conti / place de la Nouvelle.
      { id: "gare", icon: "train", lat: 48.6466, lng: -2.0043, anchor: "start" },
      // Gare maritime du Naye — terminal ferry, au sud de l'intra-muros.
      {
        id: "gare-maritime",
        icon: "ferry",
        lat: 48.6426,
        lng: -2.0239,
        anchor: "start",
        // Mobile : sous la vignette « Les Remparts Plage ».
        compactHidden: true,
      },
    ],
  },
  guadeloupe: {
    id: "guadeloupe",
    label: "Guadeloupe",
    lat: 16.25,
    lng: -61.55,
    geo: "/geo/guadeloupe.json",
    fit: "contain",
    // Mobile : les deux grandes îles + Marie-Galante, sans la Désirade.
    compactView: [-61.98, 15.95, -61.15, 16.56],
    pois: [
      // Positions OSM (Nominatim, août 2026).
      // Aéroport Guadeloupe – Pôle Caraïbes (PTP), Les Abymes, sud Grande-Terre.
      { id: "ptp-airport", icon: "plane", lat: 16.2656, lng: -61.5275, anchor: "start" },
      // Plage de Grande Anse — la grande plage au nord du bourg de Deshaies.
      {
        id: "grande-anse",
        icon: "beach",
        lat: 16.3213,
        lng: -61.7896,
        anchor: "end",
        // Mobile : la plage est au bord gauche du cadre, label à droite.
        compactAnchor: "start",
      },
      // Le bourg de Deshaies lui-même est un toponyme du GeoJSON
      // (public/geo/guadeloupe.json → `labels`), comme Paramé à Saint-Malo.
    ],
  },
};

export const destinationList = Object.values(destinations);
