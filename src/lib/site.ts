/*
 * Configuration globale du site — Les P'tites Barques. Uniquement de la
 * CONFIGURATION : le contenu (contact, réseaux, baseline, mot de l'hôtesse,
 * mentions légales) vient de Sanity › Site (cf. getSite).
 */
export const site = {
  name: "Les P'tites Barques",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://lesptitesbarques.com").replace(
    /\/$/,
    "",
  ),
  /*
   * Interrupteur d'indexation. Tant que NEXT_PUBLIC_INDEXING ne vaut pas
   * exactement "true", tout le site est en noindex/nofollow (meta + en-tête
   * X-Robots-Tag) et robots.txt répond `Disallow: /`. Le jour de la mise en
   * ligne : passer la variable à "true" dans Vercel et redéployer, sans
   * toucher au code.
   */
  indexing: process.env.NEXT_PUBLIC_INDEXING === "true",
} as const;
