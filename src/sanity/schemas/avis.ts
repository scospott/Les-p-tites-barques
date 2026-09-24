import { defineField, defineType } from "sanity";

import {
  CONTENT_GROUP,
  CONTENT_GROUPS,
  frHashField,
  localizedText,
} from "./localized";

export const AVIS_SOURCES = [
  { title: "Airbnb", value: "airbnb" },
  { title: "Booking", value: "booking" },
  { title: "En direct", value: "direct" },
  { title: "Autre", value: "autre" },
];

export default defineType({
  name: "avis",
  title: "Avis",
  type: "document",
  groups: CONTENT_GROUPS,
  fields: [
    defineField({
      name: "prenom",
      title: "Prénom",
      type: "string",
      group: "contenu",
      validation: (rule) => rule.required().error("Le prénom est obligatoire."),
    }),
    ...localizedText({
      name: "texte",
      title: "Avis",
      group: CONTENT_GROUP,
      rows: 5,
      description:
        "Dans la langue d'origine du voyageur : l'avis est affiché tel quel dans toutes " +
        "les langues du site (jamais traduit).",
    }),
    defineField({
      name: "note",
      title: "Note (sur 5)",
      type: "number",
      group: "contenu",
      validation: (rule) => rule.min(1).max(5),
    }),
    defineField({
      name: "source",
      title: "Source",
      type: "string",
      group: "contenu",
      options: { list: AVIS_SOURCES, layout: "dropdown" },
    }),
    defineField({
      name: "pays",
      title: "Pays du voyageur",
      type: "string",
      group: "contenu",
      description: "Affiché sous le prénom, tel quel (non traduit).",
    }),
    defineField({ name: "date", title: "Date du séjour", type: "date", group: "contenu" }),
    defineField({
      name: "ordre",
      title: "Ordre d'affichage",
      type: "number",
      group: "contenu",
      description: "Ordre dans le carrousel de la fiche (du plus petit au plus grand).",
    }),
    defineField({
      name: "logement",
      title: "Logement",
      type: "reference",
      group: "contenu",
      to: [{ type: "logement" }],
      description: "Le logement dont parle l'avis — il n'apparaît que sur sa page.",
      validation: (rule) => rule.required().error("Choisissez le logement concerné."),
    }),
    defineField({
      name: "publie",
      title: "Publié",
      type: "boolean",
      group: "contenu",
      initialValue: true,
    }),
    frHashField,
  ],
  orderings: [
    { name: "ordre", title: "Ordre d'affichage", by: [{ field: "ordre", direction: "asc" }] },
    { name: "date", title: "Date (récent d'abord)", by: [{ field: "date", direction: "desc" }] },
  ],
  preview: {
    select: { prenom: "prenom", note: "note", logement: "logement.nom", date: "date", source: "source" },
    // Titre : prénom · note · logement ; sous-titre : date · source.
    prepare: ({ prenom, note, logement, date, source }) => ({
      title: [prenom, note ? `${note}/5` : null, logement ?? "sans logement"]
        .filter(Boolean)
        .join(" · "),
      subtitle: [date, source].filter(Boolean).join(" · "),
    }),
  },
});
