import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import Hero from "@/components/Hero";
import Reveal from "@/components/Reveal";
import Ornament from "@/components/Ornament";
import ApartmentCard from "@/components/ApartmentCard";
import Breadcrumbs from "@/components/Breadcrumbs";
import Faq from "@/components/Faq";
import DestinationBookingCTA from "@/components/DestinationBookingCTA";
import JsonLd from "@/components/JsonLd";
import type { Locale } from "@/i18n/routing";
import type { DestinationId } from "@/lib/destinations";
import { destinationConfig, destinationGeo } from "@/lib/destination-config";
import { destinations } from "@/lib/destinations";
import { getApartments, getDestination, getSite } from "@/sanity/adapters";
import {
  apartmentList,
  baseGraph,
  faqPage,
  graph,
  touristDestination,
} from "@/lib/jsonld";
import { buildPageMetadata } from "@/lib/seo";

/* ------------------------------------------------------------------
   Page destination — gabarit commun à /saint-malo et /guadeloupe :
   HÉROS (photo Ken Burns, H1) → FIL D'ARIANE + INTRO → LOGEMENTS (cartes
   de l'accueil) → ALENTOURS (lieux des itinéraires des fiches) → FAQ
   (accordéon) → CTA RÉSERVATION.
   JSON-LD : socle + TouristDestination + ItemList + FAQPage.
   ------------------------------------------------------------------ */

export async function destinationMetadata(
  id: DestinationId,
  locale: Locale,
): Promise<Metadata> {
  const page = destinationConfig[id];
  const d = await getDestination(id, locale);
  return buildPageMetadata({
    locale,
    path: page.path,
    title: d.metaTitle,
    description: d.metaDescription,
    image: { url: page.ogImage, width: 1200, height: 630, alt: d.heroAlt },
  });
}

/** Lien de recherche Google Maps d'un lieu (sans clé d'API). */
const mapsSearch = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

export default async function DestinationPageView({
  id,
  locale,
}: {
  id: DestinationId;
  locale: Locale;
}) {
  const page = destinationConfig[id];
  const [d, allApartments, content] = await Promise.all([
    getDestination(id, locale),
    getApartments(),
    getSite(),
  ]);
  const tc = await getTranslations({ locale, namespace: "destination.common" });
  const tn = await getTranslations({ locale, namespace: "nav" });
  const ta = await getTranslations({ locale, namespace: "apartment" });

  const { intro, faq, places } = d;
  // Logements dans l'ordre choisi dans le Studio (document destination).
  const homes = d.homes
    .map((slug) => allApartments.find((a) => a.slug === slug))
    .filter((a) => a !== undefined);
  const crumbs: [string, string][] = [
    [tn("home"), "/"],
    [d.label, page.path],
  ];

  return (
    <>
      <JsonLd
        data={graph([
          ...baseGraph(locale, crumbs, content),
          touristDestination({
            locale,
            path: page.path,
            name: d.placeName,
            region: d.region,
            description: d.metaDescription,
            touristType: d.touristType,
            geo: destinationGeo(id, homes, destinations[id]),
            image: page.heroImage,
          }),
          apartmentList(homes, locale),
          faqPage(faq, locale, page.path),
        ])}
      />

      <Hero
        variant="appartement"
        kicker={d.kicker}
        title={d.title}
        subtitle={d.subtitle}
        scrollLabel={ta("discover")}
        media={page.heroImage}
        mediaAlt={d.heroAlt}
        staticText
      />

      {/* INTRO — fil d'Ariane, puis le texte de la destination. */}
      <section id="contenu" className="bg-paper">
        <div className="shell py-20 sm:py-28">
          <Breadcrumbs items={crumbs} label={tn("breadcrumb")} />
          <Reveal className="mx-auto mt-12 max-w-[720px] text-center">
            <p className="kicker justify-center">{d.kicker}</p>
            <h2 className="section-title mt-4">{d.label}</h2>
            <Ornament className="mt-5 justify-center" />
            {intro.map((p, i) =>
              i === 0 ? (
                <p
                  key={i}
                  className="mt-9 font-display text-body italic leading-[1.6] text-balance text-ink"
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
          </Reveal>
        </div>
      </section>

      {/* LOGEMENTS — mêmes cartes que l'accueil. */}
      <section className="bg-offwhite">
        <div className="shell-wide py-20 sm:py-28">
          <Reveal className="text-center">
            <p className="kicker justify-center">{tc("homesKicker")}</p>
            <h2 className="section-title mt-4">{tc("homesTitle")}</h2>
            <Ornament className="mt-5 justify-center" />
          </Reveal>
          <div
            className={`mx-auto mt-12 grid gap-10 sm:gap-8 ${
              homes.length > 1 ? "sm:grid-cols-3" : "max-w-xl"
            }`}
          >
            {homes.map((a) => (
              <Reveal key={a.slug}>
                <ApartmentCard
                  apartment={a}
                  locale={locale}
                  discoverLabel={ta("discover")}
                  sizes={
                    homes.length > 1 ? "(min-width:640px) 30vw, 100vw" : "(min-width:640px) 576px, 100vw"
                  }
                />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ALENTOURS — les lieux des itinéraires des fiches (données
          `mapPoints`), en liens Google Maps. */}
      {places.length > 0 && (
        <section className="bg-paper">
          <div className="shell-wide py-20 text-center sm:py-28">
            <Reveal>
              <p className="kicker justify-center">{tc("placesKicker")}</p>
              <h2 className="section-title mt-4">{tc("placesTitle")}</h2>
              <Ornament className="mt-5 justify-center" />
              <p className="lede mx-auto mt-5 max-w-2xl text-balance">
                {tc("placesHint")}
              </p>
            </Reveal>
            <Reveal className="mt-10 flex flex-wrap justify-center gap-4">
              {places.map((p) => (
                <a
                  key={p.query}
                  href={mapsSearch(p.query)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={tc("openInMaps", { place: p.label })}
                  className="inline-flex items-center gap-2.5 rounded-full bg-white px-6 py-4 text-button font-medium text-ink shadow-[0_1px_3px_rgba(40,36,32,0.12),0_1px_2px_rgba(40,36,32,0.08)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_6px_16px_rgba(40,36,32,0.16),0_2px_6px_rgba(40,36,32,0.10)]"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#A8603C"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0"
                    aria-hidden="true"
                  >
                    <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {p.label}
                </a>
              ))}
            </Reveal>
          </div>
        </section>
      )}

      <Faq
        kicker={tc("faqKicker")}
        title={tc("faqTitle")}
        items={faq}
        className="bg-offwhite"
      />

      {/* CTA RÉSERVATION — la modal « Choisissez votre logement »,
          limitée aux logements de la destination. */}
      <section className="bg-paper">
        <div className="shell py-20 text-center sm:py-28">
          <Reveal>
            <p className="kicker justify-center">{tc("ctaKicker")}</p>
            <h2 className="section-title mt-4">{tc("ctaTitle")}</h2>
            <Ornament className="mt-5 justify-center" />
            <p className="lede mx-auto mt-5 max-w-xl text-balance">
              {tc("ctaBody")}
            </p>
            <DestinationBookingCTA label={tc("ctaButton")} region={id} />
          </Reveal>
        </div>
      </section>
    </>
  );
}
