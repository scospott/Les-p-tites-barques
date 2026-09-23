"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function LocaleNotFound() {
  const t = useTranslations("notFound");

  return (
    <section className="grid min-h-[70vh] place-items-center bg-paper px-6 pt-32">
      <div className="max-w-lg text-center">
        <p className="kicker justify-center">{t("kicker")}</p>
        <h1 className="section-title mt-4">{t("title")}</h1>
        <p className="lede mt-5">{t("body")}</p>
        <Link href="/" className="btn btn-primary mt-9">
          {t("cta")}
        </Link>
      </div>
    </section>
  );
}
