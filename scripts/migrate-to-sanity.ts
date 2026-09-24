/* ============================================================
   Migration du contenu actuel vers Sanity — À EXÉCUTER UNE FOIS,
   relançable sans dommage.

     npx tsx scripts/migrate-to-sanity.ts
     npx tsx scripts/migrate-to-sanity.ts --logement=guadeloupe

   `--logement=<slug>` : ne réécrit QUE ce document logement (galerie et
   vitrine comprises) ; site, assistante, lieux et avis ne sont pas touchés.

   IDEMPOTENCE : chaque document a un `_id` déterministe (`logement-parame`,
   `lieu-saint-malo-le-sillon`, …) et part en `createOrReplace`. Relancer le
   script réécrit les mêmes documents ; il n'en crée jamais de doublon.

   SOURCE : les modules de l'application eux-mêmes (`lib/appartements`,
   `lib/site`, `messages/*.json`). Rien n'est recopié à la main — donc rien
   ne peut diverger silencieusement de ce que le site affiche aujourd'hui.

   IMAGES : les photos du dépôt font 2560 px (galeries). Sanity n'a pas
   besoin de cette réserve : on redimensionne EN MÉMOIRE à 2400 px sur le
   grand côté, JPEG q85, avant l'upload. Rien n'est écrit sur le disque,
   donc rien ne peut atterrir dans le dépôt.

   Le token d'écriture vient de SANITY_MIGRATION_TOKEN (.env.local, ignoré
   par git). Il n'est jamais affiché.
   ============================================================ */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@sanity/client";
import sharp from "sharp";

import { apartments, pick, type Apartment } from "../src/lib/appartements";
import { buildSystemPrompt } from "../src/lib/assistant-knowledge";
import { site } from "../src/lib/site";
import { routing, type Locale } from "../src/i18n/routing";

/* ---------- Réglages ---------- */

const LOCALES = routing.locales as readonly Locale[];
/** Les cinq langues dérivées du français. */
const TRANSLATED = LOCALES.filter((l) => l !== "fr");
const PUBLIC_DIR = path.join(process.cwd(), "public");
/** Grand côté maximal des images envoyées à Sanity. */
const MAX_EDGE = 2400;
const JPEG_QUALITY = 85;
/** `--logement=<slug>` : migration limitée à ce logement. */
const ONLY_LOGEMENT = process.argv
  .find((a) => a.startsWith("--logement="))
  ?.slice("--logement=".length);

/* ---------- Client d'écriture ---------- */

const token = process.env.SANITY_MIGRATION_TOKEN;
if (!token) {
  console.error(
    "SANITY_MIGRATION_TOKEN manquant. Ajoutez-le à .env.local (jamais au dépôt).",
  );
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

/** `{ fr, translations: { en, de, nl, es, zh } }` — la forme du schéma. */
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

function blocks(paragraphs: string[], locale: string) {
  return paragraphs
    .filter((p) => p && p.trim())
    .map((text, i) => ({
      _type: "block",
      _key: `${locale}-${i}`,
      style: "normal",
      markDefs: [],
      children: [{ _type: "span", _key: `${locale}-${i}-0`, text, marks: [] }],
    }));
}

/** Idem, en Portable Text (un bloc par paragraphe). */
function localizedBlocks(values: Partial<Record<Locale, string[]>>) {
  const fr = values.fr ?? [];
  if (!fr.length) return undefined;
  const translations: Record<string, unknown[]> = {};
  for (const l of TRANSLATED) {
    if (values[l]?.length) translations[l] = blocks(values[l]!, l);
  }
  return { fr: blocks(fr, "fr"), translations };
}

/**
 * Empreinte du contenu FRANÇAIS du document. L'agent de traduction s'en
 * servira pour ne retraduire que ce qui a réellement bougé : les sous-objets
 * `translations` sont donc exclus du calcul.
 */
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

/* ---------- Lecture des messages/*.json ---------- */

const messages = new Map<Locale, unknown>();

async function loadMessages() {
  for (const l of LOCALES) {
    const raw = await readFile(path.join(process.cwd(), "messages", `${l}.json`), "utf8");
    messages.set(l, JSON.parse(raw));
  }
}

/** Valeur d'un chemin pointé (« home.intro.body ») dans une locale. */
function msg(locale: Locale, dotted: string): unknown {
  let node: unknown = messages.get(locale);
  for (const key of dotted.split(".")) {
    if (!node || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

const msgString = (dotted: string) =>
  localizedField(
    Object.fromEntries(
      LOCALES.map((l) => [l, (msg(l, dotted) as string | undefined) ?? ""]),
    ) as Localized,
  );

const msgBlocks = (dotted: string) =>
  localizedBlocks(
    Object.fromEntries(
      LOCALES.map((l) => [l, (msg(l, dotted) as string[] | undefined) ?? []]),
    ) as Record<Locale, string[]>,
  );

/** Les mentions légales : 6 sections { title, body[] } → suite de paragraphes. */
const legalParagraphs = (locale: Locale): string[] => {
  const sections = (msg(locale, "legal.sections") ?? []) as {
    id?: string;
    title?: string;
    body?: string[];
  }[];
  const rentalLine = (msg(locale, "legal.rentalLine") as string | undefined) ?? "{name} : {number}";
  // Section `rentals` : la page lit les numéros dans les données des
  // logements ; on les recopie ici pour que le champ Sanity soit complet.
  const rentals = apartments
    .filter((a) => a.registration)
    .map((a) =>
      rentalLine.replace("{name}", pick(a.name, locale)).replace("{number}", a.registration!),
    );
  return sections.flatMap((s) =>
    [s.title ?? "", ...(s.body ?? []), ...(s.id === "rentals" ? rentals : [])].filter(Boolean),
  );
};

/* ---------- Images ---------- */

let uploadedBytes = 0;
let uploadedCount = 0;
/** Un même fichier n'est envoyé qu'une fois, même s'il sert à deux endroits. */
const assetCache = new Map<string, string>();
const missingImages: string[] = [];

async function uploadImage(publicPath: string, label: string): Promise<string | null> {
  const cached = assetCache.get(publicPath);
  if (cached) return cached;

  const file = path.join(PUBLIC_DIR, publicPath.replace(/^\//, ""));
  let body: Buffer;
  try {
    body = await sharp(file)
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

/* ---------- Lecture des données actuelles ---------- */

const everyLocale = (read: (l: Locale) => string | undefined) =>
  Object.fromEntries(LOCALES.map((l) => [l, read(l) ?? ""])) as Localized;

/** Valeur d'une info clé, retrouvée par son libellé FRANÇAIS (canonique). */
function factField(a: Apartment, labelFr: string) {
  const entry = a.facts?.find((f) => pick(f.label, "fr") === labelFr);
  if (!entry) return undefined;
  return localizedField(everyLocale((l) => pick(entry.value, l)));
}

/** n-ième segment de la ligne de capacité (« 2 voyageurs · 1 chambre · … »). */
function capacityPart(a: Apartment, index: number): number | undefined {
  if (!a.capacity) return undefined;
  const parts = pick(a.capacity, "fr").split("·").map((s) => s.trim());
  const n = Number.parseInt(parts[index] ?? "", 10);
  return Number.isFinite(n) ? n : undefined;
}

/** « 43 m² » → 43. */
function surfaceNumber(a: Apartment): number | undefined {
  const n = Number.parseInt(a.surface ?? "", 10);
  return Number.isFinite(n) ? n : undefined;
}

/** Ville, lue dans l'adresse postale (segment avant le pays, sans code postal). */
function ville(a: Apartment): string | undefined {
  const parts = a.address?.split(",").map((s) => s.trim());
  if (!parts || parts.length < 2) return undefined;
  return parts[parts.length - 2]?.replace(/^\d[\d\s]*/, "").trim() || undefined;
}

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/* ---------- Documents : logements ---------- */

async function buildLogements() {
  const docs = [];
  for (const [index, a] of apartments.entries()) {
    if (ONLY_LOGEMENT && a.slug !== ONLY_LOGEMENT) continue;
    const vitrine = await uploadImage(a.mainImage, `${pick(a.name, "fr")} — vitrine`);
    const galerie = [];
    for (const [i, src] of a.gallery.entries()) {
      const assetId = await uploadImage(src, `${pick(a.name, "fr")} — photo ${i + 1}`);
      if (!assetId) continue;
      galerie.push({
        ...imageValue(assetId, { _key: `photo-${i + 1}` }),
        // Description par photo quand les données en ont une
        // (`galleryAlts`) ; sinon le nom du logement, comme le site.
        alt: localizedField(
          everyLocale((l) =>
            a.galleryAlts ? pick(a.galleryAlts, l)[i] : pick(a.name, l),
          ),
        ),
      });
    }

    const doc: Record<string, unknown> = {
      _id: `logement-${a.slug}`,
      _type: "logement",
      nom: pick(a.name, "fr"),
      slug: { _type: "slug", current: a.slug },
      sousTitre: localizedField(everyLocale((l) => pick(a.locality, l))),
      ville: ville(a),
      ordre: index + 1,
      publie: true,
      capacite: a.maxGuests ?? capacityPart(a, 0),
      chambres: capacityPart(a, 1),
      lits: capacityPart(a, 2),
      sallesDeBain: capacityPart(a, 3),
      surface: surfaceNumber(a),
      description: localizedField(
        everyLocale((l) => (a.description ? pick(a.description, l).join("\n\n") : "")),
      ),
      detailSignature: a.signature
        ? localizedField(everyLocale((l) => pick(a.signature!, l)))
        : undefined,
      infosPratiques: {
        plage: factField(a, "Plage") ?? factField(a, "Plages à pied"),
        emplacement: factField(a, "Emplacement"),
        stationnement: factField(a, "Stationnement"),
        // Heures d'arrivée et de départ : absentes des données actuelles.
        arrivee: undefined,
        depart: undefined,
      },
      // Les équipements sont catégorisés côté site (accordéon) mais rédigés
      // en français seulement : on migre les intitulés à plat, sans inventer
      // de traduction.
      equipements: (a.equipements ?? []).flatMap((cat) =>
        cat.items.map((item, i) => ({
          _type: "equipement",
          _key: `${cat.id}-${i}`,
          fr: item,
          translations: {},
        })),
      ),
      imageVitrine: vitrine ? imageValue(vitrine) : undefined,
      galerie,
      numeroEnregistrement: a.registration,
      seo: a.seo
        ? {
            title: localizedField(everyLocale((l) => pick(a.seo!.title, l))),
            description: localizedField(everyLocale((l) => pick(a.seo!.description, l))),
          }
        : undefined,
    };
    doc.frHash = frHash(doc);
    docs.push(doc);
  }
  return docs;
}

/* ---------- Documents : lieux ---------- */

/**
 * Catégorie déduite du nom du lieu, par mots-clés explicites. Les données
 * actuelles n'en portent pas : plutôt que de laisser le champ vide (il est
 * obligatoire), on applique une règle lisible, et tout ce qui n'entre dans
 * aucune case retombe sur « culture », à revoir dans le Studio.
 */
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
    const destination = a.region === "guadeloupe" ? "guadeloupe" : "saint-malo";
    for (const point of a.mapPoints ?? []) {
      const id = `lieu-${destination}-${slugify(point.label)}`;
      if (seen.has(id)) continue;
      const doc: Record<string, unknown> = {
        _id: id,
        _type: "lieu",
        nom: point.label,
        categorie: categorieDeLieu(point.label),
        destination,
        ordre: seen.size + 1,
        // Latitude / longitude : les données actuelles ne portent que la
        // requête Google Maps du point, pas ses coordonnées. À renseigner
        // dans le Studio.
      };
      doc.frHash = frHash(doc);
      seen.set(id, doc);
    }
  }
  return [...seen.values()];
}

/* ---------- Documents : avis ---------- */

function buildAvis() {
  const docs = [];
  for (const a of apartments) {
    // Échelle sur 5 = Airbnb, sur 10 = Booking : c'est la seule trace de
    // provenance présente dans les données actuelles.
    const source = a.ratingScale === 10 ? "booking" : "airbnb";
    for (const [i, review] of (a.reviews ?? []).entries()) {
      const doc: Record<string, unknown> = {
        _id: `avis-${a.slug}-${i + 1}`,
        _type: "avis",
        prenom: review.name,
        // Les avis sont conservés dans la langue d'origine du voyageur et ne
        // sont pas traduits sur le site : rien à mettre dans `translations`.
        texte: { fr: review.text, translations: {} },
        source,
        logement: { _type: "reference", _ref: `logement-${a.slug}` },
        publie: true,
      };
      doc.frHash = frHash(doc);
      docs.push(doc);
    }
  }
  return docs;
}

/* ---------- Documents : site et assistante ---------- */

async function buildSite() {
  const photo = await uploadImage("/images/accueil/gwenaelle.jpg", "Gwenaëlle");
  const doc: Record<string, unknown> = {
    _id: "site",
    _type: "site",
    email: site.email,
    instagram: site.instagram,
    facebook: site.facebook,
    baseline: msgString("footer.tagline"),
    histoire: msgBlocks("home.story.body"),
    motHotesse: msgBlocks("home.intro.body"),
    photoHotesse: photo ? imageValue(photo) : undefined,
    promo: { actif: false },
    seo: {
      title: msgString("meta.home.title"),
      description: msgString("meta.home.description"),
    },
    mentionsLegales: localizedBlocks(
      Object.fromEntries(LOCALES.map((l) => [l, legalParagraphs(l)])) as Record<
        Locale,
        string[]
      >,
    ),
  };
  doc.frHash = frHash(doc);
  return doc;
}

/**
 * Consignes de l'assistante = le prompt système français ACTUEL, amputé de
 * sa section « Mes logements » : celle-ci est calculée à chaque requête
 * depuis les données des logements, elle n'a rien à faire dans un champ
 * éditable (elle y serait figée, donc fausse au premier changement).
 */
function consignesAssistante(): string {
  const prompt = buildSystemPrompt("fr");
  return prompt.replace(
    /# Mes logements\n[\s\S]*?(?=\n# Réservation et tarifs)/,
    "# Mes logements\n(La fiche de chaque logement est ajoutée automatiquement ici, " +
      "depuis le back-office : nom, description, capacité, équipements, adresse, " +
      "alentours et avis. Rien à recopier.)\n",
  );
}

function buildAssistante() {
  const doc: Record<string, unknown> = {
    _id: "assistante",
    _type: "assistante",
    consignesGenerales: consignesAssistante(),
    // FAQ, règles de la maison et recommandations : rien de tel dans les
    // données actuelles. Champs laissés vides, à remplir dans le Studio.
    faq: [],
  };
  doc.frHash = frHash(doc);
  return doc;
}

/* ---------- Exécution ---------- */

/** Retire les `undefined` — Sanity refuse un champ explicitement indéfini. */
function prune<T>(value: T): T {
  if (Array.isArray(value)) return value.map(prune) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      const cleaned = prune(v);
      const empty =
        cleaned && typeof cleaned === "object" && !Array.isArray(cleaned)
          ? Object.keys(cleaned).length === 0
          : false;
      if (!empty) out[k] = cleaned;
    }
    return out as T;
  }
  return value;
}

async function main() {
  await loadMessages();

  console.log("Migration vers Sanity — projet %s / %s\n", client.config().projectId, client.config().dataset);
  console.log("Upload des images (redimensionnement %d px, JPEG q%d)…", MAX_EDGE, JPEG_QUALITY);

  const logements = await buildLogements();
  if (ONLY_LOGEMENT && !logements.length) {
    console.error(`Logement inconnu : ${ONLY_LOGEMENT}`);
    process.exit(1);
  }
  const all = (
    ONLY_LOGEMENT
      ? logements
      : [await buildSite(), buildAssistante(), ...logements, ...buildLieux(), ...buildAvis()]
  ).map(prune);

  const tx = all.reduce((t, doc) => t.createOrReplace(doc as never), client.transaction());
  await tx.commit();

  const byType = all.reduce<Record<string, number>>((acc, d) => {
    const t = (d as { _type: string })._type;
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});

  console.log("\nDocuments écrits");
  for (const [type, n] of Object.entries(byType)) console.log(`  ${type.padEnd(12)} ${n}`);
  console.log(
    `\nAssets : ${uploadedCount} images, ${(uploadedBytes / 1024 / 1024).toFixed(1)} Mo`,
  );
  if (missingImages.length) {
    console.log(`\nImages introuvables (ignorées) : ${missingImages.length}`);
    for (const p of missingImages) console.log(`  ${p}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
