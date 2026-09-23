import { createClient } from "next-sanity";

import { apiVersion, dataset, projectId } from "./env";

/**
 * Client de LECTURE, côté site. `useCdn: true` : les requêtes passent par le
 * CDN de Sanity (contenu à quelques secondes près, mais servi depuis le bord
 * du réseau). Le client d'ÉCRITURE vit uniquement dans le script de
 * migration, avec le token — jamais ici, jamais dans un bundle client.
 */
export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
});
