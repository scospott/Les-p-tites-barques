import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import Ornament from "@/components/Ornament";
import { routing, type Locale } from "@/i18n/routing";
import { buildAlternates } from "@/lib/seo";

// À COMPLÉTER avec les vraies infos légales de Gwenaëlle : ce site est une
// DÉMO — éditeur, adresse, SIRET et directeur de publication sont des
// placeholders [ENTRE CROCHETS] dans messages/{fr,en}.json (namespace `legal`)
// et doivent être renseignés avant toute mise en ligne commerciale.

interface LegalSection {
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
  return {
    title: t("title"),
    alternates: buildAlternates(loc, "/mentions-legales"),
  };
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

  return (
    <section className="bg-paper">
      <div className="shell pb-24 pt-32 sm:pb-32 sm:pt-40">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <p className="kicker justify-center">{t("kicker")}</p>
            <h1 className="section-title mt-4">{t("title")}</h1>
            <Ornament className="mt-5 justify-center" />
          </div>
          {/* Bandeau démo — rappel visible que ces mentions sont à compléter */}
          <p className="mt-8 rounded-[10px] border border-dashed border-sand/60 bg-offwhite/70 px-5 py-4 text-body italic text-ink-soft">
            {t("demoNote")}
          </p>

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
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
