import { defineField, defineType } from "sanity";

import { frHashField, localizedString, localizedText } from "./localized";

/* ============================================================
   Site — le singleton des contenus transverses : contact, réseaux et
   texte des mentions légales.

   Les textes validés de l'accueil (baseline, mot et portrait de l'hôtesse,
   promotion, référencement de l'accueil) sont revenus dans le code
   (messages/, public/images/accueil/) : ils ne bougent plus.
   ============================================================ */

export default defineType({
  name: "site",
  title: "Site",
  type: "document",
  groups: [
    { name: "contact", title: "Contact & réseaux", default: true },
    { name: "legal", title: "Mentions légales" },
  ],
  fields: [
    defineField({
      name: "contact",
      title: "Contact",
      type: "object",
      group: "contact",
      fields: [
        defineField({
          name: "email",
          title: "E-mail",
          type: "string",
          validation: (rule) => rule.email().error("Adresse e-mail invalide."),
        }),
        defineField({
          name: "telephone",
          title: "Téléphone",
          type: "string",
          description: "Format international, ex. « +33 6 12 34 56 78 ».",
        }),
        defineField({
          name: "afficherTelephone",
          title: "Afficher le téléphone sur le site",
          type: "boolean",
          initialValue: false,
          description:
            "Décoché : le numéro reste privé (ni fenêtre « Réserver », ni données Google).",
        }),
      ],
    }),
    defineField({
      name: "reseaux",
      title: "Réseaux sociaux",
      type: "object",
      group: "contact",
      description:
        "Liens des comptes officiels : boutons du pied de page et données pour Google. " +
        "Laisser vide si le compte n'existe pas — le bouton disparaît.",
      fields: [
        defineField({ name: "instagram", title: "Instagram", type: "url" }),
        defineField({ name: "facebook", title: "Facebook", type: "url" }),
      ],
    }),

    defineField({
      name: "mentionsLegales",
      title: "Mentions légales",
      type: "array",
      group: "legal",
      description:
        "Une section par entrée. La liste des n° d'enregistrement s'ajoute seule sous " +
        "la section « Meublés de tourisme » (clé « rentals »), depuis les fiches logement.",
      of: [
        {
          type: "object",
          name: "section",
          fields: [
            ...localizedString({ name: "titre", title: "Titre", required: true }),
            ...localizedText({
              name: "texte",
              title: "Texte",
              rows: 6,
              description: "Une ligne vide sépare deux paragraphes.",
            }),
            {
              name: "cle",
              title: "Clé technique",
              type: "string",
              description: "« rentals » : suivie de la liste des n° d'enregistrement. Sinon vide.",
            },
          ],
          preview: { select: { title: "titre" } },
        },
      ],
    }),
    frHashField,
  ],
  preview: { prepare: () => ({ title: "Site" }) },
});
