/* ============================================================
   Migration : champs traduisibles imbriqués → premier niveau
   (cf. scripts/lib/flat-nested.ts pour la correspondance).

   En DEUX temps, pour ne jamais casser le site en ligne :

     npx tsx --env-file=.env.local scripts/migrate-flatten-nested.ts             # à blanc
     npx tsx --env-file=.env.local scripts/migrate-flatten-nested.ts --apply     # 1. ajoute les nouveaux champs
     # … déployer le code qui lit les nouveaux champs …
     npx tsx --env-file=.env.local scripts/migrate-flatten-nested.ts --cleanup   # 2. retire l'ancienne forme

   Chaque passage : sauvegarde ndjson (.backups/), patchs conditionnés par
   révision, comptage des valeurs avant/après (0 perdue). Le nettoyage refuse
   de tourner si un nouveau champ diffère de son ancienne valeur. Il retire
   aussi de `site` les textes d'accueil repris dans messages/ (baseline,
   hotesse, promo, seo).
   Idempotent. Le token (SANITY_MIGRATION_TOKEN) n'est jamais affiché.
   ============================================================ */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@sanity/client";

import { anciens, nouveaux, nouveauxAdditifs } from "./lib/flat-nested";

const APPLY = process.argv.includes("--apply");
const CLEANUP = process.argv.includes("--cleanup");
const token = process.env.SANITY_MIGRATION_TOKEN;
if (!token) {
  console.error("SANITY_MIGRATION_TOKEN manquant (.env.local).");
  process.exit(1);
}
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET!;
const client = createClient({ projectId, dataset, apiVersion: "2026-08-28", token, useCdn: false });

type Doc = { _id: string; _type: string; _rev: string } & Record<string, unknown>;
const TYPES = ["logement", "destination", "site"];

async function exporter(label: string): Promise<Doc[]> {
  const res = await fetch(`https://${projectId}.api.sanity.io/v2021-06-07/data/export/${dataset}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Export impossible : HTTP ${res.status}`);
  const text = await res.text();
  await mkdir(".backups", { recursive: true });
  const file = path.join(".backups", `${dataset}-${label}-${new Date().toISOString().replace(/[:.]/g, "-")}.ndjson`);
  await writeFile(file, text);
  console.log(`Sauvegarde : ${file}`);
  return text.split("\n").filter(Boolean).map((l) => JSON.parse(l) as Doc).filter((d) => TYPES.includes(d._type));
}

/** Valeurs non vides, ancienne forme et nouvelle forme, par champ normalisé. */
function comptage(docs: Doc[]) {
  const vieux = new Map<string, string>();
  const neuf = new Map<string, string>();
  const put = (m: Map<string, string>, k: string, v: unknown) => {
    if (typeof v === "string" && v.trim()) m.set(k, v);
  };
  for (const d of docs) {
    // Le SEO de `site` (accueil) est retiré, pas aplati : repris dans messages/.
    const seo = (d._type === "site" ? {} : (d.seo ?? {})) as Record<string, unknown>;
    for (const [k, v] of Object.entries(seo)) put(vieux, `${d._id}|seo${k[0]!.toUpperCase()}${k.slice(1)}`, v);
    const nv = (d.noteVoyageurs ?? {}) as Record<string, unknown>;
    for (const [k, v] of Object.entries(nv)) if (/^badge/.test(k)) put(vieux, `${d._id}|note${k[0]!.toUpperCase()}${k.slice(1)}`, v);
    for (const [k, v] of Object.entries(d)) if (/^(seoTitle|seoDescription|noteBadge)/.test(k)) put(neuf, `${d._id}|${k}`, v);
    for (const s of (d.mentionsLegales ?? []) as Record<string, unknown>[]) {
      for (const [k, v] of Object.entries(s)) {
        if (/^paragraphes/.test(k)) put(vieux, `${d._id}|${s._key}|${k.replace(/^paragraphes/, "texte")}`, v);
        if (/^texte/.test(k)) put(neuf, `${d._id}|${s._key}|${k}`, v);
      }
    }
  }
  return { vieux, neuf };
}

function rapport(docs: Doc[], exigeAncien: boolean) {
  const { vieux, neuf } = comptage(docs);
  const parChamp = new Map<string, [number, number]>();
  const champ = (k: string) => k.split("|").pop()!;
  for (const k of vieux.keys()) { const c = parChamp.get(champ(k)) ?? [0, 0]; c[0]++; parChamp.set(champ(k), c); }
  for (const k of neuf.keys()) { const c = parChamp.get(champ(k)) ?? [0, 0]; c[1]++; parChamp.set(champ(k), c); }
  console.log("\nValeurs non vides — ancienne forme / nouvelle forme :");
  for (const [k, [a, b]] of [...parChamp].sort()) console.log(`  ${k.padEnd(22)} ${String(a).padStart(3)} / ${b}`);
  const manquantes = [...vieux].filter(([k, v]) => neuf.get(k) !== v);
  console.log(`Total : ${vieux.size} / ${neuf.size} · nouvelles valeurs manquantes ou différentes : ${manquantes.length}`);
  manquantes.slice(0, 5).forEach(([k]) => console.log("  ✗ " + k));
  return { vieux: vieux.size, neuf: neuf.size, manquantes: manquantes.length, ok: exigeAncien ? manquantes.length === 0 : true };
}

async function main() {
  console.log(`Aplatissement des champs imbriqués — ${projectId}/${dataset} — ${CLEANUP ? "NETTOYAGE" : APPLY ? "AJOUT" : "à blanc"}`);
  const docs = await exporter(CLEANUP ? "avant-nettoyage-imbriques" : "avant-aplatir-imbriques");

  if (!CLEANUP) {
    const aEcrire = docs
      .map((d) => ({ d, set: nouveauxAdditifs(d) }))
      .filter(({ d, set }) => Object.entries(set).some(([k, v]) => JSON.stringify(d[k]) !== JSON.stringify(v)));
    console.log(`Documents à compléter : ${aEcrire.length} (${aEcrire.map(({ d }) => d._id).join(", ") || "aucun"})`);
    if (APPLY && aEcrire.length) {
      const tx = aEcrire.reduce((t, { d, set }) => t.patch(d._id, (p) => p.ifRevisionId(d._rev).set(set)), client.transaction());
      await tx.commit();
      const apres = await exporter("apres-aplatir-imbriques");
      if (!rapport(apres, true).ok) process.exit(1);
    } else {
      rapport(docs.map((d) => ({ ...d, ...nouveauxAdditifs(d) }) as Doc), true);
    }
    return;
  }

  // Nettoyage : uniquement si chaque ancienne valeur a sa jumelle identique.
  const avant = rapport(docs, true);
  if (!avant.ok) {
    console.error("Refus : des valeurs n'ont pas encore leur nouveau champ. Lancer --apply d'abord.");
    process.exit(1);
  }
  const aNettoyer = docs.map((d) => ({ d, unset: anciens(d) })).filter(({ unset }) => unset.length);
  console.log(`Documents à nettoyer : ${aNettoyer.length}`);
  if (aNettoyer.length) {
    const tx = aNettoyer.reduce((t, { d, unset }) => t.patch(d._id, (p) => p.ifRevisionId(d._rev).unset(unset)), client.transaction());
    await tx.commit();
  }
  const apres = await exporter("apres-nettoyage-imbriques");
  const r = rapport(apres, false);
  const restants = apres.flatMap((d) => anciens(d));
  console.log(`Chemins de l'ancienne forme restants : ${restants.length}`);
  if (r.neuf !== avant.neuf || restants.length) {
    console.error("ÉCHEC : des valeurs ont bougé pendant le nettoyage.");
    process.exit(1);
  }
  console.log(`OK — ${r.neuf} valeurs, 0 perdue.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
