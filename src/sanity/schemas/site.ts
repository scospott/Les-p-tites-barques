import { defineField, defineType } from "sanity";

import {
  CONTENT_GROUP,
  CONTENT_GROUPS,
  frHashField,
  localizedPortableText,
  localizedString,
  seoField,
} from "./localized";

export default defineType({
  name: "site",
  title: "Site",
  type: "document",
  groups: [
    ...CONTENT_GROUPS,
    { name: "contact", title: "Contact" },
    { name: "promo", title: "Promotion" },
  ],
  fields: [
    defineField({
      name: "email",
      title: "E-mail",
      type: "string",
      group: "contact",
      validation: (rule) => rule.email().error("Adresse e-mail invalide."),
    }),
    defineField({ name: "telephone", title: "Téléphone", type: "string", group: "contact" }),
    defineField({ name: "instagram", title: "Instagram (lien)", type: "url", group: "contact" }),
    defineField({ name: "facebook", title: "Facebook (lien)", type: "url", group: "contact" }),

    localizedString({
      name: "baseline",
      title: "Baseline",
      group: CONTENT_GROUP,
      description: "La phrase sous le nom, dans le pied de page.",
    }),
    localizedPortableText({
      name: "histoire",
      title: "L'histoire",
      group: CONTENT_GROUP,
    }),
    localizedPortableText({
      name: "motHotesse",
      title: "Le mot de l'hôtesse",
      group: CONTENT_GROUP,
    }),
    defineField({
      name: "photoHotesse",
      title: "Photo de l'hôtesse",
      type: "image",
      group: "contenu",
      options: { hotspot: true },
    }),

    defineField({
      name: "promo",
      title: "Promotion en cours",
      type: "object",
      group: "promo",
      fields: [
        {
          name: "actif",
          title: "Afficher la promotion",
          type: "boolean",
          initialValue: false,
        },
        // Imbriqué dans `promo` : pas de `group` (cf. localized.ts).
        localizedString({ name: "texte", title: "Texte de la promotion" }),
        { name: "code", title: "Code (facultatif)", type: "string" },
        { name: "dateDebut", title: "Début", type: "date" },
        { name: "dateFin", title: "Fin", type: "date" },
      ],
    }),

    seoField({
      group: CONTENT_GROUP,
      description: "Référencement de la page d'accueil.",
    }),
    localizedPortableText({
      name: "mentionsLegales",
      title: "Mentions légales",
      group: CONTENT_GROUP,
    }),
    frHashField,
  ],
  preview: { prepare: () => ({ title: "Site" }) },
});
