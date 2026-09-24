import type { Rule } from "sanity";

/* ============================================================
   Champs traduisibles — un seul contenu éditable : le FRANÇAIS.

   Gwenaëlle écrit en français, point. Les cinq autres langues (EN, DE, NL,
   ES, ZH) sont produites par l'agent de traduction (Chateaubriand) et
   déposées dans des champs PLATS, frères du champ français, suffixés par la
   langue : `sousTitre` (FR) → `sousTitreEn`, `sousTitreDe`, `sousTitreNl`,
   `sousTitreEs`, `sousTitreZh`. Cachés et en lecture seule dans le Studio :
   une correction manuelle serait écrasée à la prochaine passe.

   « Frères » = dans le même objet que le champ français : au niveau du
   document pour un champ de document, dans l'entrée pour un tableau
   (`faq[].questionEn`), dans l'objet pour un objet (`seo.titleEn`).

   Le site lit ces champs via `localise(obj, "champ", locale)`, avec repli
   sur le français (src/sanity/adapters.ts).

   Chaque document porte aussi un `frHash` caché : l'empreinte du contenu
   français au moment de la dernière traduction, pour ne retraduire que ce
   qui a bougé.
   ============================================================ */

/** Les cinq langues dérivées du français, et le suffixe de leurs champs. */
export const TRANSLATED_LOCALES = [
  { id: "en", suffix: "En", title: "Anglais" },
  { id: "de", suffix: "De", title: "Allemand" },
  { id: "nl", suffix: "Nl", title: "Néerlandais" },
  { id: "es", suffix: "Es", title: "Espagnol" },
  { id: "zh", suffix: "Zh", title: "Chinois simplifié" },
] as const;

/** Nom du champ d'une langue : `translatedName("titre", "de")` → `titreDe`. */
export function translatedName(name: string, locale: (typeof TRANSLATED_LOCALES)[number]["id"]) {
  return name + TRANSLATED_LOCALES.find((l) => l.id === locale)!.suffix;
}

/** Onglet par défaut des documents traduisibles. */
export const CONTENT_GROUPS = [{ name: "contenu", title: "Contenu", default: true }];

/** Nom du groupe à passer aux helpers pour un champ direct de document. */
export const CONTENT_GROUP = "contenu";

type Kind = "string" | "text" | "portableText";

interface LocalizedOptions {
  /** Nom du champ français (ex. « sousTitre ») ; les traductions en dérivent. */
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

function shape(kind: Kind, rows?: number) {
  if (kind === "portableText") return { type: "array", of: [{ type: "block" }] };
  return { type: kind, ...(kind === "text" ? { rows: rows ?? 4 } : {}) };
}

/**
 * Fabrique un champ traduisible : le français éditable, suivi de ses cinq
 * traductions cachées. Renvoie une LISTE de champs, à déplier dans `fields`
 * (`...localizedString({ … })`).
 */
function localized(kind: Kind, o: LocalizedOptions) {
  const group = o.group ? { group: o.group } : {};
  return [
    {
      name: o.name,
      title: o.title,
      description: o.description,
      ...group,
      ...shape(kind, o.rows),
      ...(o.required
        ? { validation: (rule: Rule) => rule.required().error("Le français est obligatoire.") }
        : {}),
    },
    ...TRANSLATED_LOCALES.map((l) => ({
      name: o.name + l.suffix,
      title: `${o.title} (${l.title})`,
      ...group,
      ...shape(kind, o.rows),
      hidden: true,
      readOnly: true,
    })),
  ];
}

export const localizedString = (o: LocalizedOptions) => localized("string", o);
export const localizedText = (o: LocalizedOptions) => localized("text", o);
export const localizedPortableText = (o: LocalizedOptions) => localized("portableText", o);

/**
 * Entrée de tableau faite d'un seul texte traduisible (un atout, une question
 * suggérée…) : un objet `{ <name>, <name>En, … }` — une valeur primitive ne
 * peut pas porter de champs frères.
 */
export function localizedItem(o: { name: string; title: string }) {
  return {
    type: "object",
    name: o.name,
    title: o.title,
    fields: localizedString({ name: o.name, title: o.title }),
    preview: { select: { title: o.name } },
  };
}

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
      ...localizedString({
        name: "title",
        title: "Titre (≤ 60 caractères)",
        description: "Affiché dans l'onglet et dans les résultats Google.",
      }),
      ...localizedText({
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
          ...localizedString({ name: "question", title: "Question", required: true }),
          ...localizedText({ name: "reponse", title: "Réponse", rows: 4, required: true }),
        ],
        preview: { select: { title: "question", subtitle: "reponse" } },
      },
    ],
  };
}
