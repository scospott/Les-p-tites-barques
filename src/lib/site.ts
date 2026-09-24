// Configuration globale du site — Les P'tites Barques (site client, Gwenaëlle).
export const site = {
  name: "Les P'tites Barques",
  // Adresse de contact de démonstration — à remplacer par la vraie adresse de Gwenaëlle.
  // TODO adresse e-mail réelle de la cliente (placeholder)
  email: "contact@lesptitesbarques.com",
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
  /*
   * Réseaux sociaux officiels — boutons du footer ET `Organization.sameAs`
   * (JSON-LD). Chaîne vide tant qu'un compte n'existe pas : le bouton et
   * l'entrée sameAs disparaissent ; jamais d'URL placeholder ici.
   */
  // Compte Instagram officiel — bouton Instagram du footer.
  instagram: "https://www.instagram.com/lesptitesbarques/" as string,
  facebook: "https://www.facebook.com/p/Les-ptites-barques-61576658834802/" as string,
} as const;
