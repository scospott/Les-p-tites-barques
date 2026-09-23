import { defineField, defineType } from "sanity";

import {
  CONTENT_GROUP,
  CONTENT_GROUPS,
  frHashField,
  localizedString,
  localizedText,
} from "./localized";

export default defineType({
  name: "assistante",
  title: "Assistante",
  type: "document",
  groups: CONTENT_GROUPS,
  fields: [
    defineField({
      name: "consignesGenerales",
      title: "Consignes générales",
      type: "text",
      rows: 14,
      group: "contenu",
      description:
        "Ce que l'assistante doit savoir et la façon dont elle doit répondre. " +
        "Rédigé en français uniquement : ce texte n'est pas montré aux visiteurs, " +
        "il est lu par l'assistante, qui répond ensuite dans leur langue.",
    }),
    defineField({
      name: "faq",
      title: "Questions fréquentes",
      type: "array",
      group: "contenu",
      of: [
        {
          type: "object",
          name: "question",
          // Entrées de tableau : pas de `group` (cf. localized.ts).
          fields: [
            localizedString({ name: "question", title: "Question" }),
            localizedText({ name: "reponse", title: "Réponse", rows: 4 }),
          ],
          preview: { select: { title: "question.fr" } },
        },
      ],
    }),
    localizedText({
      name: "reglesMaison",
      title: "Règles de la maison",
      group: CONTENT_GROUP,
      rows: 8,
    }),
    localizedText({
      name: "recommandations",
      title: "Recommandations",
      group: CONTENT_GROUP,
      rows: 8,
    }),
    frHashField,
  ],
  preview: { prepare: () => ({ title: "Assistante" }) },
});
