import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import JsonLd from "@/components/JsonLd";
import Ornament from "@/components/Ornament";
import { baseGraph, graph } from "@/lib/jsonld";
import { routing, type Locale } from "@/i18n/routing";
import { apartments, pick } from "@/lib/appartements";
import { DEFAULT_OG_IMAGE, buildPageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

/* ------------------------------------------------------------------
   Mentions légales — textes dans messages/<locale>.json (namespace `legal`),
   français source + 5 traductions.

   TODO (avant mise en ligne) — informations à obtenir de Gwenaëlle :
   - Éditeur : nom de famille, forme juridique (micro-entreprise, SCI, LMNP…),
     SIRET et adresse postale. En attendant, le texte rendu reste neutre :
     « Ce site est édité par Gwenaëlle, Les P'tites Barques ».
   - Adresse e-mail de contact réelle (placeholder aussi dans lib/site.ts).
   - Crédits photo : photographe des séries « -pro ». (La vue aérienne est
     créditée « dinardbyair » directement sous le visuel, section L'histoire
     de l'accueil — pas ici, pour ne pas la créditer deux fois.)

   La section `rentals` n'a pas de liste en dur : les numéros d'enregistrement
   sont lus dans les données des logements (lib/appartements.ts, fact
   « N° d'enregistrement »). Un logement sans numéro n'a pas de ligne.
   TODO n° d'enregistrement de L'Antillaise (Deshaies, Guadeloupe) : à ajouter
   dans ses `facts` — la ligne apparaîtra ici automatiquement.
   ------------------------------------------------------------------ */

interface LegalSection {
  /** `rentals` : la liste des numéros d'enregistrement suit le texte. */
  id?: string;
  title: string;
  body: string[];
}

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
  const sections = t.raw("sections") as LegalSection[];
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
          baseGraph(loc, [
            [site.name, "/"],
            [t("title"), "/mentions-legales"],
          ]),
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
