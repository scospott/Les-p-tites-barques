import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import JsonLd from "@/components/JsonLd";
import Ornament from "@/components/Ornament";
import { baseGraph, graph } from "@/lib/jsonld";
import { routing, type Locale } from "@/i18n/routing";
import { pick } from "@/lib/appartements";
import { getApartments, getSite } from "@/sanity/adapters";
import { DEFAULT_OG_IMAGE, buildPageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

/* ------------------------------------------------------------------
   Mentions légales — le TEXTE vient de Sanity (Site › Mentions légales,
   six langues) ; seuls le surtitre, le titre, la meta description et le
   gabarit de ligne « {nom} : n° {numéro} » restent des libellés
   d'interface (messages/, namespace `legal`).

   La section de clé `rentals` est suivie de la liste des n°
   d'enregistrement, lus dans les fiches logement (Sanity) : un logement
   sans numéro n'a pas de ligne.

   TODO (avant mise en ligne) — à renseigner dans le Studio :
   - adresse e-mail de contact définitive (Site › Contact, et le texte des
     sections Éditeur / Données personnelles) ;
   - photographe des photos des logements (section Crédits photo) ;
   - n° d'enregistrement de L'Antillaise (fiche Guadeloupe › Administratif).
   ------------------------------------------------------------------ */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const loc = (hasLocale(routing.locales, locale) ? locale : "fr") as Locale;
  const t = await getTranslations({ locale: loc, namespace: "legal" });
  return buildPageMetadata({
    locale: loc,
    path: "/mentions-legales",
    title: `${t("title")} · ${site.name}`,
    description: t("metaDescription"),
    image: { ...DEFAULT_OG_IMAGE, alt: site.name },
  });
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const loc = (hasLocale(routing.locales, locale) ? locale : "fr") as Locale;

  const t = await getTranslations({ locale: loc, namespace: "legal" });
  const [content, apartments] = await Promise.all([getSite(), getApartments()]);
  const sections = content.legal.map((s) => ({
    id: s.key,
    title: s.title[loc],
    body: s.body[loc],
  }));
  const registrations = apartments
    .filter((a) => a.registration)
    .map((a) => ({
      slug: a.slug,
      name: pick(a.name, loc),
      number: a.registration!,
    }));

  return (
    <section className="bg-paper">
      <JsonLd
        data={graph(
          baseGraph(
            loc,
            [
              [site.name, "/"],
              [t("title"), "/mentions-legales"],
            ],
            content,
          ),
        )}
      />
      <div className="shell pb-24 pt-32 sm:pb-32 sm:pt-40">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <p className="kicker justify-center">{t("kicker")}</p>
            <h1 className="section-title mt-4">{t("title")}</h1>
            <Ornament className="mt-5 justify-center" />
          </div>
          <div className="mt-14 space-y-12">
            {sections.map((s, i) => (
              <section key={i}>
                <h2 className="subtitle text-ink">
                  {s.title}
                </h2>
                <div className="mt-4 space-y-3">
                  {s.body.map((p, j) => (
                    <p
                      key={j}
                      className="text-body leading-relaxed text-ink-soft"
                    >
                      {p}
                    </p>
                  ))}
                  {s.id === "rentals" && (
                    <ul className="space-y-1.5 text-body leading-relaxed text-ink-soft">
                      {registrations.map((r) => (
                        <li key={r.slug}>
                          {t("rentalLine", { name: r.name, number: r.number })}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
