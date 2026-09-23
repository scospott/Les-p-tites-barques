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
import { apartments, type Apartment } from "@/lib/appartements";
import { heroSequences } from "@/lib/heroSequences";
import { routing, type Locale } from "@/i18n/routing";
import { DEFAULT_OG_IMAGE, buildPageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const loc = (hasLocale(routing.locales, locale) ? locale : "fr") as Locale;
  const t = await getTranslations({ locale: loc, namespace: "meta" });
  return buildPageMetadata({
    locale: loc,
    path: "/",
    title: t("home.title"),
    description: t("home.description"),
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

  const hostBody = t.raw("host.body") as string[];

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
          ...baseGraph(loc, [[site.name, "/"]]),
          apartmentList(apartments, loc),
          gwenaelle(loc),
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

      {/* 3. Section hôtesse — la vue aérienne est le fond de TOUTE la
          section ; surtitre, titre, portrait et texte sont posés dessus, en
          blanc cassé : voile général à 40 %, texte de l'histoire sur un
          panneau sombre (cf. .story-veil / .story-panel). Hauteur = contenu
          + paddings (min 70vh) : l'image suit en cover, rien ne bouge à son
          chargement. */}
      <section id="histoire" className="relative overflow-hidden bg-ink">
        <Image
          src="/images/accueil/barques-vue-aerienne.jpg"
          alt={t("host.photoAlt")}
          fill
          sizes="100vw"
          // Mobile : ancrage à 40 % pour garder l'eau turquoise ET le sable.
          className="z-0 object-cover object-[50%_40%] md:object-center"
        />
        <div aria-hidden className="story-veil absolute inset-0 z-0" />
        <div className="relative z-10 mx-auto flex min-h-[70vh] w-full max-w-[1100px] items-center px-6 py-20 sm:px-8 sm:py-28 lg:px-12">
          <div className="grid w-full items-center gap-10 md:grid-cols-2 md:gap-16">
            <Reveal stagger className="text-center">
              <p className="kicker justify-center text-[#F1ECE3]">
                {t("host.kicker")}
              </p>
              <h2 className="section-title mt-4 break-keep text-[#F1ECE3]">
                {t("host.title")}
              </h2>
              <Ornament tone="dark" className="mt-5 justify-center" />
              <div className="mx-auto mt-8 h-52 w-52 overflow-hidden rounded-full border border-[#F1ECE3]/40 bg-offwhite sm:h-64 sm:w-64 lg:h-72 lg:w-72">
                <SafeImage
                  src="/images/accueil/gwenaelle.jpg"
                  alt={t("host.title")}
                  className="h-full w-full"
                />
              </div>
            </Reveal>
            {/* Texte sur panneau sombre (60 %) : lisibilité AA mesurée sans
                noyer toute la photo sous un voile trop dense. */}
            <Reveal
              stagger
              className="story-text story-panel mx-auto max-w-xl rounded-[22px] px-6 py-8 text-center sm:px-9 sm:py-10 md:text-left"
            >
              {hostBody.map((p, i) => (
                <p
                  key={i}
                  className={`lede text-balance text-[#F1ECE3] ${i ? "mt-5" : ""}`}
                >
                  {p}
                </p>
              ))}
              <p className="kicker mt-7 justify-center text-[#F1ECE3] md:justify-start">
                {t("host.languages")}
              </p>
            </Reveal>
          </div>
        </div>
        <p className="absolute bottom-3 right-4 z-10 text-[0.75rem] text-[#F1ECE3] sm:right-6">
          {t("host.photoCredit")}
        </p>
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

      {/* 5. Assistant — chat inline, dernière section avant le footer */}
      <AssistantCTA enabled={!!process.env.ANTHROPIC_API_KEY} />
    </>
  );
}
