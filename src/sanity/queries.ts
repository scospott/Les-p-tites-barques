import { defineQuery } from "next-sanity";

/* ============================================================
   Requêtes GROQ du site — une par besoin, typées côté adaptateurs
   (src/sanity/adapters.ts). Les champs traduisibles remontent tels quels
   (`{ fr, translations: { en, … } }`) ; la résolution de langue se fait
   dans les adaptateurs (`localise`, repli sur le français).

   Brouillons : le client lit le dataset public via le CDN, en perspective
   « published » — un document en cours d'édition n'apparaît qu'une fois
   publié.
   ============================================================ */

/** Une image : l'URL de l'asset (sans paramètres) + dimensions. */
const IMAGE = `{ "url": asset->url, "width": asset->metadata.dimensions.width, "height": asset->metadata.dimensions.height }`;

const FAQ = `faq[]{ question, reponse }`;

const LOGEMENT = `{
  _id,
  _updatedAt,
  nom,
  "slug": slug.current,
  destination,
  sousTitre,
  accroche,
  ville,
  ordre,
  capacite,
  chambres,
  lits,
  sallesDeBain,
  surface,
  description,
  detailSignature,
  atouts,
  infosCles[]{ libelle, valeur },
  equipements[]{ icone, titre, elements },
  ${FAQ},
  questionsSuggerees,
  adresse,
  situation,
  itineraires[]{ mode, "lieu": lieu->{ nom, requeteMaps } },
  position,
  quartier,
  noteVoyageurs,
  "vitrine": imageVitrine${IMAGE},
  "galerie": galerie[]{ alt, legende, ...${IMAGE} },
  seo,
  numeroEnregistrement,
  "avis": *[_type == "avis" && publie != false && logement._ref == ^._id] | order(ordre asc, date desc){
    prenom, pays, date, texte
  }
}`;

/** Logements publiés, dans l'ordre d'affichage. */
export const LOGEMENTS_QUERY = defineQuery(
  `*[_type == "logement" && publie != false && defined(slug.current)] | order(ordre asc) ${LOGEMENT}`,
);

/** Un logement publié par son slug. */
export const LOGEMENT_QUERY = defineQuery(
  `*[_type == "logement" && publie != false && slug.current == $slug][0] ${LOGEMENT}`,
);

/** Les pages destination, avec leurs logements et lieux (dans l'ordre choisi). */
export const DESTINATIONS_QUERY = defineQuery(`*[_type == "destination"] | order(ordre asc) {
  _updatedAt,
  slug,
  nom,
  lieuSchema,
  region,
  surtitre,
  titre,
  sousTitre,
  heroAlt,
  intro,
  typesVoyageurs,
  ${FAQ},
  seo,
  "logements": logements[@->publie != false]->slug.current,
  "lieux": lieux[]->{ nom, requeteMaps }
}`);

/** Le singleton `site`. */
export const SITE_QUERY = defineQuery(`*[_type == "site" && _id == "site"][0] {
  _updatedAt,
  contact,
  reseaux,
  baseline,
  hotesse{ nom, texte, "photo": photo${IMAGE} },
  seo,
  mentionsLegales[]{ titre, paragraphes, cle }
}`);

/** Le singleton `assistante`. */
export const ASSISTANTE_QUERY = defineQuery(`*[_type == "assistante" && _id == "assistante"][0] {
  consignesGenerales,
  ${FAQ},
  reglesMaison,
  recommandations
}`);

/** Avis publiés (tous logements), par logement puis ordre. */
export const AVIS_QUERY = defineQuery(`*[_type == "avis" && publie != false] | order(logement._ref asc, ordre asc) {
  prenom, pays, date, texte, "logement": logement->slug.current
}`);

/** Lieux d'une destination, dans l'ordre. */
export const LIEUX_QUERY = defineQuery(`*[_type == "lieu" && destination == $destination] | order(ordre asc) {
  nom, requeteMaps, categorie, latitude, longitude
}`);
