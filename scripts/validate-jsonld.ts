/* ============================================================
   Contrôle des données structurées (JSON-LD) des pages rendues.

     npm run build && npm start          # dans un autre terminal
     npx tsx scripts/validate-jsonld.ts [http://localhost:3000]

   Pour chaque page publique × 6 langues : récupère le HTML, extrait les
   <script type="application/ld+json">, vérifie qu'il y en a exactement un,
   que le JSON se parse, que `@context` vaut https://schema.org et que chaque
   nœud porte un `@type` ; puis que les types attendus pour la page sont là.
   Affiche un tableau page × types et sort en erreur au moindre écart.
   ============================================================ */

import { apartmentSlugs } from "../src/lib/appartements";
import { routing } from "../src/i18n/routing";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

const COMMON = ["Organization", "WebSite", "BreadcrumbList"];
const PAGES: { path: string; expect: string[] }[] = [
  { path: "/", expect: [...COMMON, "ItemList", "Person"] },
  ...apartmentSlugs.map((s) => ({
    path: `/appartements/${s}`,
    expect: [...COMMON, "VacationRental"],
  })),
  { path: "/mentions-legales", expect: COMMON },
];

type Node = Record<string, unknown>;

function extract(html: string): string[] {
  const re = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  return [...html.matchAll(re)].map((m) => m[1]);
}

function check(raw: string[]): { types: string[]; errors: string[] } {
  const errors: string[] = [];
  if (raw.length !== 1) errors.push(`${raw.length} script(s) JSON-LD (1 attendu)`);
  const types: string[] = [];
  for (const block of raw) {
    let data: Node;
    try {
      data = JSON.parse(block);
    } catch (e) {
      errors.push(`JSON invalide : ${(e as Error).message}`);
      continue;
    }
    if (data["@context"] !== "https://schema.org") errors.push("@context manquant ou inattendu");
    const nodes = (data["@graph"] as Node[] | undefined) ?? [data];
    for (const n of nodes) {
      if (typeof n["@type"] !== "string") errors.push("nœud sans @type");
      else types.push(n["@type"]);
    }
  }
  return { types, errors };
}

const rows: string[][] = [];
let failures = 0;
for (const page of PAGES) {
  for (const locale of routing.locales) {
    const path = locale === routing.defaultLocale ? page.path : `/${locale}${page.path === "/" ? "" : page.path}`;
    const res = await fetch(BASE + path, { headers: { "Accept-Language": locale }, redirect: "manual" });
    const html = res.status === 200 ? await res.text() : "";
    const { types, errors } = res.status === 200 ? check(extract(html)) : { types: [], errors: [`HTTP ${res.status}`] };
    const missing = page.expect.filter((t) => !types.includes(t));
    if (missing.length) errors.push(`manque : ${missing.join(", ")}`);
    if (errors.length) failures++;
    rows.push([path, types.join(", "), errors.length ? `KO — ${errors.join(" ; ")}` : "OK"]);
  }
}

const widths = [0, 1, 2].map((i) => Math.max(...rows.map((r) => r[i].length), 6));
const line = (r: string[]) => r.map((c, i) => c.padEnd(widths[i])).join(" | ");
console.log(line(["Page", "Types", "Statut"]));
console.log(widths.map((w) => "-".repeat(w)).join("-|-"));
rows.forEach((r) => console.log(line(r)));
console.log(`\n${rows.length - failures}/${rows.length} pages valides.`);
process.exit(failures ? 1 : 0);
