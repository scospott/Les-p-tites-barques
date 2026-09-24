import { defineArrayMember, defineField, defineType } from "sanity";

import { DESTINATIONS } from "./lieu";
import {
  CONTENT_GROUP,
  CONTENT_GROUPS,
  faqField,
  frHashField,
  localizedItem,
  localizedString,
  localizedText,
  SEO_FIELDSET,
  seoFields,
} from "./localized";

/* ============================================================
   Logement — TOUT le contenu éditorial d'une fiche. Ce que le site garde en
   code (héros vidéo, tarifs de démonstration, mise en page de la carte) vit
   dans src/lib/appartements.ts, indexé par le slug.
   ============================================================ */

/** Icônes disponibles pour une catégorie d'équipements (cf. <Equipements>). */
export const EQUIPEMENT_ICONES = [
  { title: "Salle de bain", value: "bain" },
  { title: "Chambre & linge", value: "chambre" },
  { title: "Multimédia", value: "multimedia" },
  { title: "Divertissement", value: "divertissement" },
  { title: "Famille", value: "famille" },
  { title: "Chauffage / climatisation", value: "chauffage" },
  { title: "Vue", value: "vue" },
  { title: "Sécurité", value: "securite" },
  { title: "Extérieur", value: "exterieur" },
  { title: "Internet & bureau", value: "internet" },
  { title: "Cuisine & repas", value: "cuisine" },
  { title: "Emplacement", value: "emplacement" },
  { title: "Stationnement", value: "stationnement" },
  { title: "Services", value: "services" },
  { title: "Salon", value: "salon" },
  { title: "Divers", value: "divers" },
  { title: "Langues", value: "langues" },
];

export default defineType({
  name: "logement",
  title: "Logement",
  type: "document",
  fieldsets: [SEO_FIELDSET],
  groups: [
    ...CONTENT_GROUPS,
    { name: "pratique", title: "Infos pratiques" },
    { name: "assistante", title: "Assistante & FAQ" },
    { name: "situation", title: "Situation" },
    { name: "avis", title: "Note voyageurs" },
    { name: "photos", title: "Photos" },
    { name: "admin", title: "Administratif" },
  ],
  fields: [
    defineField({
      name: "nom",
      title: "Nom",
      type: "string",
      group: "contenu",
      description: "Le nom de la maison — jamais traduit.",
      validation: (rule) => rule.required().error("Le nom est obligatoire."),
    }),
    defineField({
      name: "slug",
      title: "Adresse de la page",
      type: "slug",
      group: "contenu",
      options: { source: "nom", maxLength: 64 },
      description:
        "Se remplit depuis le nom. À ne plus toucher une fois la page en ligne : " +
        "changer l'adresse casse les liens déjà partagés.",
      readOnly: ({ value }) => !!value,
      validation: (rule) => rule.required().error("L'adresse de la page est obligatoire."),
    }),
    defineField({
      name: "destination",
      title: "Destination",
      type: "string",
      group: "contenu",
      options: { list: DESTINATIONS, layout: "radio" },
      validation: (rule) => rule.required().error("La destination est obligatoire."),
    }),
    ...localizedString({
      name: "sousTitre",
      title: "Sous-titre (lieu)",
      group: CONTENT_GROUP,
      description: "Ex. « Saint-Malo — côté mer ». Au-dessus du nom sur les cartes.",
      required: true,
    }),
    ...localizedString({
      name: "accroche",
      title: "Accroche",
      group: CONTENT_GROUP,
      description: "Une phrase, sous le nom sur les cartes. Ex. « Proche des remparts, côté mer. »",
      required: true,
    }),
    defineField({ name: "ville", title: "Ville", type: "string", group: "contenu" }),
    defineField({
      name: "ordre",
      title: "Ordre d'affichage",
      type: "number",
      group: "contenu",
      description: "Du plus petit au plus grand, sur l'accueil et dans les listes.",
    }),
    defineField({
      name: "publie",
      title: "Publié",
      type: "boolean",
      group: "contenu",
      initialValue: true,
      description: "Décoché, le logement disparaît du site.",
    }),

    /* ---- Composition ---- */
    defineField({
      name: "capacite",
      title: "Voyageurs",
      type: "number",
      group: "contenu",
      validation: (rule) => rule.required().min(1).error("La capacité est obligatoire."),
    }),
    defineField({
      name: "chambres",
      title: "Chambres",
      type: "number",
      group: "contenu",
      description: "0 = studio (affiché « Studio »).",
    }),
    defineField({ name: "lits", title: "Lits", type: "number", group: "contenu" }),
    defineField({
      name: "sallesDeBain",
      title: "Salles de bain",
      type: "number",
      group: "contenu",
    }),
    defineField({
      name: "surface",
      title: "Surface (m²)",
      type: "number",
      group: "contenu",
    }),

    /* ---- Textes ---- */
    ...localizedText({
      name: "description",
      title: "Description",
      group: CONTENT_GROUP,
      rows: 8,
      description:
        "Le texte de présentation de la page. Une ligne vide sépare deux paragraphes ; " +
        "le premier est mis en valeur (italique).",
    }),
    ...localizedText({
      name: "detailSignature",
      title: "Le détail signature",
      group: CONTENT_GROUP,
      rows: 3,
      description: "La petite chose dont on se souvient — encadrée sous la description.",
    }),
    defineField({
      name: "atouts",
      title: "Ce que l'on aime",
      type: "array",
      group: "contenu",
      description: "Atouts du logement, un par ligne (lus par l'assistante).",
      of: [localizedItem({ name: "atout", title: "Atout" })],
    }),

    /* ---- Infos pratiques ---- */
    defineField({
      name: "infosCles",
      title: "Infos clés",
      type: "array",
      group: "pratique",
      description:
        "Plage, stationnement, type, accessibilité… Lues par l'assistante (pas affichées " +
        "telles quelles sur la page). Surface et n° d'enregistrement ont leurs propres champs.",
      of: [
        defineArrayMember({
          type: "object",
          name: "info",
          fields: [
            ...localizedString({ name: "libelle", title: "Libellé", required: true }),
            ...localizedString({ name: "valeur", title: "Valeur", required: true }),
          ],
          preview: {
            select: { title: "libelle", subtitle: "valeur" },
          },
        }),
      ],
    }),
    defineField({
      name: "equipements",
      title: "Équipements",
      type: "array",
      group: "pratique",
      description:
        "Une catégorie par ligne (accordéon de la page), avec son icône et ses éléments. " +
        "Rédigés en français, affichés tels quels dans toutes les langues.",
      of: [
        defineArrayMember({
          type: "object",
          name: "categorie",
          fields: [
            defineField({
              name: "icone",
              title: "Icône",
              type: "string",
              options: { list: EQUIPEMENT_ICONES },
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "titre",
              title: "Titre",
              type: "string",
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "elements",
              title: "Éléments",
              type: "array",
              of: [{ type: "string" }],
            }),
          ],
          preview: { select: { title: "titre", subtitle: "icone" } },
        }),
      ],
    }),

    /* ---- Assistante & FAQ ---- */
    faqField({
      group: "assistante",
      description:
        "Questions affichées en accordéon sur la page (et balisées pour Google). " +
        "Ne répondre qu'avec ce qui est vrai pour ce logement.",
    }),
    defineField({
      name: "questionsSuggerees",
      title: "Questions suggérées",
      type: "array",
      group: "assistante",
      description: "Les 4 questions proposées par l'assistante quand on parle de ce logement.",
      of: [localizedItem({ name: "question", title: "Question" })],
      validation: (rule) => rule.max(4).warning("4 questions au plus."),
    }),

    /* ---- Situation ---- */
    defineField({
      name: "adresse",
      title: "Adresse",
      type: "string",
      group: "situation",
      description: "Point de départ des itinéraires de la section « Alentours ».",
    }),
    ...localizedText({
      name: "situation",
      title: "Note de situation",
      group: "situation",
      rows: 3,
      description: "Sous la carte de la section « Alentours ».",
    }),
    defineField({
      name: "itineraires",
      title: "Itinéraires (Alentours)",
      type: "array",
      group: "situation",
      description: "Les lieux proposés en boutons, dans l'ordre.",
      of: [
        defineArrayMember({
          type: "object",
          name: "itineraire",
          fields: [
            defineField({
              name: "lieu",
              title: "Lieu",
              type: "reference",
              to: [{ type: "lieu" }],
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "mode",
              title: "Trajet",
              type: "string",
              options: {
                list: [
                  { title: "À pied", value: "walking" },
                  { title: "En voiture", value: "driving" },
                ],
                layout: "radio",
              },
              initialValue: "driving",
            }),
          ],
          preview: { select: { title: "lieu.nom", subtitle: "mode" } },
        }),
      ],
    }),
    defineField({
      name: "position",
      title: "Position sur la carte",
      type: "object",
      group: "situation",
      description: "Coordonnées du QUARTIER (jamais de l'adresse exacte), pour la carte de l'accueil.",
      fields: [
        { name: "lat", title: "Latitude", type: "number" },
        { name: "lng", title: "Longitude", type: "number" },
      ],
    }),
    ...localizedString({
      name: "quartier",
      title: "Quartier (carte)",
      group: "situation",
      description: "Libellé court sous le nom, sur la carte de l'accueil. Ex. « Intra-Muros ».",
    }),

    /* ---- Note voyageurs ---- */
    defineField({
      name: "noteVoyageurs",
      title: "Note voyageurs",
      type: "object",
      group: "avis",
      description: "Recopiée de la plateforme (affichée dans la section Avis, jamais balisée pour Google).",
      fields: [
        { name: "note", title: "Note", type: "number" },
        {
          name: "echelle",
          title: "Sur",
          type: "number",
          options: { list: [5, 10], layout: "radio" },
          initialValue: 5,
        },
        { name: "nombreAvis", title: "Nombre d'avis", type: "number" },
      ],
    }),
    // Au premier niveau, pas dans `noteVoyageurs` : un texte traduisible
    // n'est jamais dans un objet (cf. localized.ts).
    ...localizedString({
      name: "noteBadge",
      title: "Distinction",
      group: "avis",
      description: "Ex. « Coup de cœur voyageurs · Top 5% Airbnb ».",
    }),

    /* ---- Photos ---- */
    defineField({
      name: "imageVitrine",
      title: "Photo vitrine",
      type: "image",
      group: "photos",
      options: { hotspot: true },
      description: "Celle de la carte d'accueil, de la fenêtre « Réserver » et de la carte.",
      validation: (rule) => rule.required().error("La photo vitrine est obligatoire."),
    }),
    defineField({
      name: "galerie",
      title: "Galerie",
      type: "array",
      group: "photos",
      options: { layout: "grid" },
      of: [
        {
          type: "image",
          options: { hotspot: true },
          fields: [
            ...localizedString({
              name: "alt",
              title: "Description de l'image",
              description:
                "Lue par les lecteurs d'écran et les moteurs de recherche. Vide : « {nom} — photo N ».",
            }),
            ...localizedString({ name: "legende", title: "Légende (facultative)" }),
          ],
        },
      ],
      validation: (rule) => rule.min(3).error("Au moins 3 photos dans la galerie."),
    }),

    ...seoFields({ group: CONTENT_GROUP }),

    /* ---- Administratif ---- */
    defineField({
      name: "numeroEnregistrement",
      title: "N° d'enregistrement",
      type: "string",
      group: "admin",
      description: "Meublé de tourisme — mention légale affichée sur la page.",
    }),
    defineField({
      name: "smoobuId",
      title: "Identifiant Smoobu",
      type: "string",
      group: "admin",
      description: "Pour le calendrier de réservation. Laisser vide tant qu'il n'est pas connu.",
    }),
    defineField({
      name: "prixPlateformeReference",
      title: "Prix plateforme de référence",
      type: "number",
      group: "admin",
      description:
        "Prix par nuit affiché sur les plateformes — sert uniquement à calculer " +
        "l'écart avec le tarif direct.",
    }),
    frHashField,
  ],
  orderings: [
    {
      name: "ordre",
      title: "Ordre d'affichage",
      by: [{ field: "ordre", direction: "asc" }],
    },
  ],
  preview: {
    select: { title: "nom", subtitle: "ville", media: "imageVitrine" },
  },
});
