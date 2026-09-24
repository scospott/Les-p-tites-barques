import { defineField, defineType } from "sanity";

import {
  CONTENT_GROUP,
  CONTENT_GROUPS,
  frHashField,
  localizedString,
} from "./localized";

export const LIEU_CATEGORIES = [
  { title: "Plage", value: "plage" },
  { title: "Restaurant", value: "restaurant" },
  { title: "Culture", value: "culture" },
  { title: "Nature", value: "nature" },
  { title: "Commerce", value: "commerce" },
  { title: "Transport", value: "transport" },
];

export const DESTINATIONS = [
  { title: "Saint-Malo", value: "saint-malo" },
  { title: "Guadeloupe", value: "guadeloupe" },
];

/** Au-delà, la carte devient illisible — avertissement, jamais un blocage. */
const MAX_PAR_DESTINATION = 12;

export default defineType({
  name: "lieu",
  title: "Lieu",
  type: "document",
  groups: CONTENT_GROUPS,
  fields: [
    defineField({
      name: "nom",
      title: "Nom",
      type: "string",
      group: "contenu",
      validation: (rule) => rule.required().error("Le nom est obligatoire."),
    }),
    defineField({
      name: "categorie",
      title: "Catégorie",
      type: "string",
      group: "contenu",
      options: { list: LIEU_CATEGORIES, layout: "dropdown" },
      validation: (rule) => rule.required().error("La catégorie est obligatoire."),
    }),
    defineField({
      name: "destination",
      title: "Destination",
      type: "string",
      group: "contenu",
      options: { list: DESTINATIONS, layout: "radio" },
      validation: (rule) => rule.required().error("La destination est obligatoire."),
    }),
    defineField({
      name: "requeteMaps",
      title: "Recherche Google Maps",
      type: "string",
      group: "contenu",
      description:
        "Ce que l'on taperait dans Google Maps pour trouver le lieu " +
        "(ex. « Plage de Bon-Secours, Saint-Malo »). Destination des itinéraires.",
      validation: (rule) => rule.required().error("La recherche Google Maps est obligatoire."),
    }),
    localizedString({
      name: "description",
      title: "Description",
      group: CONTENT_GROUP,
      description: "Une phrase, pas plus.",
    }),
    defineField({
      name: "image",
      title: "Photo (facultative)",
      type: "image",
      group: "contenu",
      options: { hotspot: true },
    }),
    defineField({ name: "latitude", title: "Latitude", type: "number", group: "contenu" }),
    defineField({ name: "longitude", title: "Longitude", type: "number", group: "contenu" }),
    defineField({
      name: "ordre",
      title: "Ordre d'affichage",
      type: "number",
      group: "contenu",
    }),
    frHashField,
  ],
  /* Avertissement (et non erreur) : passé une douzaine de points, la carte de
     destination se surcharge. On prévient l'éditrice, on ne l'empêche pas. */
  validation: (rule) =>
    rule.custom(async (doc, context) => {
      if (!doc?.destination) return true;
      const total = await context.getClient({ apiVersion: "2026-08-28" }).fetch<number>(
        `count(*[_type == "lieu" && destination == $destination && _id != $id])`,
        { destination: doc.destination, id: (doc._id as string).replace(/^drafts\./, "") },
      );
      return total + 1 > MAX_PAR_DESTINATION
        ? `Plus de ${MAX_PAR_DESTINATION} lieux pour cette destination : la carte devient chargée.`
        : true;
    }).warning(),
  orderings: [
    { name: "ordre", title: "Ordre d'affichage", by: [{ field: "ordre", direction: "asc" }] },
  ],
  preview: {
    select: { title: "nom", categorie: "categorie", destination: "destination", media: "image" },
    prepare: ({ title, categorie, destination, media }) => ({
      title,
      subtitle: [categorie, destination].filter(Boolean).join(" · "),
      media,
    }),
  },
});
