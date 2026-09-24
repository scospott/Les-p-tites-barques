import "server-only";

import type { QueryParams } from "next-sanity";

import { client } from "./client";

/* ============================================================
   Lecture Sanity côté serveur — TOUTES les requêtes du site passent ici.

   Cache : Data Cache de Next, 5 minutes (`revalidate: 300`), étiqueté par
   type de document. Le webhook Sanity (POST /api/revalidate) invalide les
   étiquettes à chaque publication : une modification dans le Studio est
   en ligne en quelques secondes, et au pire en 5 minutes. Lecture de
   l'API (pas du CDN Sanity) : voir client.ts.

   PAS DE REPLI SILENCIEUX : une erreur réseau ou une réponse vide remonte
   telle quelle. Au build, la page (et donc le build) échoue proprement ;
   en production, Next garde la dernière version valide de la page.
   ============================================================ */

/** Étiquettes de cache = types de documents Sanity. */
export type SanityTag = "logement" | "avis" | "lieu" | "destination" | "site" | "assistante";

export const REVALIDATE_SECONDS = 300;

export async function sanityFetch<T>(
  query: string,
  params: QueryParams = {},
  tags: SanityTag[] = [],
): Promise<T> {
  return client.fetch<T>(query, params, {
    next: { revalidate: REVALIDATE_SECONDS, tags },
  });
}
