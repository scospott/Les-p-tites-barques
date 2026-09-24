import { createClient } from "next-sanity";

import { apiVersion, dataset, projectId } from "./env";

/**
 * Client de LECTURE, côté site (sans token : dataset public, documents
 * publiés uniquement). Le client d'ÉCRITURE vit uniquement dans le script
 * de migration — jamais ici, jamais dans un bundle client.
 *
 * `useCdn: false` — VOULU. Le cache est celui de Next (Data Cache, 5 min +
 * webhook, cf. fetch.ts) : l'API n'est interrogée qu'à la revalidation.
 * Avec le CDN de Sanity, la revalidation déclenchée par le webhook relisait
 * parfois la version d'AVANT la publication (le CDN n'est pas encore à jour
 * à cet instant) et Next la gardait 5 minutes : constaté au test d'édition
 * (septembre 2026), une annulation restait invisible.
 */
export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  perspective: "published",
});
