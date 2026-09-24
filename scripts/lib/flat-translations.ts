/* ============================================================
   Ancienne forme → forme plate des champs traduisibles.

     { sousTitre: { fr: "…", translations: { en: "…", de: "…" } } }
       → { sousTitre: "…", sousTitreEn: "…", sousTitreDe: "…" }

   Entrée de tableau faite d'un seul texte (`atouts[]`, `questionsSuggerees[]`,
   `typesVoyageurs[]`) : `{ _type: "atout", fr, translations }` →
   `{ _type: "atout", atout: "…", atoutEn: "…" }` (le champ porte le nom du
   type, cf. `localizedItem`).

   Pure et idempotente : un document déjà plat ressort inchangé.
   ============================================================ */

export const SUFFIXES = { en: "En", de: "De", nl: "Nl", es: "Es", zh: "Zh" } as const;
export type TranslatedLocale = keyof typeof SUFFIXES;

type Json = unknown;
type Obj = Record<string, Json>;

const isObj = (v: Json): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/** L'ancienne enveloppe `{ fr, translations }` (et rien d'autre que `_type` / `_key`). */
export function isLegacyLocalized(v: Json): v is Obj {
  if (!isObj(v) || !("fr" in v || "translations" in v)) return false;
  return Object.keys(v).every((k) => ["fr", "translations", "_type", "_key"].includes(k));
}

/** Les champs plats `{ name, nameEn, … }` d'une enveloppe. */
function flatFields(name: string, env: Obj): Obj {
  const out: Obj = {};
  if (env.fr !== undefined) out[name] = env.fr;
  const tr = isObj(env.translations) ? env.translations : {};
  for (const [l, suffix] of Object.entries(SUFFIXES)) {
    if (tr[l] !== undefined && tr[l] !== "") out[name + suffix] = tr[l];
  }
  return out;
}

export function flatten(node: Json): Json {
  if (Array.isArray(node)) {
    return node.map((item) => {
      if (isLegacyLocalized(item) && typeof item._type === "string") {
        const { _key, _type } = item;
        return { ...(_key ? { _key } : {}), _type, ...flatFields(_type, item) };
      }
      return flatten(item);
    });
  }
  if (!isObj(node)) return node;
  const out: Obj = {};
  for (const [k, v] of Object.entries(node)) {
    if (isLegacyLocalized(v)) Object.assign(out, flatFields(k, v));
    else out[k] = flatten(v);
  }
  return out;
}
