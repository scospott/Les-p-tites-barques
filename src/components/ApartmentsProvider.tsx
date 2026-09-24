"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { ApartmentSummary } from "@/lib/appartements";

/* Logements publiés (Sanity), transmis une fois par le layout aux composants
   client : fenêtre « Réserver », carte de l'accueil, assistante, 404. */
const ApartmentsContext = createContext<ApartmentSummary[]>([]);

export function ApartmentsProvider({
  apartments,
  children,
}: {
  apartments: ApartmentSummary[];
  children: ReactNode;
}) {
  return <ApartmentsContext.Provider value={apartments}>{children}</ApartmentsContext.Provider>;
}

/** Les logements publiés, dans l'ordre d'affichage. */
export function useApartments(): ApartmentSummary[] {
  return useContext(ApartmentsContext);
}
