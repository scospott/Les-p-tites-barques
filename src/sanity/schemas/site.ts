import { defineField, defineType } from "sanity";

import {
  CONTENT_GROUP,
  CONTENT_GROUPS,
  frHashField,
  localizedString,
  localizedText,
  seoField,
} from "./localized";

/* ============================================================
   Site — le singleton des contenus transverses : contact, réseaux,
   baseline, mot de l'hôtesse (accueil), référencement de l'accueil et
   texte des mentions légales.
   ============================================================ */

export default defineType({
  name: "site",
  title: "Site",
  type: "document",
  groups: [
    ...CONTENT_GROUPS,
    { name: "contact", title: "Contact & réseaux" },
    { name: "legal", title: "Mentions légales" },
    { name: "promo", title: "Promotion" },
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

    ...localizedString({
      name: "baseline",
      title: "Baseline",
      group: CONTENT_GROUP,
      description: "La phrase sous le nom, dans le pied de page.",
    }),
    defineField({
      name: "hotesse",
      title: "L'hôtesse (accueil)",
      type: "object",
      group: "contenu",
      fields: [
        defineField({ name: "nom", title: "Prénom affiché", type: "string" }),
        ...localizedText({
          name: "texte",
          title: "Son mot",
          rows: 8,
          description: "Une ligne vide sépare deux paragraphes.",
        }),
        defineField({
          name: "photo",
          title: "Portrait",
          type: "image",
          options: { hotspot: true },
        }),
      ],
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
        ...localizedString({ name: "texte", title: "Texte de la promotion" }),
        { name: "code", title: "Code (facultatif)", type: "string" },
        { name: "dateDebut", title: "Début", type: "date" },
        { name: "dateFin", title: "Fin", type: "date" },
      ],
    }),

    seoField({
      group: CONTENT_GROUP,
      description: "Référencement de la page d'accueil.",
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
              name: "paragraphes",
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
