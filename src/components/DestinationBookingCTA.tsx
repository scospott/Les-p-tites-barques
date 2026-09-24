"use client";

import { useCallback, useState } from "react";

import BookingModal from "@/components/BookingModal";
import type { Apartment } from "@/lib/appartements";
import { bookingLive, openBookingContact } from "@/lib/booking";

/**
 * Bouton « Réserver » d'une page destination : la modal limitée à ses
 * logements — ou, sans moteur de réservation, la fenêtre de contact.
 */
export default function DestinationBookingCTA({
  label,
  region,
}: {
  label: string;
  region: Apartment["region"];
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button
        type="button"
        onClick={() => (bookingLive ? setOpen(true) : openBookingContact())}
        className="btn btn-primary mt-9 px-8 py-3.5"
      >
        {label}
      </button>
      <BookingModal open={open} onClose={close} region={region} />
    </>
  );
}
