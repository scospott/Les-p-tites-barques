import { defineQuery } from "next-sanity";

/* ============================================================
   Requêtes GROQ du site — une par besoin, typées côté adaptateurs
   (src/sanity/adapters.ts). Un champ traduisible remonte avec ses cinq
   frères plats (`titre`, `titreEn`, `titreDe`… — cf. schemas/localized.ts) ;
   la résolution de langue se fait dans les adaptateurs (`localise`, repli
   sur le français).

   Brouillons : le client lit le dataset public, en perspective
   « published » — un document en cours d'édition n'apparaît qu'une fois
   publié.
   ============================================================ */

/** Une image : l'URL de l'asset (sans paramètres) + dimensions. */
const IMAGE = `{ "url": asset->url, "width": asset->metadata.dimensions.width, "height": asset->metadata.dimensions.height }`;

const SUFFIXES = ["", "En", "De", "Nl", "Es", "Zh"];

/** Un champ traduisible et ses traductions : `tr("titre")` → `titre, titreEn, …`. */
const tr = (...names: string[]) =>
  names.flatMap((n) => SUFFIXES.map((s) => n + s)).join(", ");

const SEO = `seo{ ${tr("title", "description")} }`;

const FAQ = `faq[]{ ${tr("question", "reponse")} }`;

const LOGEMENT = `{
  _id,
  _updatedAt,
  nom,
  "slug": slug.current,
  destination,
  ${tr("sousTitre", "accroche")},
  ville,
  ordre,
  capacite,
  chambres,
  lits,
  sallesDeBain,
  surface,
  ${tr("description", "detailSignature")},
  atouts[]{ ${tr("atout")} },
  infosCles[]{ ${tr("libelle", "valeur")} },
  equipements[]{ icone, titre, elements },
  ${FAQ},
  questionsSuggerees[]{ ${tr("question")} },
  adresse,
  ${tr("situation")},
  itineraires[]{ mode, "lieu": lieu->{ nom, requeteMaps } },
  position,
  ${tr("quartier")},
  noteVoyageurs{ note, echelle, nombreAvis, ${tr("badge")} },
  "vitrine": imageVitrine${IMAGE},
  "galerie": galerie[]{ ${tr("alt", "legende")}, ...${IMAGE} },
  ${SEO},
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
  ${tr("surtitre", "titre", "sousTitre", "heroAlt", "intro")},
  typesVoyageurs[]{ ${tr("typeVoyageur")} },
  ${FAQ},
  ${SEO},
  "logements": logements[@->publie != false]->slug.current,
  "lieux": lieux[]->{ nom, requeteMaps }
}`);

/** Le singleton `site`. */
export const SITE_QUERY = defineQuery(`*[_type == "site" && _id == "site"][0] {
  _updatedAt,
  contact,
  reseaux,
  ${tr("baseline")},
  hotesse{ nom, ${tr("texte")}, "photo": photo${IMAGE} },
  ${SEO},
  mentionsLegales[]{ ${tr("titre", "paragraphes")}, cle }
}`);

/** Le singleton `assistante`. */
export const ASSISTANTE_QUERY = defineQuery(`*[_type == "assistante" && _id == "assistante"][0] {
  consignesGenerales,
  ${FAQ},
  ${tr("reglesMaison", "recommandations")}
}`);

/** Avis publiés (tous logements), par logement puis ordre. */
export const AVIS_QUERY = defineQuery(`*[_type == "avis" && publie != false] | order(logement._ref asc, ordre asc) {
  prenom, pays, date, texte, "logement": logement->slug.current
}`);

/** Lieux d'une destination, dans l'ordre. */
export const LIEUX_QUERY = defineQuery(`*[_type == "lieu" && destination == $destination] | order(ordre asc) {
  nom, requeteMaps, categorie, latitude, longitude
}`);
