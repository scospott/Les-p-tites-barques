/* ============================================================
   Migration : traductions `{ fr, translations: { xx } }` → champs plats
   `<champ>`, `<champ>En`, `<champ>De`, `<champ>Nl`, `<champ>Es`, `<champ>Zh`
   (contrat de l'agent de traduction Chateaubriand, cf. schemas/localized.ts).

     npx tsx --env-file=.env.local scripts/migrate-translations-flat.ts            # à blanc
     npx tsx --env-file=.env.local scripts/migrate-translations-flat.ts --apply    # écrit

   1. Sauvegarde ndjson de TOUT le dataset (export API) dans .backups/
      (ignoré par git) avant toute écriture.
   2. Aplatit chaque document (scripts/lib/flat-translations.ts) ; seuls les
      documents qui changent sont patchés, dans une transaction, avec
      contrôle de révision (`ifRevisionId`) : une édition concurrente dans le
      Studio fait échouer la transaction au lieu d'être écrasée.
   3. Vérifie : plus aucune enveloppe `{ fr, translations }`, et le même
      nombre de valeurs par champ et par langue avant / après.

   Idempotent : relancé sur un dataset déjà plat, il ne réécrit rien.
   Le token (SANITY_MIGRATION_TOKEN, .env.local) n'est jamais affiché.
   ============================================================ */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@sanity/client";

import { SUFFIXES, flatten, isLegacyLocalized } from "./lib/flat-translations";

const APPLY = process.argv.includes("--apply");
const token = process.env.SANITY_MIGRATION_TOKEN;
if (!token) {
  console.error("SANITY_MIGRATION_TOKEN manquant (.env.local).");
  process.exit(1);
}
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET!;
const client = createClient({ projectId, dataset, apiVersion: "2026-08-28", token, useCdn: false });

type Doc = { _id: string; _type: string; _rev: string } & Record<string, unknown>;

const CONTENT_TYPES = ["logement", "destination", "lieu", "avis", "site", "assistante"];

/**
 * Comptage des valeurs traduites/françaises par chemin normalisé
 * (`logement:faq[].question:en`) — dans l'ancienne OU la nouvelle forme.
 */
function census(docs: Doc[]): Map<string, number> {
  const counts = new Map<string, number>();
  const bump = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);
  const suffixToLocale = Object.entries(SUFFIXES).map(([l, s]) => [s, l] as const);

  const walk = (node: unknown, p: string, type: string) => {
    if (Array.isArray(node)) return node.forEach((n) => walk(n, `${p}[]`, type));
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    // Ancienne forme.
    if (isLegacyLocalized(obj)) {
      const name = p.endsWith("[]") && typeof obj._type === "string" ? `${p}.${obj._type}` : p;
      if (obj.fr) bump(`${type}:${name}:fr`);
      const tr = (obj.translations ?? {}) as Record<string, unknown>;
      for (const l of Object.keys(SUFFIXES)) if (tr[l]) bump(`${type}:${name}:${l}`);
      return;
    }
    const keys = Object.keys(obj);
    for (const [k, v] of Object.entries(obj)) {
      // Nouvelle forme : `champXx` dont le champ français `champ` existe
      // ou dont un frère porte le même radical.
      const hit = suffixToLocale.find(([s]) => k.endsWith(s) && k.length > s.length);
      const base = hit ? k.slice(0, -hit[0].length) : null;
      if (hit && base && (keys.includes(base) || typeof v === "string" || Array.isArray(v))) {
        if (keys.includes(base) || isTranslatable(base)) {
          if (v) bump(`${type}:${p}.${base}:${hit[1]}`);
          continue;
        }
      }
      if (translatableSeen.has(k) && (typeof v === "string" || Array.isArray(v)) && v) {
        bump(`${type}:${p}.${k}:fr`);
        continue;
      }
      walk(v, `${p}.${k}`, type);
    }
  };
  for (const d of docs) walk(d, "", d._type);
  return counts;
}

/** Noms des champs traduisibles, relevés dans l'ancienne forme (avant migration). */
const translatableSeen = new Set<string>();
const isTranslatable = (name: string) => translatableSeen.has(name);
function collectTranslatable(node: unknown, key?: string) {
  if (Array.isArray(node)) return node.forEach((n) => collectTranslatable(n, key));
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  if (isLegacyLocalized(obj)) {
    translatableSeen.add(typeof obj._type === "string" ? obj._type : key!);
    return;
  }
  for (const [k, v] of Object.entries(obj)) collectTranslatable(v, k);
}

async function exportDataset(label: string): Promise<{ file: string; docs: Doc[] }> {
  const res = await fetch(
    `https://${projectId}.api.sanity.io/v2021-06-07/data/export/${dataset}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Export impossible : HTTP ${res.status}`);
  const text = await res.text();
  const dir = path.join(process.cwd(), ".backups");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${dataset}-${label}-${new Date().toISOString().replace(/[:.]/g, "-")}.ndjson`);
  await writeFile(file, text);
  const docs = text
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Doc)
    .filter((d) => CONTENT_TYPES.includes(d._type));
  return { file, docs };
}

function legacyLeft(docs: Doc[]): string[] {
  const hits: string[] = [];
  const walk = (node: unknown, p: string) => {
    if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${p}[${i}]`));
    if (!node || typeof node !== "object") return;
    if (isLegacyLocalized(node)) return void hits.push(p);
    for (const [k, v] of Object.entries(node)) walk(v, `${p}.${k}`);
  };
  for (const d of docs) walk(d, d._id);
  return hits;
}

async function main() {
  console.log(`Aplatissement des traductions — ${projectId}/${dataset}${APPLY ? "" : " (à blanc)"}\n`);

  const before = await exportDataset("avant-flat");
  console.log(`Sauvegarde : ${path.relative(process.cwd(), before.file)} (${before.docs.length} documents de contenu)`);
  before.docs.forEach((d) => collectTranslatable(d));
  const censusBefore = census(before.docs);

  const changed = before.docs
    .map((d) => ({ doc: d, flat: flatten(d) as Doc }))
    .filter(({ doc, flat }) => JSON.stringify(doc) !== JSON.stringify(flat));
  console.log(`Documents à réécrire : ${changed.length}`);
  if (!changed.length) {
    // Le comptage s'appuie sur l'ancienne forme : rien à comparer ici.
    const legacy = legacyLeft(before.docs);
    console.log(`Rien à faire : dataset déjà plat (enveloppes restantes : ${legacy.length}).`);
    process.exit(legacy.length ? 1 : 0);
  }

  if (APPLY) {
    // Un patch par document, conditionné par sa révision : si le document a
    // bougé dans le Studio depuis l'export, toute la transaction échoue.
    const tx = changed.reduce((t, { doc, flat }) => {
      const set: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(flat)) {
        if (k.startsWith("_")) continue;
        if (JSON.stringify(v) !== JSON.stringify(doc[k])) set[k] = v;
      }
      const unset = Object.keys(doc).filter((k) => !k.startsWith("_") && !(k in flat));
      return t.patch(doc._id, (p) => p.ifRevisionId(doc._rev).set(set).unset(unset));
    }, client.transaction());
    await tx.commit();
    console.log("Transaction appliquée.");
  }

  if (!APPLY) {
    // Vérification à blanc, sur le résultat calculé.
    const simulated = before.docs.map((d) => flatten(d) as Doc);
    report(censusBefore, census(simulated), legacyLeft(simulated));
    return;
  }
  const after = await exportDataset("apres-flat");
  console.log(`Export de contrôle : ${path.relative(process.cwd(), after.file)}`);
  report(censusBefore, census(after.docs), legacyLeft(after.docs));
}

function report(before: Map<string, number>, after: Map<string, number>, legacy: string[]) {
  const keys = [...new Set([...before.keys(), ...after.keys()])].sort();
  let lost = 0;
  console.log("\nValeurs par champ et par langue (avant → après)");
  for (const k of keys) {
    const a = before.get(k) ?? 0;
    const b = after.get(k) ?? 0;
    if (a !== b) lost += Math.max(0, a - b);
    console.log(`  ${a === b ? " " : "✗"} ${k.padEnd(52)} ${String(a).padStart(3)} → ${b}`);
  }
  const total = (m: Map<string, number>) => [...m.values()].reduce((s, n) => s + n, 0);
  console.log(`\nTotal : ${total(before)} → ${total(after)} · enveloppes restantes : ${legacy.length}`);
  if (lost || legacy.length || total(before) !== total(after)) {
    console.error("ÉCHEC de la vérification.");
    legacy.slice(0, 10).forEach((h) => console.error("  reste : " + h));
    process.exit(1);
  }
  console.log("OK — aucune traduction perdue.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
