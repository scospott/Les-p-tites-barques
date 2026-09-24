import { defineField, defineType } from "sanity";

import { DESTINATIONS } from "./lieu";
import {
  CONTENT_GROUP,
  CONTENT_GROUPS,
  faqField,
  frHashField,
  localizedString,
  localizedText,
  seoField,
} from "./localized";

/* ============================================================
   Destination — les pages /saint-malo et /guadeloupe (SEO local).
   La photo du héros reste dans le site (vue aérienne des barques, photo
   allégée de L'Antillaise) : seul son texte alternatif est ici.
   ============================================================ */

export default defineType({
  name: "destination",
  title: "Destination",
  type: "document",
  groups: [...CONTENT_GROUPS, { name: "liens", title: "Logements & lieux" }],
  fields: [
    defineField({
      name: "slug",
      title: "Destination",
      type: "string",
      group: "contenu",
      options: { list: DESTINATIONS, layout: "radio" },
      readOnly: ({ value }) => !!value,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "nom",
      title: "Nom",
      type: "string",
      group: "contenu",
      description: "Fil d'Ariane, liens « Découvrir … » et titre de l'intro. Jamais traduit.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "lieuSchema",
      title: "Lieu pour Google",
      type: "string",
      group: "contenu",
      description: "La commune décrite (ex. « Deshaies ») — données structurées.",
    }),
    defineField({
      name: "region",
      title: "Région",
      type: "string",
      group: "contenu",
      description: "Ex. « Bretagne », « Guadeloupe » — données structurées.",
    }),
    defineField({ name: "ordre", title: "Ordre", type: "number", group: "contenu" }),
    localizedString({ name: "surtitre", title: "Surtitre", group: CONTENT_GROUP, description: "Ex. « Bretagne »." }),
    localizedString({
      name: "titre",
      title: "Titre (H1)",
      group: CONTENT_GROUP,
      required: true,
      description: "Ex. « Séjourner à Saint-Malo ».",
    }),
    localizedString({ name: "sousTitre", title: "Sous-titre du héros", group: CONTENT_GROUP }),
    localizedString({
      name: "heroAlt",
      title: "Description de la photo du héros",
      group: CONTENT_GROUP,
    }),
    localizedText({
      name: "intro",
      title: "Introduction",
      group: CONTENT_GROUP,
      rows: 12,
      description:
        "120 à 180 mots. Une ligne vide sépare deux paragraphes ; le premier est mis en valeur.",
    }),
    defineField({
      name: "typesVoyageurs",
      title: "Pour qui ?",
      type: "array",
      group: "contenu",
      description: "Types de voyageurs (données structurées, non affichées).",
      of: [localizedString({ name: "typeVoyageur", title: "Type" })],
    }),
    faqField({ group: CONTENT_GROUP }),
    seoField({ group: CONTENT_GROUP }),
    defineField({
      name: "logements",
      title: "Logements",
      type: "array",
      group: "liens",
      of: [{ type: "reference", to: [{ type: "logement" }] }],
      description: "Dans l'ordre d'affichage.",
    }),
    defineField({
      name: "lieux",
      title: "Lieux (Alentours)",
      type: "array",
      group: "liens",
      of: [{ type: "reference", to: [{ type: "lieu" }] }],
      description: "Les lieux proposés dans la section « Alentours », dans l'ordre.",
    }),
    frHashField,
  ],
  preview: { select: { title: "nom", subtitle: "titre.fr" } },
});
