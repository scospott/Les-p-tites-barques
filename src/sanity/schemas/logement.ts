import { defineField, defineType } from "sanity";

import {
  CONTENT_GROUP,
  CONTENT_GROUPS,
  frHashField,
  localizedString,
  localizedText,
  seoField,
} from "./localized";

/* Une info pratique = un libellé fixe + une valeur traduisible. Pas de
   `group` : ces champs vivent dans l'objet `infosPratiques`, et un groupe ne
   se référence que depuis le premier niveau d'un document. */
const pratique = (name: string, title: string, description?: string) =>
  localizedString({ name, title, description });

export default defineType({
  name: "logement",
  title: "Logement",
  type: "document",
  groups: [
    ...CONTENT_GROUPS,
    { name: "pratique", title: "Infos pratiques" },
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
    localizedString({
      name: "sousTitre",
      title: "Sous-titre",
      group: CONTENT_GROUP,
      description: "Ex. « Saint-Malo — côté mer ».",
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
    defineField({ name: "chambres", title: "Chambres", type: "number", group: "contenu" }),
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
    localizedText({
      name: "description",
      title: "Description",
      group: CONTENT_GROUP,
      rows: 8,
      description: "Le texte de présentation de la page.",
    }),
    localizedText({
      name: "detailSignature",
      title: "Le détail signature",
      group: CONTENT_GROUP,
      rows: 3,
      description: "La petite chose dont on se souvient — encadrée sous la description.",
    }),

    /* ---- Infos pratiques ---- */
    defineField({
      name: "infosPratiques",
      title: "Infos pratiques",
      type: "object",
      group: "pratique",
      options: { collapsible: true, collapsed: false },
      fields: [
        pratique("plage", "Plage", "Ex. « Bon-Secours à 200 m »."),
        pratique("emplacement", "Emplacement", "Ex. « Cœur de l'intra-muros »."),
        pratique("stationnement", "Stationnement"),
        pratique("arrivee", "Arrivée", "Ex. « à partir de 16 h »."),
        pratique("depart", "Départ", "Ex. « avant 10 h »."),
      ],
    }),
    defineField({
      name: "equipements",
      title: "Équipements",
      type: "array",
      group: "pratique",
      of: [localizedString({ name: "equipement", title: "Équipement" })],
      description: "Un équipement par ligne, en français.",
    }),

    /* ---- Photos ---- */
    defineField({
      name: "imageVitrine",
      title: "Photo vitrine",
      type: "image",
      group: "photos",
      options: { hotspot: true },
      description: "Celle de la carte d'accueil.",
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
            localizedString({
              name: "alt",
              title: "Description de l'image",
              description: "Lue par les lecteurs d'écran et les moteurs de recherche.",
            }),
            localizedString({ name: "legende", title: "Légende (facultative)" }),
          ],
        },
      ],
      validation: (rule) => rule.min(3).error("Au moins 3 photos dans la galerie."),
    }),

    seoField({ group: CONTENT_GROUP }),

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
