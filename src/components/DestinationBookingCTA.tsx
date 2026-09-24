"use client";

import { useCallback, useState } from "react";

import BookingModal from "@/components/BookingModal";
import type { Apartment } from "@/lib/appartements";

/** Bouton « Réserver » d'une page destination : la modal limitée à ses logements. */
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
        onClick={() => setOpen(true)}
        className="btn btn-primary mt-9 px-8 py-3.5"
      >
        {label}
      </button>
      <BookingModal open={open} onClose={close} region={region} />
    </>
  );
}
