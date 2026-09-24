/* ============================================================
   Contrôle des données structurées (JSON-LD) des pages rendues.

     npm run build && npm start          # dans un autre terminal
     npx tsx scripts/validate-jsonld.ts [http://localhost:3000]

   Pour chaque page publique × 6 langues : récupère le HTML, extrait les
   <script type="application/ld+json">, vérifie qu'il y en a exactement un,
   que le JSON se parse, que `@context` vaut https://schema.org et que chaque
   nœud porte un `@type` ; puis que les types attendus pour la page sont là.
   Contrôles de contenu : chaque réponse FAQ balisée figure dans le HTML
   visible, BreadcrumbList / TouristDestination bien formés, et AUCUN
   balisage d'avis (AggregateRating / Review) : les avis viennent d'Airbnb. Affiche un tableau page × types et sort en erreur au moindre écart.
   ============================================================ */

import { createClient } from "@sanity/client";

import { destinationList } from "../src/lib/destination-config";
import { routing } from "../src/i18n/routing";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

// Logements publiés (et leur FAQ) lus dans Sanity, comme le site.
const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "y9ozhj3q",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
  apiVersion: "2026-08-28",
  useCdn: false,
});
const logements = await sanity.fetch<{ slug: string; faq: number }[]>(
  `*[_type == "logement" && publie != false] | order(ordre asc){ "slug": slug.current, "faq": count(faq) }`,
);
if (!logements.length) throw new Error("Aucun logement publié dans Sanity.");

const COMMON = ["Organization", "WebSite", "BreadcrumbList"];
const PAGES: { path: string; expect: string[] }[] = [
  { path: "/", expect: [...COMMON, "ItemList", "Person"] },
  ...destinationList.map((d) => ({
    path: d.path,
    expect: [...COMMON, "TouristDestination", "ItemList", "FAQPage"],
  })),
  ...logements.map((l) => ({
    path: `/appartements/${l.slug}`,
    expect: [...COMMON, "VacationRental", ...(l.faq ? ["FAQPage"] : [])],
  })),
  { path: "/mentions-legales", expect: COMMON },
];

type Node = Record<string, unknown>;

function extract(html: string): string[] {
  const re = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  return [...html.matchAll(re)].map((m) => m[1]);
}

/** Contrôles de contenu des nœuds sensibles (FAQ, note, fil d'Ariane, destination). */
function checkNode(n: Node, html: string, errors: string[]) {
  const type = n["@type"];
  if (type === "FAQPage") {
    const qs = (n.mainEntity as Node[] | undefined) ?? [];
    if (!qs.length) errors.push("FAQPage vide");
    for (const q of qs) {
      const a = (q.acceptedAnswer as Node | undefined)?.text;
      if (q["@type"] !== "Question" || typeof q.name !== "string" || typeof a !== "string")
        errors.push("FAQPage : question ou réponse mal formée");
      // Le balisage doit refléter le contenu visible : la réponse est dans le HTML.
      else if (!decode(html).includes(a)) errors.push(`FAQ absente de la page : « ${q.name} »`);
    }
  }
  // Avis tiers (Airbnb) : aucun balisage d'avis nulle part dans le graphe.
  if (/"(AggregateRating|Review)"|"(aggregateRating|review)":/.test(JSON.stringify(n)))
    errors.push("balisage d'avis présent (avis tiers : à ne pas baliser)");
  if (type === "BreadcrumbList") {
    const items = (n.itemListElement as Node[] | undefined) ?? [];
    if (items.some((it, i) => it.position !== i + 1 || typeof it.item !== "string"))
      errors.push("BreadcrumbList mal formé");
  }
  if (type === "TouristDestination") {
    if (!n.name || !n.containedInPlace || !Array.isArray(n.touristType))
      errors.push("TouristDestination : name / containedInPlace / touristType manquant");
  }
}

/** Entités HTML courantes → caractères (le texte React est échappé). */
function decode(html: string): string {
  return html
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function check(raw: string[], html = ""): { types: string[]; errors: string[] } {
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
      else {
        types.push(n["@type"]);
        checkNode(n, html, errors);
      }
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
    const { types, errors } = res.status === 200 ? check(extract(html), html.replace(/<script[\s\S]*?<\/script>/g, "")) : { types: [], errors: [`HTTP ${res.status}`] };
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
