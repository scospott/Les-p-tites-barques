/* ============================================================
   Moteur de réservation — interrupteur `BOOKING_ENGINE` (Vercel).

   - `none` (défaut) : aucun moteur branché. Tout bouton « Réserver » ouvre
     la fenêtre de contact honnête (<BookingContactModal>) : pas de prix,
     pas de calendrier, pas de tunnel fictif.
   - `beds24` : le parcours de réservation (BookingModal → BookingBlock,
     tarifs et extras) redevient visible. Son code est conservé tel quel
     en attendant d'y brancher le vrai moteur.

   Lu côté client comme côté serveur : next.config.ts l'expose au bundle.
   ============================================================ */

export type BookingEngine = "none" | "beds24";

export const BOOKING_ENGINE: BookingEngine =
  process.env.BOOKING_ENGINE === "beds24" ? "beds24" : "none";

/** Le parcours de réservation en ligne est-il ouvert ? */
export const bookingLive = BOOKING_ENGINE !== "none";

/** Événement global qui ouvre la fenêtre de contact (cf. openBookingContact). */
export const OPEN_BOOKING_EVENT = "lesptitesbarques:open-booking";

/** Ouvre la fenêtre « la réservation en ligne arrive », pour un logement ou non. */
export function openBookingContact(apartmentName?: string) {
  window.dispatchEvent(
    new CustomEvent(OPEN_BOOKING_EVENT, { detail: { apartmentName } }),
  );
}
