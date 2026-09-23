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
    localizedText({ name: "texte", title: "Avis", group: CONTENT_GROUP, rows: 5 }),
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
    defineField({ name: "date", title: "Date du séjour", type: "date", group: "contenu" }),
    defineField({
      name: "logement",
      title: "Logement",
      type: "reference",
      group: "contenu",
      to: [{ type: "logement" }],
      description: "Facultatif — un avis peut porter sur l'accueil en général.",
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
    { name: "date", title: "Date (récent d'abord)", by: [{ field: "date", direction: "desc" }] },
  ],
  preview: {
    select: { title: "prenom", note: "note", source: "source", logement: "logement.nom" },
    prepare: ({ title, note, source, logement }) => ({
      title,
      subtitle: [note ? `${note}/5` : null, source, logement].filter(Boolean).join(" · "),
    }),
  },
});
