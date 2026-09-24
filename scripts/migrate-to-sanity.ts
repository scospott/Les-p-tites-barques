/* ============================================================
   Migration du contenu vers Sanity — MIGRATION FINALE (septembre 2026).

   ⚠️ À NE PLUS LANCER SANS --logement. Depuis cette migration, Sanity est
   la SOURCE du site : le lancer en entier réécrirait (createOrReplace)
   site, assistante, destinations, lieux et avis avec le contenu figé dans
   ce script, et effacerait toute modification faite depuis dans le Studio.

     npx tsx scripts/migrate-to-sanity.ts --logement=guadeloupe   # un logement
     npx tsx scripts/migrate-to-sanity.ts --all                    # TOUT (garde-fou)

   Sans argument, le script refuse de tourner.

   SOURCE : l'état du code au commit de la migration finale (données des
   logements, messages/*.json, pages destination, prompt de l'assistante),
   figé dans `scripts/sanity-source/` (voir ce dossier). Le site, lui, ne
   lit plus que Sanity.

   IDEMPOTENCE : `_id` déterministes (`logement-parame`,
   `lieu-saint-malo-le-sillon`, `destination-saint-malo`…) et
   `createOrReplace` : relancer réécrit les mêmes documents, sans doublon.

   IMAGES : redimensionnées EN MÉMOIRE (2400 px au grand côté, JPEG q85)
   avant l'upload ; Sanity déduplique un fichier identique (même empreinte →
   même asset). Rien n'est écrit sur le disque.

   Le token d'écriture vient de SANITY_MIGRATION_TOKEN (.env.local, ignoré
   par git). Il n'est jamais affiché.
   ============================================================ */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@sanity/client";
import sharp from "sharp";

import { routing, type Locale } from "../src/i18n/routing";
import {
  ASSISTANT_TOKENS,
  apartments,
  buildLegacySystemPrompt,
  destinationSources,
  pick,
  site,
  type SourceApartment,
} from "./sanity-source";
import { flatten } from "./lib/flat-translations";
import { aplatirDocument } from "./lib/flat-nested";

/* ---------- Réglages ---------- */

const LOCALES = routing.locales as readonly Locale[];
const TRANSLATED = LOCALES.filter((l) => l !== "fr");
const PUBLIC_DIR = path.join(process.cwd(), "public");
const MAX_EDGE = 2400;
const JPEG_QUALITY = 85;
const ONLY_LOGEMENT = process.argv
  .find((a) => a.startsWith("--logement="))
  ?.slice("--logement=".length);
const ALL = process.argv.includes("--all");

// L'Antillaise a été renommée dans Sanity (nom, slug `l-antillaise`) après
// cette migration : la source figée ici porte encore l'ancien nom et
// l'écraserait.
if (ONLY_LOGEMENT === "guadeloupe" || ONLY_LOGEMENT === "l-antillaise" || ALL) {
  console.error("Refus : L'Antillaise se modifie désormais dans le Studio uniquement.");
  process.exit(1);
}

if (!ONLY_LOGEMENT && !ALL) {
  console.error(
    "Refus : Sanity est désormais la source du site. Utilisez --logement=<slug>, " +
      "ou --all en connaissance de cause (écrase les modifications faites dans le Studio).",
  );
  process.exit(1);
}

/* ---------- Client d'écriture ---------- */

const token = process.env.SANITY_MIGRATION_TOKEN;
if (!token) {
  console.error("SANITY_MIGRATION_TOKEN manquant. Ajoutez-le à .env.local (jamais au dépôt).");
  process.exit(1);
}

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "y9ozhj3q",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
  apiVersion: "2026-08-28",
  token,
  useCdn: false,
});

/* ---------- Champs traduisibles ---------- */

type Localized = Record<Locale, string>;

/**
 * `{ fr, translations: { en, de, nl, es, zh } }` — forme intermédiaire,
 * aplatie avant l'écriture (`sousTitre`, `sousTitreEn`… cf. lib/flat-translations).
 */
function localizedField(values: Partial<Localized>) {
  const fr = values.fr?.trim();
  if (!fr) return undefined;
  const translations: Record<string, string> = {};
  for (const l of TRANSLATED) {
    const value = values[l]?.trim();
    if (value) translations[l] = value;
  }
  return { fr, translations };
}

const everyLocale = (read: (l: Locale) => string | undefined) =>
  Object.fromEntries(LOCALES.map((l) => [l, read(l) ?? ""])) as Localized;

/** Champ localisé depuis un `Record<Locale, string>`. */
const loc = (value: Record<Locale, string> | undefined) =>
  value ? localizedField(everyLocale((l) => value[l])) : undefined;

/** Paragraphes → un seul texte, séparés par une ligne vide. */
const paras = (value: Record<Locale, string[]> | undefined) =>
  value ? localizedField(everyLocale((l) => value[l].join("\n\n"))) : undefined;

/** Tableau d'objets Sanity : chaque entrée a besoin d'une `_key` stable. */
const keyed = <T extends object>(items: T[], prefix: string) =>
  items.map((item, i) => ({ _key: `${prefix}-${i + 1}`, ...item }));

function frHash(doc: Record<string, unknown>): string {
  const french: string[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) {
        if (key === "translations") continue;
        if (key === "fr") french.push(JSON.stringify(value));
        else walk(value);
      }
    }
  };
  walk(doc);
  return createHash("sha256").update(french.join(" ")).digest("hex");
}

/* ---------- Messages ---------- */

const messages = new Map<Locale, unknown>();

async function loadMessages() {
  for (const l of LOCALES) {
    const raw = await readFile(
      path.join(process.cwd(), "scripts", "sanity-source", "messages", `${l}.json`),
      "utf8",
    );
    messages.set(l, JSON.parse(raw));
  }
}

function msg<T = unknown>(locale: Locale, dotted: string): T {
  let node: unknown = messages.get(locale);
  for (const key of dotted.split(".")) {
    node = (node as Record<string, unknown> | undefined)?.[key];
  }
  return node as T;
}

const msgString = (dotted: string) => localizedField(everyLocale((l) => msg<string>(l, dotted)));
const msgParas = (dotted: string) =>
  localizedField(everyLocale((l) => (msg<string[]>(l, dotted) ?? []).join("\n\n")));

/* ---------- Images ---------- */

let uploadedBytes = 0;
let uploadedCount = 0;
const assetCache = new Map<string, string>();
const missingImages: string[] = [];

async function uploadImage(publicPath: string, label: string): Promise<string | null> {
  const cached = assetCache.get(publicPath);
  if (cached) return cached;
  let body: Buffer;
  try {
    body = await sharp(path.join(PUBLIC_DIR, publicPath.replace(/^\//, "")))
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
  } catch {
    missingImages.push(publicPath);
    return null;
  }
  const asset = await client.assets.upload("image", body, {
    filename: path.basename(publicPath).replace(/\.[^.]+$/, ".jpg"),
    title: label,
  });
  uploadedBytes += body.byteLength;
  uploadedCount += 1;
  assetCache.set(publicPath, asset._id);
  return asset._id;
}

const imageValue = (assetId: string, extra: Record<string, unknown> = {}) => ({
  _type: "image",
  asset: { _type: "reference", _ref: assetId },
  ...extra,
});

/* ---------- Lieux ---------- */

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const lieuId = (destination: string, label: string) => `lieu-${destination}-${slugify(label)}`;

/** Catégorie déduite du nom (règle lisible, à revoir dans le Studio). */
function categorieDeLieu(nom: string): string {
  const n = nom.toLowerCase();
  if (/(plage|anse|sillon|bon.?secours|sables)/.test(n)) return "plage";
  if (/(gare|port|aéroport)/.test(n)) return "transport";
  if (/(jardin|forêt|parc|nature)/.test(n)) return "nature";
  if (/(marché|commerce|bourg)/.test(n)) return "commerce";
  return "culture";
}

function buildLieux() {
  const seen = new Map<string, Record<string, unknown>>();
  for (const a of apartments) {
    for (const point of a.mapPoints ?? []) {
      const id = lieuId(a.region, point.label);
      if (seen.has(id)) continue;
      seen.set(id, {
        _id: id,
        _type: "lieu",
        nom: point.label,
        requeteMaps: point.query,
        categorie: categorieDeLieu(point.label),
        destination: a.region,
        ordre: seen.size + 1,
      });
    }
  }
  return [...seen.values()];
}

/* ---------- Logements ---------- */

/** Libellés des infos clés qui ont désormais leur propre champ. */
const OWN_FIELD_FACTS = ["Surface", "N° d’enregistrement"];

/** « 2 voyageurs · 1 chambre · 1 lit · 1 salle de bain » → nombres (Studio = 0 chambre). */
function capacity(a: SourceApartment) {
  const parts = pick(a.capacity!, "fr").split("·").map((s) => s.trim());
  const n = (s: string | undefined) => {
    const v = Number.parseInt(s ?? "", 10);
    return Number.isFinite(v) ? v : undefined;
  };
  return {
    capacite: a.maxGuests ?? n(parts[0]),
    chambres: /studio/i.test(parts[1] ?? "") ? 0 : n(parts[1]),
    lits: n(parts[2]),
    sallesDeBain: n(parts[3]),
  };
}

function ville(a: SourceApartment): string | undefined {
  const part = a.address?.split(",").map((p) => p.trim()).find((p) => /^\d{5}\s/.test(p));
  return part?.replace(/^\d{5}\s+/, "");
}

async function buildLogements() {
  const docs = [];
  for (const [index, a] of apartments.entries()) {
    if (ONLY_LOGEMENT && a.slug !== ONLY_LOGEMENT) continue;
    const name = pick(a.name, "fr");
    const vitrine = await uploadImage(a.mainImage, `${name} — vitrine`);
    const galerie = [];
    for (const [i, src] of a.gallery.entries()) {
      const assetId = await uploadImage(src, `${name} — photo ${i + 1}`);
      if (!assetId) continue;
      galerie.push(
        imageValue(assetId, {
          _key: `photo-${i + 1}`,
          // Description seulement quand les données en ont une (L'Antillaise) :
          // sinon le site affiche « {nom} — photo N », comme aujourd'hui.
          ...(a.galleryAlts ? { alt: localizedField(everyLocale((l) => a.galleryAlts![l][i])) } : {}),
        }),
      );
    }

    const doc: Record<string, unknown> = {
      _id: `logement-${a.slug}`,
      _type: "logement",
      nom: name,
      slug: { _type: "slug", current: a.slug },
      destination: a.region,
      sousTitre: loc(a.locality),
      accroche: loc(a.tagline),
      ville: ville(a),
      ordre: index + 1,
      publie: true,
      ...capacity(a),
      surface: a.surface ? Number.parseFloat(a.surface.replace(",", ".")) : undefined,
      description: paras(a.description),
      detailSignature: loc(a.signature),
      atouts: a.highlights
        ? keyed(
            a.highlights.fr.map((_, i) => ({
              _type: "atout",
              ...localizedField(everyLocale((l) => a.highlights![l][i])),
            })),
            "atout",
          )
        : undefined,
      infosCles: keyed(
        (a.facts ?? [])
          .filter((f) => !OWN_FIELD_FACTS.includes(f.label.fr))
          .map((f) => ({ _type: "info", libelle: loc(f.label), valeur: loc(f.value) })),
        "info",
      ),
      equipements: keyed(
        (a.equipements ?? []).map((c) => ({
          _type: "categorie",
          icone: c.id,
          titre: c.title,
          elements: c.items,
        })),
        "cat",
      ),
      faq: keyed(
        (a.faq ?? []).map((f) => ({ _type: "question", question: loc(f.q), reponse: loc(f.a) })),
        "faq",
      ),
      questionsSuggerees: a.chatSuggestions
        ? keyed(
            a.chatSuggestions.fr.map((_, i) => ({
              _type: "question",
              ...localizedField(everyLocale((l) => a.chatSuggestions![l][i])),
            })),
            "q",
          )
        : undefined,
      adresse: a.address,
      situation: loc(a.locationNote),
      itineraires: keyed(
        (a.mapPoints ?? []).map((p) => ({
          _type: "itineraire",
          lieu: { _type: "reference", _ref: lieuId(a.region, p.label) },
          mode: p.mode ?? "driving",
        })),
        "it",
      ),
      position: a.mapPin ? { lat: a.mapPin.lat, lng: a.mapPin.lng } : undefined,
      quartier: loc(a.mapPlace),
      noteVoyageurs:
        typeof a.rating === "number"
          ? {
              note: a.rating,
              echelle: a.ratingScale ?? 5,
              nombreAvis: a.reviewCount,
              badge: loc(a.reviewBadge),
            }
          : undefined,
      imageVitrine: vitrine ? imageValue(vitrine) : undefined,
      galerie,
      numeroEnregistrement: a.registration,
      seo: a.seo ? { title: loc(a.seo.title), description: loc(a.seo.description) } : undefined,
    };
    doc.frHash = frHash(doc);
    docs.push(doc);
  }
  return docs;
}

/* ---------- Avis ---------- */

function buildAvis() {
  const docs = [];
  for (const a of apartments) {
    const source = a.ratingScale === 10 ? "booking" : "airbnb";
    for (const [i, review] of (a.reviews ?? []).entries()) {
      const doc: Record<string, unknown> = {
        _id: `avis-${a.slug}-${i + 1}`,
        _type: "avis",
        prenom: review.name,
        pays: review.country,
        // Langue d'origine, jamais traduit : rien dans `translations`.
        texte: { fr: review.text, translations: {} },
        source,
        date: review.date ? `${review.date}-01` : undefined,
        ordre: i + 1,
        logement: { _type: "reference", _ref: `logement-${a.slug}` },
        publie: true,
      };
      doc.frHash = frHash(doc);
      docs.push(doc);
    }
  }
  return docs;
}

/* ---------- Site ---------- */

async function buildSite() {
  const photo = await uploadImage("/images/accueil/gwenaelle.jpg", "Gwenaëlle");
  type Section = { id?: string; title: string; body: string[] };
  const sections = (l: Locale) => msg<Section[]>(l, "legal.sections");
  const doc: Record<string, unknown> = {
    _id: "site",
    _type: "site",
    contact: { email: site.email },
    reseaux: { instagram: site.instagram || undefined, facebook: site.facebook || undefined },
    baseline: msgString("footer.tagline"),
    hotesse: {
      nom: msg<string>("fr", "home.host.title"),
      texte: msgParas("home.host.body"),
      photo: photo ? imageValue(photo) : undefined,
    },
    promo: { actif: false },
    seo: { title: msgString("meta.home.title"), description: msgString("meta.home.description") },
    mentionsLegales: keyed(
      sections("fr").map((s, i) => ({
        _type: "section",
        titre: localizedField(everyLocale((l) => sections(l)[i].title)),
        paragraphes: localizedField(everyLocale((l) => sections(l)[i].body.join("\n\n"))),
        cle: s.id,
      })),
      "section",
    ),
  };
  doc.frHash = frHash(doc);
  return doc;
}

/* ---------- Destinations ---------- */

function buildDestinations() {
  return destinationSources.map((d, i) => {
    const key = `destination.${d.messagesKey}`;
    type Faq = { q: string; a: string };
    const faq = (l: Locale) => msg<Faq[]>(l, `${key}.faq`);
    const types = (l: Locale) => msg<string[]>(l, `${key}.touristType`);
    const lieux: string[] = [];
    for (const a of apartments.filter((x) => x.region === d.id)) {
      for (const p of a.mapPoints ?? []) {
        const id = lieuId(d.id, p.label);
        if (!lieux.includes(id)) lieux.push(id);
      }
    }
    const doc: Record<string, unknown> = {
      _id: `destination-${d.id}`,
      _type: "destination",
      slug: d.id,
      nom: d.label,
      lieuSchema: d.placeName,
      region: d.region,
      ordre: i + 1,
      surtitre: msgString(`${key}.kicker`),
      titre: msgString(`${key}.title`),
      sousTitre: msgString(`${key}.subtitle`),
      heroAlt: msgString(`${key}.heroAlt`),
      intro: msgParas(`${key}.intro`),
      typesVoyageurs: keyed(
        types("fr").map((_, j) => ({
          _type: "typeVoyageur",
          ...localizedField(everyLocale((l) => types(l)[j])),
        })),
        "type",
      ),
      faq: keyed(
        faq("fr").map((_, j) => ({
          _type: "question",
          question: localizedField(everyLocale((l) => faq(l)[j].q)),
          reponse: localizedField(everyLocale((l) => faq(l)[j].a)),
        })),
        "faq",
      ),
      seo: { title: msgString(`${key}.metaTitle`), description: msgString(`${key}.metaDescription`) },
      logements: keyed(
        apartments
          .filter((a) => a.region === d.id)
          .map((a) => ({ _type: "reference", _ref: `logement-${a.slug}` })),
        "logement",
      ),
      lieux: keyed(
        lieux.map((id) => ({ _type: "reference", _ref: id })),
        "lieu",
      ),
    };
    doc.frHash = frHash(doc);
    return doc;
  });
}

/* ---------- Assistante ---------- */

/**
 * Consignes = le prompt système français au moment de la migration, dont
 * les parties CALCULÉES sont remplacées par des jetons que le site remplit
 * à chaque requête (src/lib/assistant-prompt.ts) :
 *   {{logements}}  fiches des logements (depuis les documents logement)
 *   {{lieux}}      lieux réels des itinéraires
 *   {{remise}}     remise réservation directe (en %)
 *   {{extras}}     extras de réservation et leurs prix
 *   {{versionSite}} / {{langueSite}}  langue de la page consultée
 */
function buildAssistante() {
  const doc: Record<string, unknown> = {
    _id: "assistante",
    _type: "assistante",
    consignesGenerales: buildLegacySystemPrompt(ASSISTANT_TOKENS),
    faq: [],
  };
  doc.frHash = frHash(doc);
  return doc;
}

/* ---------- Exécution ---------- */

function prune<T>(value: T): T {
  if (Array.isArray(value)) return value.map(prune) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      const cleaned = prune(v);
      const empty =
        cleaned && typeof cleaned === "object" && !Array.isArray(cleaned)
          ? Object.keys(cleaned).length === 0 && k !== "translations"
          : Array.isArray(cleaned) && cleaned.length === 0 && k !== "faq";
      if (!empty) out[k] = cleaned;
    }
    return out as T;
  }
  return value;
}

async function main() {
  await loadMessages();
  console.log("Migration vers Sanity — projet %s / %s\n", client.config().projectId, client.config().dataset);

  const logements = await buildLogements();
  if (ONLY_LOGEMENT && !logements.length) {
    console.error(`Logement inconnu : ${ONLY_LOGEMENT}`);
    process.exit(1);
  }
  const all = (
    ONLY_LOGEMENT
      ? logements
      : [
          await buildSite(),
          buildAssistante(),
          ...buildLieux(),
          ...logements,
          ...buildDestinations(),
          ...buildAvis(),
        ]
  ).map((doc) => aplatirDocument(flatten(prune(doc)) as Record<string, unknown>));

  const tx = all.reduce((t, doc) => t.createOrReplace(doc as never), client.transaction());
  await tx.commit();

  const byType = all.reduce<Record<string, number>>((acc, d) => {
    const t = (d as { _type: string })._type;
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});
  console.log("Documents écrits");
  for (const [type, n] of Object.entries(byType)) console.log(`  ${type.padEnd(12)} ${n}`);
  console.log(`\nAssets envoyés : ${uploadedCount} images, ${(uploadedBytes / 1024 / 1024).toFixed(1)} Mo (Sanity déduplique les fichiers identiques)`);
  if (missingImages.length) {
    console.log(`\nImages introuvables (ignorées) : ${missingImages.length}`);
    for (const p of missingImages) console.log(`  ${p}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
