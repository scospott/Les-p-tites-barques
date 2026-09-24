import type { Metadata } from "next";
import Image from "next/image";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import HeroWeld from "@/components/HeroWeld";
import AssistantCTA from "@/components/AssistantCTA";
import JsonLd from "@/components/JsonLd";
import { apartmentList, baseGraph, graph, gwenaelle } from "@/lib/jsonld";
import Ornament from "@/components/Ornament";
import Reveal from "@/components/Reveal";
import SafeImage from "@/components/SafeImage";
import ApartmentCard from "@/components/ApartmentCard";
import GlobeSelectorClient from "@/components/GlobeSelectorClient";
import type { Apartment } from "@/lib/appartements";
import { getApartments, getSite, splitParagraphs } from "@/sanity/adapters";
import { heroSequences } from "@/lib/heroSequences";
import { routing, type Locale } from "@/i18n/routing";
import { DEFAULT_OG_IMAGE, buildPageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

/** Portrait de l'hôtesse (375 × 500), servi depuis /public. */
const HOST_PHOTO = "/images/accueil/gwenaelle.jpg";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const loc = (hasLocale(routing.locales, locale) ? locale : "fr") as Locale;
  const t = await getTranslations({ locale: loc, namespace: "home.seo" });
  return buildPageMetadata({
    locale: loc,
    path: "/",
    title: t("title"),
    description: t("description"),
    image: { ...DEFAULT_OG_IMAGE, alt: site.name },
  });
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const loc = (hasLocale(routing.locales, locale) ? locale : "fr") as Locale;

  const t = await getTranslations({ locale: loc, namespace: "home" });
  const tm = await getTranslations({ locale: loc, namespace: "media" });
  const ta = await getTranslations({ locale: loc, namespace: "home.apartments" });

  const [apartments, content] = await Promise.all([getApartments(), getSite()]);
  // Textes validés de l'accueil : dans messages/ (plus dans Sanity).
  const host = { name: t("host.name"), photo: HOST_PHOTO };
  const hostBody = splitParagraphs(t("host.body"));
  const contact = content;

  const statusLabel = (a: Apartment) =>
    a.status === "partial"
      ? ta("tagNew")
      : a.status === "placeholder"
        ? ta("tagSoon")
        : undefined;

  return (
    <>
      <JsonLd
        data={graph([
          ...baseGraph(loc, [[site.name, "/"]], contact),
          apartmentList(apartments, loc),
          gwenaelle(loc, host),
        ])}
      />
      {/* Hero d'accueil soudé : scrub A (Saint-Malo) → crossfade → B (Guadeloupe) */}
      <HeroWeld
        dirA={heroSequences["accueil-a"].framesDir}
        dirMobileA={heroSequences["accueil-a"].framesDirMobile}
        countA={heroSequences["accueil-a"].frameCount}
        dirB={heroSequences["accueil-b"].framesDir}
        dirMobileB={heroSequences["accueil-b"].framesDirMobile}
        countB={heroSequences["accueil-b"].frameCount}
        posterA={heroSequences["accueil-a"].poster}
        posterMobileA={heroSequences["accueil-a"].posterMobile}
        posterAlt={tm("homeHeroAlt")}
        title={t("hero.title")}
        subtitleA={t("hero.subtitleA")}
        subtitleB={t("hero.subtitleB")}
      />

      {/* 2. Section globe — globe 3/4 à gauche, texte 1/4 à droite (empilé mobile).
          Rythme de section : eyebrow → titre (même échelle partout) →
          séparateur trait · point · trait → texte. */}
      <section id="contenu" className="bg-paper">
        <div className="shell-wide py-20 sm:py-28">
          <div className="grid items-center gap-10 lg:grid-cols-[1.9fr_1fr] lg:gap-14">
            <div>
              <GlobeSelectorClient
                hint={t("globe.hint")}
                backLabel={t("globe.back")}
                // Mobile : hauteur juste suffisante pour les deux cartes du
                // sélecteur, puis le grand cadre du globe à partir de sm.
                className="h-[28rem] w-full sm:h-[clamp(32rem,78vh,52rem)]"
              />
            </div>
            <Reveal stagger className="text-center">
              <p className="kicker justify-center">{t("globe.kicker")}</p>
              <h2 className="section-title mt-4">{t("globe.title")}</h2>
              <Ornament className="mt-5 justify-center" />
              <p className="lede mt-5 text-balance">{t("globe.body")}</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 3. L'histoire — section calme sur fond blanc : deux cartes photo côte
          à côte (empilées en mobile), sans titre de section — les cartes
          portent le leur. À gauche l'hôtesse (lagune), à droite l'assistante
          (vagues, cf. AssistantCTA). Hauteur minimale en CSS sur desktop (800 px,
          soit ~562 × 800 à 1180 px avec un gap de 56 px) : zéro CLS ; en mobile,
          la carte hôtesse prend sa hauteur naturelle. Un seul crédit : les deux vues aériennes sont du
          même photographe. */}
      <section id="histoire" className="bg-white py-[56px] min-[900px]:py-[96px]">
        <div className="mx-auto w-full max-w-[1220px] px-[20px]">
          {/* Espacements en px : la racine du site n'est pas à 16 px, les
              classes en rem (gap-10…) tomberaient à côté. */}
          <div className="grid gap-[24px] min-[900px]:grid-cols-2 min-[900px]:gap-[56px]">
            <article
              aria-labelledby="hote-title"
              className="relative flex flex-col overflow-hidden rounded-[22px] bg-ink shadow-[0_8px_32px_rgba(0,0,0,.08)] min-[900px]:min-h-[800px]"
            >
              <Image
                src="/images/accueil/lagune-vue-aerienne.jpg"
                alt={t("host.photoAlt")}
                fill
                sizes="(min-width: 900px) min(562px, calc(50vw - 48px)), calc(100vw - 40px)"
                className="object-cover object-center"
              />
              {/* Voile uniforme léger (teinte du footer) : la photo reste
                  turquoise et lumineuse. Le dégradé de lisibilité est une
                  bande sombre portée par le texte lui-même (cf. .story-text) :
                  il le suit où qu'il tombe. */}
              <div aria-hidden className="absolute inset-0 bg-ink/[.18]" />
              {/* Contenu centré verticalement : même espace au-dessus du
                  portrait et sous le texte. */}
              <div className="relative flex flex-1 flex-col items-center justify-center px-8 py-10 text-center min-[900px]:p-12">
                <div className="h-24 w-24 overflow-hidden rounded-full shadow-[0_4px_18px_rgba(28,26,24,.3)] ring-[3px] ring-white min-[900px]:h-[124px] min-[900px]:w-[124px]">
                  <SafeImage
                    src={host.photo}
                    alt={host.name}
                    sizes="124px"
                    className="h-full w-full"
                  />
                </div>
                <p className="kicker on-photo-kicker mt-6 justify-center text-[12px] text-white/85">
                  {t("host.kicker")}
                </p>
                <h2
                  id="hote-title"
                  className="section-title on-photo-title mt-3 text-[32px] text-white min-[900px]:text-[40px]"
                >
                  {host.name}
                </h2>
                <Ornament tone="photo" className="mt-4 justify-center" />
                {/* Texte de l'histoire directement sur la photo : ombre portée +
                    bande sombre centrée sur lui pour tenir 4,5:1. */}
                <div className="story-text mt-8 w-full max-w-[400px] text-left">
                  {hostBody.map((p, i) => (
                    <p
                      key={i}
                      className={`text-[16px] leading-[1.65] text-white ${i ? "mt-4" : ""}`}
                    >
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            </article>

            <AssistantCTA enabled={!!process.env.ANTHROPIC_API_KEY} />
          </div>
          <p className="mt-3 text-right text-[12px] text-ink-faint">
            {t("host.photoCredit")}
          </p>
        </div>
      </section>

      {/* 4. Les 4 logements — ordre du tableau `apartments` :
          Remparts Mer, Remparts Plage, Paramé, Guadeloupe. */}
      <section id="logements" className="bg-offwhite">
        <div className="shell-wide py-24 sm:py-32">
          <Reveal className="mx-auto max-w-3xl text-center">
            <p className="kicker justify-center">{ta("kicker")}</p>
            <h2 className="section-title mt-4">{ta("title")}</h2>
            <Ornament className="mt-5 justify-center" />
            <p className="lede mt-5 text-balance">{ta("subtitle")}</p>
          </Reveal>

          <div className="mt-16 grid gap-x-8 gap-y-16 sm:grid-cols-2 sm:mt-20">
            {apartments.map((a, i) => (
              <Reveal key={a.slug} className={i % 2 === 1 ? "sm:mt-24" : ""}>
                <ApartmentCard
                  apartment={a}
                  locale={loc}
                  statusLabel={statusLabel(a)}
                  discoverLabel={ta("discover")}
                />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

    </>
  );
}
