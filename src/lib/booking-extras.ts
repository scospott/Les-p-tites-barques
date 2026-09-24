/* ============================================================
   Extras du parcours de réservation (démonstration, en euros — TODO prix réels à confirmer avec la cliente).

   SOURCE UNIQUE : consommée à la fois par le formulaire (BookingBlock, qui
   traduit les libellés via les messages `booking.extras.*`) et par la base de
   connaissance de l'assistant (assistant-prompt.ts, qui les récite en
   français). Deux listes séparées auraient dérivé au premier
   changement de prix — l'assistant annoncerait alors un tarif que la page ne
   pratique pas.
   ============================================================ */

export interface BookingExtra {
  id: string;
  /** Prix en euros. */
  price: number;
  /** Prix par voyageur plutôt que forfaitaire (petit-déjeuner). */
  perGuest?: boolean;
  /** Libellé court pour l'assistant (les pages passent par l'i18n). */
  label: { fr: string; en: string };
}

export const BOOKING_EXTRAS: BookingExtra[] = [
  {
    id: "champagne",
    price: 45,
    label: { fr: "bouteille de champagne", en: "bottle of champagne" },
  },
  {
    id: "roses",
    price: 35,
    label: { fr: "bouquet de roses", en: "bouquet of roses" },
  },
  {
    id: "cake",
    price: 25,
    label: { fr: "gâteau d'accueil", en: "welcome cake" },
  },
  {
    id: "breakfast",
    price: 18,
    perGuest: true,
    label: {
      fr: "petit-déjeuner local le 1er matin",
      en: "local breakfast on the first morning",
    },
  },
  {
    id: "transfer",
    price: 60,
    label: { fr: "transfert gare / aéroport", en: "station / airport transfer" },
  },
];

/** Remise « réservation en direct », appliquée sur le prix des nuits. */
export const DIRECT_DISCOUNT = 0.1;
