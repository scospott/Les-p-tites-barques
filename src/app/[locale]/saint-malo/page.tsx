import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";

import DestinationPageView, {
  destinationMetadata,
} from "@/components/DestinationPageView";
import { routing, type Locale } from "@/i18n/routing";

// Page destination (SEO local) — gabarit commun : components/DestinationPageView.
const ID = "saint-malo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const loc = (hasLocale(routing.locales, locale) ? locale : "fr") as Locale;
  return destinationMetadata(ID, loc);
}

export default async function DestinationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const loc = (hasLocale(routing.locales, locale) ? locale : "fr") as Locale;
  return <DestinationPageView id={ID} locale={loc} />;
}
