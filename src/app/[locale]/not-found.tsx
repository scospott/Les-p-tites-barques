"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import ApartmentCard from "@/components/ApartmentCard";
import Ornament from "@/components/Ornament";
import { apartments } from "@/lib/appartements";
import type { Locale } from "@/i18n/routing";

/* ------------------------------------------------------------------
   404 localisée — pas une impasse : retour à l'accueil de la langue
   courante, puis les quatre logements (mêmes cartes que l'accueil).
   Le statut HTTP 404 est posé par Next (notFound()).
   ------------------------------------------------------------------ */
export default function LocaleNotFound() {
  const t = useTranslations("notFound");
  const ta = useTranslations("home.apartments");
  const locale = useLocale() as Locale;

  return (
    <section className="bg-paper px-6 pb-24 pt-36 sm:pb-32">
      <div className="mx-auto max-w-lg text-center">
        <p className="kicker justify-center">{t("kicker")}</p>
        <h1 className="section-title mt-4">{t("title")}</h1>
        <p className="lede mt-5">{t("body")}</p>
        <Link href="/" className="btn btn-primary mt-9">
          {t("cta")}
        </Link>
      </div>

      <div className="shell-wide mt-20 sm:mt-24">
        <div className="text-center">
          <h2 className="subtitle text-ink">{t("homes")}</h2>
          <Ornament className="mt-4 justify-center" />
        </div>
        <div className="mt-10 grid gap-10 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4">
          {apartments.map((a) => (
            <ApartmentCard
              key={a.slug}
              apartment={a}
              locale={locale}
              discoverLabel={ta("discover")}
              sizes="(min-width:1024px) 22vw, (min-width:640px) 45vw, 100vw"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
