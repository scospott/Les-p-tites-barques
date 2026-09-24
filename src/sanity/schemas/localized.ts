import type { Rule } from "sanity";

/* ============================================================
   Champs traduisibles — un seul contenu éditable : le FRANÇAIS.

   Gwenaëlle écrit en français, point. Les cinq autres langues (EN, DE, NL,
   ES, ZH) sont produites par l'agent de traduction et déposées dans le
   sous-objet `translations`, affiché en LECTURE SEULE dans le Studio : on
   peut les relire, jamais les éditer à la main (une correction manuelle
   serait écrasée à la prochaine passe de traduction).

   Chaque document porte aussi un `frHash` caché : l'empreinte du contenu
   français au moment de la dernière traduction. C'est ce qui permettra à
   l'agent de ne retraduire que ce qui a réellement bougé.

   GROUPES vs FIELDSETS — les `groups` (les onglets en haut du formulaire)
   n'existent qu'au niveau du DOCUMENT : un objet imbriqué ne peut pas
   référencer un groupe de son parent, et le Studio se plaint alors d'un
   « field group … is not defined in schema ». Le repli des traductions passe
   donc par un `fieldset`, qui est LOCAL à l'objet et fonctionne partout —
   champ direct d'un document comme entrée d'un tableau.
   Le `group` du champ enveloppe, lui, reste optionnel (`o.group`) : on ne le
   passe QUE là où le champ est posé directement sur un document.
   ============================================================ */

/** Les cinq langues dérivées du français. */
export const TRANSLATED_LOCALES = [
  { id: "en", title: "Anglais" },
  { id: "de", title: "Allemand" },
  { id: "nl", title: "Néerlandais" },
  { id: "es", title: "Espagnol" },
  { id: "zh", title: "Chinois simplifié" },
] as const;

/**
 * Groupe par défaut des documents traduisibles. Il n'y a plus d'onglet
 * « Traductions » : elles sont repliées dans chaque champ, au plus près du
 * français dont elles dérivent — et un onglet dont aucun champ ne se réclame
 * s'afficherait vide.
 */
export const CONTENT_GROUPS = [{ name: "contenu", title: "Contenu", default: true }];

/** Nom du groupe à passer aux helpers pour un champ direct de document. */
export const CONTENT_GROUP = "contenu";

const FIELDSET = "traductions";
const AUTO = "Générée automatiquement — ne pas modifier.";

type Kind = "string" | "text" | "portableText";

function translationField(kind: Kind, id: string, title: string) {
  if (kind === "portableText") {
    return { name: id, title, type: "array", of: [{ type: "block" }], readOnly: true };
  }
  return {
    name: id,
    title,
    type: kind,
    readOnly: true,
    ...(kind === "text" ? { rows: 4 } : {}),
  };
}

interface LocalizedOptions {
  /** Nom du champ dans le document (ex. « sousTitre »). */
  name: string;
  /** Libellé affiché dans le Studio. */
  title: string;
  /** Aide affichée sous le champ français. */
  description?: string;
  /**
   * Onglet du document. À NE PASSER QUE pour un champ posé directement sur un
   * document : dans un objet imbriqué ou un tableau, le groupe n'existe pas
   * et le Studio lève une erreur de schéma.
   */
  group?: string;
  /** Champ obligatoire ? (porte sur le français uniquement.) */
  required?: boolean;
  /** Hauteur du champ texte. */
  rows?: number;
}

/**
 * Fabrique un champ traduisible : le français éditable, puis les traductions
 * repliées dans leur fieldset. `kind` choisit la forme du contenu.
 */
function localized(kind: Kind, o: LocalizedOptions) {
  const base =
    kind === "portableText"
      ? { type: "array", of: [{ type: "block" }] }
      : { type: kind, ...(kind === "text" ? { rows: o.rows ?? 4 } : {}) };

  return {
    name: o.name,
    title: o.title,
    type: "object",
    ...(o.group ? { group: o.group } : {}),
    options: { columns: 1 },
    fieldsets: [
      {
        name: FIELDSET,
        title: "Traductions (générées automatiquement)",
        options: { collapsible: true, collapsed: true },
      },
    ],
    fields: [
      // Le français d'abord, hors fieldset : c'est le seul champ à remplir.
      {
        name: "fr",
        title: "Français",
        description: o.description,
        ...base,
        ...(o.required
          ? { validation: (rule: Rule) => rule.required().error("Le français est obligatoire.") }
          : {}),
      },
      {
        name: "translations",
        title: "Traductions",
        type: "object",
        fieldset: FIELDSET,
        // Verrouillé au niveau de l'objet ET de chaque langue : la première
        // suffit en théorie, la seconde garantit qu'aucune langue ne
        // redevienne éditable si la cascade change de comportement.
        readOnly: true,
        description: AUTO,
        fields: TRANSLATED_LOCALES.map((l) => translationField(kind, l.id, l.title)),
      },
    ],
    preview: { select: { title: "fr" } },
  };
}

export const localizedString = (o: LocalizedOptions) => localized("string", o);
export const localizedText = (o: LocalizedOptions) => localized("text", o);
export const localizedPortableText = (o: LocalizedOptions) => localized("portableText", o);

/**
 * Empreinte du contenu français, posée par le script de migration puis par
 * l'agent de traduction. Cachée : c'est de la mécanique, pas de l'édition.
 */
export const frHashField = {
  name: "frHash",
  title: "Empreinte du contenu français",
  type: "string",
  hidden: true,
  readOnly: true,
};

/**
 * Référencement d'une page : balise title (≤ 60 caractères) et meta
 * description (≤ 155). Vides → le site retombe sur « nom · lieu ».
 */
export function seoField(o: { group?: string; description?: string } = {}) {
  return {
    name: "seo",
    title: "Référencement (SEO)",
    type: "object",
    ...(o.group ? { group: o.group } : {}),
    description: o.description,
    options: { collapsible: true, collapsed: true },
    fields: [
      localizedString({
        name: "title",
        title: "Titre (≤ 60 caractères)",
        description: "Affiché dans l'onglet et dans les résultats Google.",
      }),
      localizedText({
        name: "description",
        title: "Description (≤ 155 caractères)",
        rows: 3,
        description:
          "Le texte sous le titre dans Google : bénéfice concret + lieu + « réservation directe, sans frais de service ».",
      }),
    ],
  };
}

/**
 * FAQ (question / réponse traduisibles) — fiches logement et pages
 * destination. Rendue en accordéon et balisée FAQPage : la réponse doit
 * être vraie et visible telle quelle.
 */
export function faqField(o: { group?: string; description?: string } = {}) {
  return {
    name: "faq",
    title: "Questions fréquentes",
    type: "array",
    ...(o.group ? { group: o.group } : {}),
    description: o.description,
    of: [
      {
        type: "object",
        name: "question",
        // Entrées de tableau : pas de `group` (cf. en-tête du fichier).
        fields: [
          localizedString({ name: "question", title: "Question", required: true }),
          localizedText({ name: "reponse", title: "Réponse", rows: 4, required: true }),
        ],
        preview: { select: { title: "question.fr", subtitle: "reponse.fr" } },
      },
    ],
  };
}
