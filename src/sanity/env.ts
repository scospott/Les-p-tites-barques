/* Variables d'environnement du projet Sanity. Publiques (préfixe
   NEXT_PUBLIC) : l'identifiant de projet et le dataset ne sont pas des
   secrets — seul le token d'écriture l'est, et il ne vit que côté script de
   migration (`SANITY_MIGRATION_TOKEN`, dans .env.local, jamais commité). */

/**
 * Date d'API figée : Sanity garantit la compatibilité d'une requête pour une
 * date donnée. La faire évoluer est un choix explicite, jamais un effet de
 * bord d'un déploiement.
 */
export const apiVersion = "2026-08-28";

export const dataset = required(
  process.env.NEXT_PUBLIC_SANITY_DATASET,
  "NEXT_PUBLIC_SANITY_DATASET",
);

export const projectId = required(
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  "NEXT_PUBLIC_SANITY_PROJECT_ID",
);

function required<T>(value: T | undefined, name: string): T {
  if (value === undefined) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}
