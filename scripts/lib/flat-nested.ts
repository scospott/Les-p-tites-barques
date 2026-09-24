/* ============================================================
   Champs traduisibles encore IMBRIQUÉS → premier niveau (contrat de
   l'agent : jamais `a.b`, jamais un tableau de chaînes).

     seo.title / seo.titleEn…            → seoTitle / seoTitleEn…
     seo.description…                    → seoDescription…
     noteVoyageurs.badge / badgeEn…      → noteBadge / noteBadgeEn…
     mentionsLegales[].paragraphes…      → mentionsLegales[].texte…

   `nouveaux(doc)` : les valeurs à poser (à partir de l'ancienne forme).
   `anciens(doc)`  : les chemins de l'ancienne forme encore présents — plus,
   sur `site`, les textes d'accueil revenus dans le code (baseline, hotesse,
   promo, seo : repris dans messages/, cf. RETIRES_SITE).
   Pur, idempotent.
   ============================================================ */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const cap = (k: string) => k[0]!.toUpperCase() + k.slice(1);

/** Champs de `site` retirés (contenu repris dans messages/ et public/). */
export const RETIRES_SITE = /^(baseline(En|De|Nl|Es|Zh)?|hotesse|promo|seo)$/;

const BADGE = /^badge(En|De|Nl|Es|Zh)?$/;
const PARAGRAPHES = /^paragraphes(En|De|Nl|Es|Zh)?$/;

/** Valeurs de premier niveau (et entrées de mentionsLegales) à écrire. */
export function nouveaux(doc: Obj): Obj {
  const set: Obj = {};
  if (doc._type !== "site" && isObj(doc.seo)) {
    for (const [k, v] of Object.entries(doc.seo)) if (!k.startsWith("_") && v !== undefined) set[`seo${cap(k)}`] = v;
  }
  if (isObj(doc.noteVoyageurs)) {
    for (const [k, v] of Object.entries(doc.noteVoyageurs)) if (BADGE.test(k)) set[`note${cap(k)}`] = v;
  }
  if (Array.isArray(doc.mentionsLegales) && doc.mentionsLegales.some((s) => isObj(s) && Object.keys(s).some((k) => PARAGRAPHES.test(k)))) {
    set.mentionsLegales = doc.mentionsLegales.map((s) => {
      if (!isObj(s)) return s;
      const out: Obj = {};
      for (const [k, v] of Object.entries(s)) {
        if (PARAGRAPHES.test(k)) out[k.replace(/^paragraphes/, "texte")] = v;
        else out[k] = v;
      }
      return out;
    });
  }
  return set;
}

/** Même chose, en GARDANT l'ancienne forme (phase additive). */
export function nouveauxAdditifs(doc: Obj): Obj {
  const set = nouveaux(doc);
  if (Array.isArray(set.mentionsLegales)) {
    set.mentionsLegales = (set.mentionsLegales as Obj[]).map((s, i) => ({
      ...(doc.mentionsLegales as Obj[])[i],
      ...s,
    }));
  }
  return set;
}

/** Chemins de l'ancienne forme à retirer (phase de nettoyage). */
export function anciens(doc: Obj): string[] {
  const out: string[] = [];
  if (doc._type === "site") out.push(...Object.keys(doc).filter((k) => RETIRES_SITE.test(k)));
  else if (doc.seo !== undefined) out.push("seo");
  if (isObj(doc.noteVoyageurs)) {
    for (const k of Object.keys(doc.noteVoyageurs)) if (BADGE.test(k)) out.push(`noteVoyageurs.${k}`);
  }
  if (Array.isArray(doc.mentionsLegales)) {
    doc.mentionsLegales.forEach((s) => {
      if (isObj(s)) for (const k of Object.keys(s)) if (PARAGRAPHES.test(k)) out.push(`mentionsLegales[_key=="${s._key}"].${k}`);
    });
  }
  return out;
}

/** Document complet dans la forme finale (création : cf. migrate-to-sanity). */
export function aplatirDocument<T extends Obj>(doc: T): T {
  const out: Obj = { ...doc, ...nouveaux(doc) };
  if (doc._type !== "site") delete out.seo;
  if (isObj(out.noteVoyageurs)) {
    out.noteVoyageurs = Object.fromEntries(Object.entries(out.noteVoyageurs).filter(([k]) => !BADGE.test(k)));
  }
  return out as T;
}
