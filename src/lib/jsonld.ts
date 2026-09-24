import type { Locale } from "@/i18n/routing";
import { pick, type Apartment } from "./appartements";
import { LOCALE_TAGS } from "./locale";
import { urlFor } from "./seo";
import { site } from "./site";

/* ============================================================
   Données structurées schema.org — un seul <script type="application/ld+json">
   par page, sous forme de `@graph` (voir <JsonLd>).

   Socle commun à toutes les pages : Organization + WebSite + BreadcrumbList.
   Fiches logement : VacationRental (format Google « vacation rental »), avec
   la capacité / surface / équipements dans `containsPlace` (Accommodation).
   Accueil : ItemList des logements + Person (Gwenaëlle, section « L'histoire »).
   Pages destination : TouristDestination + ItemList + FAQPage.
   FAQ (destination et fiches) : FAQPage, questions/réponses VISIBLES
   dans l'accordéon de la page, mot pour mot.
   Avis : `aggregateRating` sur le VacationRental (note et nombre d'avis
   affichés dans la section Avis). Pas de nœuds `Review` : les avis
   n'ont ni note individuelle ni date dans les données — Google exige
   `reviewRating` et `datePublished`, et on n'invente rien.

   RÈGLE : ne rien inventer. Pas d'offre ni de prix ; les heures d'arrivée
   et de départ ne sont pas posées tant qu'elles n'existent pas dans les
   données ; les coordonnées sont celles du QUARTIER (`mapPin`), jamais
   l'adresse exacte.
   ============================================================ */

type Node = Record<string, unknown>;

const abs = (path: string) => (path.startsWith("http") ? path : `${site.url}${path}`);

const ORG_ID = `${site.url}/#organization`;
const WEBSITE_ID = `${site.url}/#website`;
const PERSON_ID = `${site.url}/#gwenaelle`;

const JOB_TITLE: Record<Locale, string> = {
  fr: "Hôte",
  en: "Host",
  de: "Gastgeberin",
  nl: "Gastvrouw",
  es: "Anfitriona",
  zh: "房东",
};

export function graph(nodes: Node[]): Node {
  return { "@context": "https://schema.org", "@graph": nodes };
}

export function organization(locale: Locale): Node {
  const sameAs = [site.instagram, site.facebook].filter(Boolean);
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: site.name,
    url: urlFor(locale, "/"),
    logo: {
      "@type": "ImageObject",
      url: abs("/images/logo/logo.png"),
    },
    ...(sameAs.length ? { sameAs } : {}),
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: site.email,
      availableLanguage: ["fr", "en", "de", "nl", "es", "zh"],
    },
  };
}

export function website(locale: Locale): Node {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: site.name,
    url: urlFor(locale, "/"),
    inLanguage: LOCALE_TAGS[locale],
    publisher: { "@id": ORG_ID },
  };
}

/** Fil d'Ariane : [libellé, chemin] du plus général au plus précis. */
export function breadcrumb(locale: Locale, items: [string, string][]): Node {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: urlFor(locale, path),
    })),
  };
}

/** Socle commun : Organization + WebSite + BreadcrumbList. */
export function baseGraph(locale: Locale, crumbs: [string, string][]): Node[] {
  return [organization(locale), website(locale), breadcrumb(locale, crumbs)];
}

/** « 2 voyageurs · 1 chambre · … » → nombre de chambres (studio = 1 pièce). */
function bedrooms(apt: Apartment): number | undefined {
  const part = pick(apt.capacity ?? apt.name, "fr").split("·")[1]?.trim();
  if (!part) return undefined;
  if (/studio/i.test(part)) return 1;
  const n = parseInt(part, 10);
  return Number.isFinite(n) ? n : undefined;
}

/** « 43 m² » → 43. */
function floorSize(apt: Apartment): number | undefined {
  const n = parseFloat((apt.surface ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

/** Ville et pays depuis l'adresse (« …, 35400 Saint-Malo, France »). */
function postalAddress(apt: Apartment): Node | undefined {
  if (!apt.address) return undefined;
  const parts = apt.address.split(",").map((s) => s.trim());
  const cityPart = parts.find((p) => /^\d{5}\s/.test(p));
  const [postalCode, ...city] = cityPart ? cityPart.split(/\s+/) : [];
  const street = parts[0];
  return {
    "@type": "PostalAddress",
    streetAddress: street,
    ...(postalCode ? { postalCode, addressLocality: city.join(" ") } : {}),
    addressRegion: apt.region === "guadeloupe" ? "Guadeloupe" : "Bretagne",
    // La Guadeloupe est un département français : pays = FR.
    addressCountry: "FR",
  };
}

/**
 * Note agrégée — UNIQUEMENT quand la section Avis l'affiche (note + nombre
 * d'avis visibles sur la fiche, cf. <Avis>). Échelle 5 (Airbnb) ou 10.
 */
function aggregateRating(apt: Apartment): Node | undefined {
  if (typeof apt.rating !== "number" || !apt.reviewCount) return undefined;
  return {
    "@type": "AggregateRating",
    ratingValue: apt.rating,
    bestRating: apt.ratingScale ?? 5,
    worstRating: 1,
    reviewCount: apt.reviewCount,
  };
}

export function vacationRental(apt: Apartment, locale: Locale): Node {
  const url = urlFor(locale, `/appartements/${apt.slug}`);
  const address = postalAddress(apt);
  const rooms = bedrooms(apt);
  const size = floorSize(apt);
  const amenities = (apt.equipements ?? []).flatMap((c) => c.items);
  const city = (address?.addressLocality as string | undefined) ?? undefined;
  const rating = aggregateRating(apt);

  return {
    "@type": "VacationRental",
    "@id": `${url}#logement`,
    name: pick(apt.name, locale),
    description: apt.seo
      ? pick(apt.seo.description, locale)
      : pick(apt.tagline, locale),
    url,
    // Identifiant du bien : n° d'enregistrement du meublé s'il existe, sinon
    // l'identifiant interne (slug) — Google exige un identifiant stable.
    identifier: apt.registration ?? apt.slug,
    image: apt.gallery.slice(0, 5).map(abs),
    ...(address ? { address } : {}),
    ...(apt.mapPin
      ? {
          latitude: apt.mapPin.lat,
          longitude: apt.mapPin.lng,
          geo: {
            "@type": "GeoCoordinates",
            latitude: apt.mapPin.lat,
            longitude: apt.mapPin.lng,
          },
        }
      : {}),
    ...(city
      ? { containedInPlace: { "@type": "City", name: city } }
      : {}),
    brand: { "@id": ORG_ID },
    ...(rating ? { aggregateRating: rating } : {}),
    containsPlace: {
      "@type": "Accommodation",
      additionalType: "EntirePlace",
      ...(rooms ? { numberOfBedrooms: rooms, numberOfRooms: rooms } : {}),
      ...(apt.maxGuests
        ? {
            occupancy: {
              "@type": "QuantitativeValue",
              maxValue: apt.maxGuests,
            },
          }
        : {}),
      ...(size
        ? {
            floorSize: {
              "@type": "QuantitativeValue",
              value: size,
              unitCode: "MTK",
            },
          }
        : {}),
      ...(amenities.length
        ? {
            amenityFeature: amenities.map((name) => ({
              "@type": "LocationFeatureSpecification",
              name,
              value: true,
            })),
          }
        : {}),
    },
  };
}

/** FAQ — les paires question / réponse affichées dans l'accordéon. */
export function faqPage(
  items: { q: string; a: string }[],
  locale: Locale,
  path: string,
): Node {
  return {
    "@type": "FAQPage",
    "@id": `${urlFor(locale, path)}#faq`,
    inLanguage: LOCALE_TAGS[locale],
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

/** Destination touristique (pages /saint-malo et /guadeloupe). */
export function touristDestination({
  locale,
  path,
  name,
  region,
  description,
  touristType,
  geo,
  image,
}: {
  locale: Locale;
  path: string;
  name: string;
  region: string;
  description: string;
  touristType: string[];
  geo: { lat: number; lng: number };
  image: string;
}): Node {
  return {
    "@type": "TouristDestination",
    "@id": `${urlFor(locale, path)}#destination`,
    name,
    description,
    url: urlFor(locale, path),
    image: abs(image),
    geo: { "@type": "GeoCoordinates", latitude: geo.lat, longitude: geo.lng },
    // Guadeloupe : département et région d'outre-mer — pays = France.
    containedInPlace: {
      "@type": "AdministrativeArea",
      name: region,
      containedInPlace: { "@type": "Country", name: "France" },
    },
    touristType,
  };
}

export function apartmentList(apartments: Apartment[], locale: Locale): Node {
  return {
    "@type": "ItemList",
    itemListElement: apartments.map((a, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: pick(a.name, locale),
      url: urlFor(locale, `/appartements/${a.slug}`),
    })),
  };
}

export function gwenaelle(locale: Locale): Node {
  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: "Gwenaëlle",
    jobTitle: JOB_TITLE[locale],
    image: abs("/images/accueil/gwenaelle.jpg"),
    worksFor: { "@id": ORG_ID },
  };
}
