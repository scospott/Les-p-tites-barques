import "server-only";

import { cache } from "react";
import { getTranslations } from "next-intl/server";

import { routing, type Locale } from "@/i18n/routing";
import { apartmentConfig } from "@/lib/apartment-config";
import type {
  Apartment,
  Localized,
  LocalizedList,
  MapPoint,
} from "@/lib/appartements";
import type { DestinationId } from "@/lib/destinations";

import { sanityFetch } from "./fetch";
import {
  ASSISTANTE_QUERY,
  DESTINATIONS_QUERY,
  LOGEMENTS_QUERY,
  SITE_QUERY,
} from "./queries";

/* ============================================================
   Adaptateurs Sanity → formes consommées par les composants.

   Les composants ne changent pas de props : `getApartments()` renvoie
   EXACTEMENT le type `Apartment` que lisait l'ancien lib/appartements.ts
   (six langues résolues, repli sur le français), complété des réglages
   structurels du code (lib/apartment-config.ts).

   Mise en cache : `cache()` (une requête par rendu) au-dessus du Data
   Cache de Next (5 min, étiquettes — cf. fetch.ts).
   ============================================================ */

/* ---------- Types bruts (forme des réponses GROQ) ---------- */

type Extra = Exclude<Locale, "fr">;

/** Suffixe des champs de traduction (cf. schemas/localized.ts). */
const SUFFIX: Record<Extra, string> = { en: "En", de: "De", nl: "Nl", es: "Es", zh: "Zh" };

/**
 * Objet porteur de champs traduisibles, tel que stocké : `titre` (français)
 * et ses frères plats `titreEn`, `titreDe`… Les clés sont lues par nom via
 * `localise(obj, "titre", locale)`.
 */
export type Translatable = Record<string, unknown>;

type RawImage = { url?: string; width?: number; height?: number } | null;
/** `{ question, questionEn…, reponse, reponseEn… }` */
type RawFaq = Translatable[] | null;
type RawSeo = Translatable | null;

interface RawLogement extends Translatable {
  _id: string;
  _updatedAt: string;
  nom: string;
  slug: string;
  destination: DestinationId;
  ville?: string;
  capacite: number;
  chambres?: number;
  lits?: number;
  sallesDeBain?: number;
  surface?: number;
  /** `{ atout, atoutEn… }` */
  atouts: Translatable[] | null;
  /** `{ libelle…, valeur… }` */
  infosCles: Translatable[] | null;
  equipements: { icone: string; titre: string; elements?: string[] }[] | null;
  faq: RawFaq;
  /** `{ question, questionEn… }` */
  questionsSuggerees: Translatable[] | null;
  adresse?: string;
  itineraires: { mode?: "walking" | "driving"; lieu: { nom: string; requeteMaps: string } | null }[] | null;
  position?: { lat?: number; lng?: number } | null;
  /** `{ note, echelle, nombreAvis, badge… }` */
  noteVoyageurs?: (Translatable & {
    note?: number;
    echelle?: 5 | 10;
    nombreAvis?: number;
  }) | null;
  vitrine: RawImage;
  /** `{ alt…, legende…, url, width, height }` */
  galerie: (Translatable & NonNullable<RawImage>)[] | null;
  seo?: RawSeo;
  numeroEnregistrement?: string;
  avis: { prenom: string; pays?: string; date?: string; texte?: string }[] | null;
}

interface RawDestination extends Translatable {
  _updatedAt: string;
  slug: DestinationId;
  nom: string;
  lieuSchema?: string;
  region?: string;
  /** `{ typeVoyageur, typeVoyageurEn… }` */
  typesVoyageurs: Translatable[] | null;
  faq: RawFaq;
  seo?: RawSeo;
  logements: string[] | null;
  lieux: { nom: string; requeteMaps: string }[] | null;
}

interface RawSite extends Translatable {
  _updatedAt: string;
  contact?: { email?: string; telephone?: string; afficherTelephone?: boolean } | null;
  reseaux?: { instagram?: string; facebook?: string } | null;
  /** `{ nom, texte…, photo }` */
  hotesse?: (Translatable & { nom?: string; photo: RawImage }) | null;
  seo?: RawSeo;
  /** `{ titre…, paragraphes…, cle }` */
  mentionsLegales: (Translatable & { cle?: string })[] | null;
}

export interface RawAssistante extends Translatable {
  consignesGenerales?: string;
  faq: RawFaq;
}

/* ---------- Langues ---------- */

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * Le champ `field` de `obj` dans une langue : `obj[field + suffixe]`,
 * traduction absente → le français `obj[field]`.
 */
export function localise(
  obj: Translatable | null | undefined,
  field: string,
  locale: Locale,
): string {
  if (!obj) return "";
  if (locale !== "fr") {
    const t = text(obj[field + SUFFIX[locale]]);
    if (t) return t;
  }
  return text(obj[field]);
}

/** Les six langues d'un champ. */
function all(obj: Translatable | null | undefined, field: string): Localized {
  return Object.fromEntries(
    routing.locales.map((l) => [l, localise(obj, field, l)]),
  ) as Localized;
}

/** Un texte à paragraphes (séparés par une ligne vide) → six listes. */
function allParagraphs(obj: Translatable | null | undefined, field: string): LocalizedList {
  return Object.fromEntries(
    routing.locales.map((l) => [l, splitParagraphs(localise(obj, field, l))]),
  ) as LocalizedList;
}

export const splitParagraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

/** Tableau d'entrées traduisibles → six listes (même longueur partout). */
function allList(
  items: Translatable[] | null | undefined,
  field: string,
): LocalizedList | undefined {
  if (!items?.length) return undefined;
  return Object.fromEntries(
    routing.locales.map((l) => [l, items.map((i) => localise(i, field, l))]),
  ) as LocalizedList;
}

/** Le français du champ est-il renseigné ? */
export const has = (obj: Translatable | null | undefined, field: string) =>
  !!text(obj?.[field]);

/** Le champ, s'il est renseigné, dans les six langues. */
const optional = (obj: Translatable | null | undefined, field: string) =>
  has(obj, field) ? all(obj, field) : undefined;

function requireData<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
    // Pas de repli silencieux : un site sans logement (Sanity vide ou
    // injoignable) doit faire échouer le build, pas s'afficher vide.
    throw new Error(`Sanity : ${what} introuvable(s).`);
  }
  return value;
}

/* ---------- Logements ---------- */

/** Libellés d'interface (messages) dont la fiche a besoin, dans les six langues. */
const apartmentLabels = cache(async () => {
  const out = {} as Record<
    Locale,
    {
      capacity: (n: { guests: number; bedrooms: number; beds: number; baths: number }) => string;
      surface: string;
      registration: string;
    }
  >;
  for (const l of routing.locales) {
    const t = await getTranslations({ locale: l, namespace: "apartment" });
    out[l] = {
      capacity: ({ guests, bedrooms, beds, baths }) =>
        [
          t("capacityParts.guests", { count: guests }),
          t("capacityParts.bedrooms", { count: bedrooms }),
          t("capacityParts.beds", { count: beds }),
          t("capacityParts.baths", { count: baths }),
        ].join(" · "),
      surface: t("surface"),
      registration: t("registration"),
    };
  }
  return out;
});

type Labels = Awaited<ReturnType<typeof apartmentLabels>>;

function toApartment(raw: RawLogement, labels: Labels): Apartment {
  const config = apartmentConfig[raw.slug] ?? {};
  const byLocale = <T,>(read: (l: Locale) => T) =>
    Object.fromEntries(routing.locales.map((l) => [l, read(l)])) as Record<Locale, T>;

  const surface = typeof raw.surface === "number" ? `${raw.surface} m²` : undefined;
  const composition =
    raw.chambres !== undefined && raw.lits !== undefined && raw.sallesDeBain !== undefined;

  // Infos clés telles que les lit l'assistante : surface en tête, puis les
  // infos du Studio, puis le n° d'enregistrement (ordre de l'ancien code).
  const facts = [
    ...(surface
      ? [{ label: byLocale((l) => labels[l].surface), value: byLocale(() => surface) }]
      : []),
    ...(raw.infosCles ?? []).map((f) => ({ label: all(f, "libelle"), value: all(f, "valeur") })),
    ...(raw.numeroEnregistrement?.trim()
      ? [
          {
            label: byLocale((l) => labels[l].registration),
            value: byLocale(() => raw.numeroEnregistrement!),
          },
        ]
      : []),
  ];

  const mapPoints: MapPoint[] = (raw.itineraires ?? [])
    .filter((i) => i.lieu)
    .map((i) => ({ label: i.lieu!.nom, query: i.lieu!.requeteMaps, mode: i.mode ?? "driving" }));

  const galerie = (raw.galerie ?? []).filter((g) => g.url);
  const hasAlts = galerie.length > 0 && galerie.every((g) => has(g, "alt"));
  const note = raw.noteVoyageurs;

  return {
    slug: raw.slug,
    region: raw.destination,
    status: config.status ?? "complete",
    updatedAt: raw._updatedAt,
    mainImage: requireData(raw.vitrine?.url, `photo vitrine de « ${raw.nom} »`),
    maxGuests: raw.capacite,
    capacity: composition
      ? byLocale((l) =>
          labels[l].capacity({
            guests: raw.capacite,
            bedrooms: raw.chambres!,
            beds: raw.lits!,
            baths: raw.sallesDeBain!,
          }),
        )
      : undefined,
    gallery: galerie.map((g) => g.url!),
    galleryAlts: hasAlts
      ? byLocale((l) => galerie.map((g) => localise(g, "alt", l)))
      : undefined,
    gallerySlots: config.gallerySlots,
    name: byLocale(() => raw.nom),
    locality: all(raw, "sousTitre"),
    tagline: all(raw, "accroche"),
    seo: has(raw.seo, "title")
      ? { title: all(raw.seo, "title"), description: all(raw.seo, "description") }
      : undefined,
    chatSuggestions: allList(raw.questionsSuggerees, "question"),
    description: has(raw, "description") ? allParagraphs(raw, "description") : undefined,
    highlights: allList(raw.atouts, "atout"),
    facts: facts.length ? facts : undefined,
    faq: (raw.faq ?? []).map((f) => ({ q: all(f, "question"), a: all(f, "reponse") })),
    surface,
    registration: raw.numeroEnregistrement || undefined,
    locationNote: optional(raw, "situation"),
    equipements: raw.equipements?.length
      ? raw.equipements.map((c) => ({ id: c.icone, title: c.titre, items: c.elements ?? [] }))
      : undefined,
    rating: note?.note ?? undefined,
    ratingScale: note?.echelle ?? undefined,
    reviewCount: note?.nombreAvis ?? undefined,
    reviewBadge: optional(note, "badge"),
    // Avis : dans la langue d'origine du voyageur (jamais traduits).
    reviews: (raw.avis ?? []).map((r) => ({
      name: r.prenom,
      ...(r.pays ? { country: r.pays } : {}),
      ...(r.date ? { date: r.date.slice(0, 7) } : {}),
      text: r.texte ?? "",
    })),
    address: raw.adresse || undefined,
    mapPoints: mapPoints.length ? mapPoints : undefined,
    mapPin:
      typeof raw.position?.lat === "number" && typeof raw.position?.lng === "number"
        ? {
            lat: raw.position.lat,
            lng: raw.position.lng,
            ...(config.card ? { card: config.card } : {}),
            ...(config.compactCard ? { compactCard: config.compactCard } : {}),
          }
        : undefined,
    mapPlace: optional(raw, "quartier"),
    signature: optional(raw, "detailSignature"),
    pricing: config.pricing,
    scrubHeroes: config.scrubHeroes,
    noHero2: config.noHero2,
    hero1Image: config.hero1Image,
    hero2Image: config.hero2Image,
    hero2Framing: config.hero2Framing,
  };
}

/** Les logements publiés, dans l'ordre d'affichage, six langues résolues. */
export const getApartments = cache(async (): Promise<Apartment[]> => {
  const [raw, labels] = await Promise.all([
    sanityFetch<RawLogement[]>(LOGEMENTS_QUERY, {}, ["logement", "avis", "lieu"]),
    apartmentLabels(),
  ]);
  return requireData(raw, "logements").map((r) => toApartment(r, labels));
});

export async function getApartment(slug: string): Promise<Apartment | undefined> {
  return (await getApartments()).find((a) => a.slug === slug);
}

/* ---------- Destinations ---------- */

export interface DestinationContent {
  id: DestinationId;
  updatedAt: string;
  /** Nom propre (fil d'Ariane, « Découvrir … », titre de l'intro). */
  label: string;
  placeName: string;
  region: string;
  kicker: string;
  title: string;
  subtitle: string;
  heroAlt: string;
  intro: string[];
  touristType: string[];
  faq: { q: string; a: string }[];
  metaTitle: string;
  metaDescription: string;
  /** Slugs des logements, dans l'ordre choisi. */
  homes: string[];
  places: MapPoint[];
}

const rawDestinations = cache(() =>
  sanityFetch<RawDestination[]>(DESTINATIONS_QUERY, {}, ["destination", "logement", "lieu"]),
);

/** Le contenu d'une page destination dans une langue. */
export async function getDestination(
  id: DestinationId,
  locale: Locale,
): Promise<DestinationContent> {
  const raw = requireData(
    (await rawDestinations()).find((d) => d.slug === id),
    `destination « ${id} »`,
  );
  return {
    id,
    updatedAt: raw._updatedAt,
    label: raw.nom,
    placeName: raw.lieuSchema ?? raw.nom,
    region: raw.region ?? "",
    kicker: localise(raw, "surtitre", locale),
    title: localise(raw, "titre", locale),
    subtitle: localise(raw, "sousTitre", locale),
    heroAlt: localise(raw, "heroAlt", locale),
    intro: splitParagraphs(localise(raw, "intro", locale)),
    touristType: (raw.typesVoyageurs ?? []).map((t) => localise(t, "typeVoyageur", locale)),
    faq: (raw.faq ?? []).map((f) => ({
      q: localise(f, "question", locale),
      a: localise(f, "reponse", locale),
    })),
    metaTitle: localise(raw.seo, "title", locale),
    metaDescription: localise(raw.seo, "description", locale),
    homes: raw.logements ?? [],
    places: (raw.lieux ?? [])
      .filter(Boolean)
      .map((p) => ({ label: p.nom, query: p.requeteMaps })),
  };
}

/** Nom et date de mise à jour de chaque destination (liens, sitemap). */
export async function getDestinationSummaries(): Promise<
  { id: DestinationId; label: string; updatedAt: string }[]
> {
  return requireData(await rawDestinations(), "destinations").map((d) => ({
    id: d.slug,
    label: d.nom,
    updatedAt: d._updatedAt,
  }));
}

/* ---------- Site ---------- */

export interface SiteContent {
  updatedAt: string;
  email: string;
  /** Présent seulement si « Afficher le téléphone » est coché. */
  phone?: string;
  /** Profils officiels ; vides tant que non renseignés (jamais un placeholder). */
  instagram?: string;
  facebook?: string;
  baseline: Localized;
  host: { name: string; body: LocalizedList; photo?: string };
  seo: { title: Localized; description: Localized };
  legal: { key?: string; title: Localized; body: LocalizedList }[];
}

export const getSite = cache(async (): Promise<SiteContent> => {
  const raw = requireData(await sanityFetch<RawSite>(SITE_QUERY, {}, ["site"]), "document site");
  const url = (u?: string) => (u && /^https:\/\/\S+$/.test(u) ? u : undefined);
  return {
    updatedAt: raw._updatedAt,
    email: requireData(raw.contact?.email, "e-mail de contact"),
    // Le numéro n'est publié que si Gwenaëlle l'a décidé (case du Studio).
    phone: (raw.contact?.afficherTelephone && raw.contact.telephone?.trim()) || undefined,
    instagram: url(raw.reseaux?.instagram),
    facebook: url(raw.reseaux?.facebook),
    baseline: all(raw, "baseline"),
    host: {
      name: raw.hotesse?.nom ?? "",
      body: allParagraphs(raw.hotesse, "texte"),
      photo: raw.hotesse?.photo?.url,
    },
    seo: { title: all(raw.seo, "title"), description: all(raw.seo, "description") },
    legal: (raw.mentionsLegales ?? []).map((s) => ({
      key: s.cle || undefined,
      title: all(s, "titre"),
      body: allParagraphs(s, "paragraphes"),
    })),
  };
});

/* ---------- Assistante ---------- */

export const getAssistante = cache(async (): Promise<RawAssistante> =>
  requireData(
    await sanityFetch<RawAssistante>(ASSISTANTE_QUERY, {}, ["assistante"]),
    "document assistante",
  ),
);
