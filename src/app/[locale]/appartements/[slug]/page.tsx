import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import Hero from "@/components/Hero";
import ScrollHero from "@/components/ScrollHero";
import Equipements from "@/components/Equipements";
import Avis from "@/components/Avis";
import Alentours from "@/components/Alentours";
import Reveal from "@/components/Reveal";
import SafeImage from "@/components/SafeImage";
import Gallery3D from "@/components/Gallery3DLazy";
import BookingBlock from "@/components/BookingBlock";
import Ornament from "@/components/Ornament";
import AnchorLink from "@/components/AnchorLink";
import {
  apartmentSlugs,
  getApartment,
  pick,
} from "@/lib/appartements";
import { routing, type Locale } from "@/i18n/routing";
import { buildAlternates, urlFor } from "@/lib/seo";
import { site } from "@/lib/site";
import { heroSequences } from "@/lib/heroSequences";

export function generateStaticParams() {
  return apartmentSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const apt = getApartment(slug);
  if (!apt) return {};
  const loc = (hasLocale(routing.locales, locale) ? locale : "fr") as Locale;

  const name = pick(apt.name, loc);
  const locality = pick(apt.locality, loc);
  const description = `${pick(apt.tagline, loc)} — ${locality}.`;
  const path = `/appartements/${slug}`;

  return {
    title: name,
    description,
    alternates: buildAlternates(loc, path),
    openGraph: {
      title: `${name} — ${site.name}`,
      description,
      url: urlFor(loc, path),
      images: [
        { url: "/og.png", width: 1200, height: 630, type: "image/png", alt: name },
      ],
    },
  };
}

/* ------------------------------------------------------------------
   Capacité en badges — « 4 voyageurs · 1 chambre · 3 lits · 1 sdb » était
   une ligne grise qu'on ne lisait pas. On la découpe sur les « · » et on
   pose un picto par segment (voyageurs / chambres / lits / salles de bain,
   dans cet ordre — le format est le même sur les 4 fiches), puis la surface
   en 5e chip. Un segment en trop retombe sur un picto neutre plutôt que de
   casser l'affichage.
   ------------------------------------------------------------------ */
const CAPACITY_ICONS = [
  // Voyageurs
  <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>,
  // Chambres
  <>
    <path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14" />
    <path d="M2 20h20" />
    <path d="M14 12v.01" />
  </>,
  // Lits
  <>
    <path d="M2 4v16" />
    <path d="M2 8h18a2 2 0 0 1 2 2v10" />
    <path d="M2 17h20" />
    <path d="M6 8v9" />
  </>,
  // Salles de bain — même goutte que la catégorie « Salle de bain »
  <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7z" />,
  // Surface — mètre de couturière (lucide « Ruler »), même trait que les autres
  <>
    <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" />
    <path d="m14.5 12.5 2-2" />
    <path d="m11.5 9.5 2-2" />
    <path d="m8.5 6.5 2-2" />
    <path d="m17.5 15.5 2-2" />
  </>,
];

const CAPACITY_ICON_FALLBACK = (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </>
);

function CapacityBadges({
  capacity,
  surface,
}: {
  capacity: string | null;
  surface?: string;
}) {
  const parts = (capacity ?? "")
    .split("·")
    .map((s) => s.trim())
    .filter(Boolean);
  // La surface ferme la série — les 4 fiches ont bien 4 segments de capacité,
  // donc elle tombe toujours sur le 5e picto (le mètre).
  if (surface) parts.push(surface);
  if (!parts.length) return null;

  return (
    <ul className="mt-7 flex flex-wrap justify-center gap-2.5">
      {parts.map((part, i) => (
        <li
          key={i}
          className="inline-flex items-center gap-2.5 rounded-full border-[0.5px] border-line bg-offwhite/70 px-4 py-2.5 text-body text-ink"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-kaki"
            aria-hidden="true"
          >
            {CAPACITY_ICONS[i] ?? CAPACITY_ICON_FALLBACK}
          </svg>
          {part}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------
   Textes du corps de page (déjà résolus dans la locale courante).
   ------------------------------------------------------------------ */
interface BodyTexts {
  backToAll: string;
  hostRating: string;
  kicker: string;
  description: string;
  toFillTitle: string;
  toFill: string;
  marker: string;
  signature: string;
  registration: string;
}

/**
 * Corps « À propos / Le logement » — une seule colonne centrée sur toute la
 * largeur : eyebrow → titre → séparateur → chips → description → mention
 * légale. Les valeurs arrivent déjà résolues dans la locale courante.
 *
 * Le tableau d'infos clés qui occupait la colonne de droite a été retiré :
 * ses lignes (plage, emplacement, stationnement, type, wifi…) vivent
 * toujours dans `facts`, qui alimente la base de connaissance de
 * l'assistante — elles ne sont simplement plus dupliquées à l'écran.
 */
function ApartmentBody({
  texts,
  ratingStr,
  capacity,
  surface,
  description,
  signature,
  registration,
}: {
  texts: BodyTexts;
  ratingStr: string | null;
  capacity: string | null;
  surface?: string;
  description: string[] | null;
  signature: string | null;
  registration?: string;
}) {
  return (
    <section id="contenu" className="bg-paper">
      <div className="shell py-20 sm:py-28">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <AnchorLink
            href="/#logements"
            className="link-underline inline-flex items-center gap-2 text-body text-ink-soft"
          >
            <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden="true">
              <path
                d="M18 5H1m4-4L1 5l4 4"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {texts.backToAll}
          </AnchorLink>
          {ratingStr && (
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl text-ink">{ratingStr}</span>
              <span className="kicker text-ink-faint">
                {texts.hostRating} · /10
              </span>
            </div>
          )}
        </div>

        {/* Colonne unique centrée — même rythme que toutes les sections :
            eyebrow → titre (échelle commune) → séparateur → contenu.
            Le conteneur est plus large que le texte pour que les 5 chips
            tiennent sur une ligne à 1440 px ; la description, elle, reste à
            ~720 px pour garder une longueur de ligne lisible. */}
        <Reveal className="mx-auto mt-12 w-full max-w-4xl text-center">
          <p className="kicker justify-center">{texts.kicker}</p>
          <h2 className="section-title mt-4">{texts.description}</h2>
          <Ornament className="mt-5 justify-center" />
          <CapacityBadges capacity={capacity} surface={surface} />
          {description ? (
            <div className="mx-auto mt-9 max-w-[720px]">
              {description.map((p, i) =>
                i === 0 ? (
                  /* Chapô — serif chaleureuse en italique, encre pleine :
                     la première phrase donne le ton de la maison. */
                  <p
                    key={i}
                    className="font-display text-body italic leading-[1.6] text-balance text-ink"
                    style={{
                      fontVariationSettings: '"opsz" 18, "SOFT" 100, "WONK" 0',
                    }}
                  >
                    {p}
                  </p>
                ) : (
                  <p key={i} className="lede mt-6 text-balance">
                    {p}
                  </p>
                ),
              )}
              {/* Détail signature — la petite chose dont on se souvient,
                  mise en exergue : filet kaki, picto, serif italique. */}
              {signature && (
                <div className="mx-auto mt-10 max-w-lg rounded-[16px] border-[0.5px] border-kaki/45 bg-offwhite/50 px-6 py-6 sm:px-8">
                  <p className="kicker inline-flex items-center gap-2.5 text-ink-faint">
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0 text-kaki"
                      aria-hidden="true"
                    >
                      <path d="M12 3.5 13.9 9l5.6.2-4.4 3.5 1.6 5.4L12 15l-4.7 3.1 1.6-5.4L4.5 9.2 10.1 9z" />
                    </svg>
                    {texts.signature}
                  </p>
                  <p className="mt-3 text-body italic leading-relaxed text-ink">
                    {signature}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="mx-auto mt-9 max-w-[720px] rounded-[3px] border border-dashed border-sand/60 bg-offwhite/70 p-8">
              <h3 className="subtitle text-ink">{texts.toFillTitle}</h3>
              <p className="lede mt-3">{texts.toFill}</p>
              <p className="kicker mt-5 text-ink-faint">{texts.marker}</p>
            </div>
          )}

          {/* Mention LÉGALE (meublé de tourisme) — discrète mais obligatoire.
              Masquée tant que le numéro n'est pas fourni. */}
          {registration && (
            <p className="kicker mt-10 justify-center text-ink-faint">
              {texts.registration} {registration}
            </p>
          )}
        </Reveal>
      </div>
    </section>
  );
}

/**
 * HERO 2 image (Ken Burns) pour les logements sans clip vidéo — même rôle que
 * le 2e ScrollHero d'un logement à héros scrub, sans titre. <SafeImage> →
 * placeholder élégant tant que la photo n'est pas déposée.
 *
 * `framing` n'est renseigné que pour les photos que le traitement par défaut
 * dessert (cf. `hero2Framing` dans lib/appartements.ts) : la hauteur de la
 * bande, elle, est commune aux 4 fiches et ne bouge pas.
 */
function ImageHeroBand({
  src,
  alt,
  framing,
}: {
  src?: string;
  alt: string;
  framing?: { position?: string; calmZoom?: boolean };
}) {
  return (
    <section className="relative flex h-[72svh] min-h-[26rem] w-full items-end overflow-hidden bg-ink">
      {/* Pas de z-index négatif ici : la <section> est `relative` sans
          z-index, donc elle ne crée PAS de contexte d'empilement — un enfant
          en -z-10 passerait derrière son propre fond `bg-ink` et la photo
          serait invisible (bande noire). Enfants positionnés en z-auto : ils
          se peignent dans l'ordre du DOM, photo puis voile. */}
      <div className="absolute inset-0 h-full w-full">
        <SafeImage
          src={src}
          alt={alt}
          tone="dark"
          sizes="100vw"
          className="h-full w-full"
          imgClassName={`ken-burns${framing?.calmZoom ? " ken-burns--calme" : ""}`}
          imgStyle={framing?.position ? { objectPosition: framing.position } : undefined}
        />
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(79, 74, 68,0.26) 0%, rgba(79, 74, 68,0.06) 45%, rgba(79, 74, 68,0.36) 100%)",
        }}
      />
    </section>
  );
}

export default async function ApartmentPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const loc = (hasLocale(routing.locales, locale) ? locale : "fr") as Locale;

  const apt = getApartment(slug);
  if (!apt) notFound();

  const t = await getTranslations({ locale: loc, namespace: "apartment" });

  const name = pick(apt.name, loc);
  const locality = pick(apt.locality, loc);
  const tagline = pick(apt.tagline, loc);
  const capacity = apt.capacity ? pick(apt.capacity, loc) : null;
  const description = apt.description ? pick(apt.description, loc) : null;
  const signature = apt.signature ? pick(apt.signature, loc) : null;
  const locationNote = apt.locationNote ? pick(apt.locationNote, loc) : null;

  // Données de l'architecture unifiée (héros / équipements / avis).
  const equipements = apt.equipements ?? null;
  const reviews = apt.reviews ?? [];
  const reviewBadge = apt.reviewBadge ? pick(apt.reviewBadge, loc) : null;
  // Les deux emplacements de héros sont indépendants. Les Remparts Mer et Les
  // Remparts Plage ont leurs 2 clips scrub ; Paramé n'en a qu'un (héros 2 en
  // Ken Burns image) ; la Guadeloupe est en Ken Burns sur les deux.
  const scrub1 = apt.scrubHeroes?.[0]
    ? heroSequences[apt.scrubHeroes[0]]
    : undefined;
  const scrub2 = apt.scrubHeroes?.[1]
    ? heroSequences[apt.scrubHeroes[1]]
    : undefined;
  // Héros image (Ken Burns) : photo dédiée si définie, sinon vitrine / 1re photo.
  const hero1Image = apt.hero1Image ?? apt.mainImage;
  const hero2Image = apt.hero2Image ?? apt.gallery[0];

  const bodyTexts: BodyTexts = {
    backToAll: t("backToAll"),
    hostRating: t("hostRating"),
    kicker: t("descriptionKicker"),
    description: t("description"),
    toFillTitle: t("toFillTitle"),
    toFill: t("toFill"),
    marker: t("marker"),
    signature: t("signature"),
    registration: t("registration"),
  };

  /* ================================================================
     TEMPLATE UNIFIÉ — toutes les pages logement (data-driven) :
     HERO 1 → DESCRIPTION → ÉQUIPEMENTS → HERO 2 → ALENTOURS → GALERIE
     → RÉSERVATION → AVIS.
     Chaque section suit le même rythme typographique : eyebrow → gros
     titre centré (même échelle partout) → séparateur → contenu.
     ================================================================ */
  return (
    <>
      {/* HERO 1 — scrub (si clip) ou Ken Burns image (`hero1Image`, sinon la
          vitrine). */}
      {scrub1 ? (
        <ScrollHero
          framesDir={scrub1.framesDir}
          framesDirMobile={scrub1.framesDirMobile}
          mobileIsCrop={scrub1.mobileIsCrop}
          frameCount={scrub1.frameCount}
          poster={scrub1.poster}
          fallbackVideo={scrub1.fallbackVideo}
          title={name}
          subtitle={apt.region === "guadeloupe" ? "Guadeloupe" : "Saint-Malo"}
          location={locality}
          scrollLabel={t("discover")}
        />
      ) : (
        <Hero
          variant="appartement"
          kicker={locality}
          title={name}
          subtitle={tagline}
          scrollLabel={t("discover")}
          media={hero1Image}
        />
      )}

      {/* À PROPOS / LE LOGEMENT — colonne unique centrée (capacité + surface
          en chips, description, mention légale). Juste après le Hero 1. */}
      <ApartmentBody
        texts={bodyTexts}
        ratingStr={null}
        capacity={capacity}
        surface={apt.surface}
        description={description}
        signature={signature}
        registration={apt.registration}
      />

      {/* ÉQUIPEMENTS (accordéon) — placeholder si non renseignés */}
      <Equipements
        categories={equipements}
        kicker={t("equipements.kicker")}
        title={t("equipements.title")}
        placeholder={t("equipements.placeholder")}
      />

      {/* HERO 2 (sans titre) — scrub quand le logement a un 2e clip.
          Sinon : HERO 2 = plan contemplatif fixe (choix DA) — Ken Burns lent
          (24 s, scale 1.06 → 1.18) sur `hero2Image`. */}
      {scrub2 ? (
        <ScrollHero
          framesDir={scrub2.framesDir}
          framesDirMobile={scrub2.framesDirMobile}
          mobileIsCrop={scrub2.mobileIsCrop}
          frameCount={scrub2.frameCount}
          poster={scrub2.poster}
          fallbackVideo={scrub2.fallbackVideo}
          title=""
          scrollLabel={t("discover")}
          // 2e séquence de la page : ses ~97 frames n'entrent en file qu'à
          // l'approche du viewport, pour ne pas concurrencer le héros 1.
          deferPreload
        />
      ) : (
        <ImageHeroBand src={hero2Image} alt={name} framing={apt.hero2Framing} />
      )}

      {/* ALENTOURS — itinéraires Google Maps + carte de l'adresse */}
      {apt.address && apt.mapPoints && apt.mapPoints.length > 0 && (
        <Alentours
          kicker={t("nearbyKicker")}
          title={t("nearby")}
          address={apt.address}
          points={apt.mapPoints}
          note={locationNote}
          openLabel={t("openInMaps")}
          walkLabel={t("onFoot")}
          driveLabel={t("byCar")}
        />
      )}

      {/* GALERIE — gros titre de section centré, puis le carrousel 3D
          (anneau fermé ; placeholders pour compléter l'anneau si la galerie
          est incomplète). */}
      <section className="relative bg-offwhite">
        <div className="py-20 sm:py-28">
          <Reveal className="shell text-center">
            <p className="kicker justify-center">{t("gallery")}</p>
            <h2 className="section-title mt-4">{t("galleryTitle")}</h2>
            <Ornament className="mt-5 justify-center" />
          </Reveal>
          <div className="mt-10">
            <Gallery3D
              images={apt.gallery}
              count={apt.gallerySlots}
              label={name}
            />
          </div>
        </div>
      </section>

      {/* RÉSERVATION — parcours de démonstration complet (dates → extras →
          coordonnées → confirmation), entièrement en state local, avec les
          tarifs PLACEHOLDER du logement (TODO tarifs réels à confirmer avec
          la cliente). Brancher Smoobu ici plus tard. */}
      <BookingBlock
        kicker={t("book.kicker")}
        title={t("book.title")}
        ctaLabel={t("book.title")}
        apartmentName={name}
        pricing={apt.pricing}
        rating={apt.rating}
        badge={reviewBadge}
        maxGuests={apt.maxGuests}
      />

      {/* AVIS */}
      {typeof apt.rating === "number" && (
        <Avis
          kicker={t("reviews.kicker")}
          title={t("reviews.title")}
          rating={apt.rating}
          ratingScale={apt.ratingScale}
          reviewCount={apt.reviewCount}
          countLabel={t("reviews.countLabel")}
          badge={reviewBadge}
          reviews={reviews}
          placeholder={t("reviews.placeholder")}
          locale={loc}
          prevLabel={t("reviews.prev")}
          nextLabel={t("reviews.next")}
        />
      )}
    </>
  );
}
