import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";

import { routing, type Locale } from "@/i18n/routing";
import { fraunces, notoSerifSC } from "@/lib/fonts";
import { OG_LOCALES } from "@/lib/locale";
import { site } from "@/lib/site";
import { buildAlternates, urlFor } from "@/lib/seo";
import LenisProvider from "@/components/LenisProvider";
import ScrollToTop from "@/components/ScrollToTop";
import HeroPrefetcher from "@/components/HeroPrefetcher";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ChatWidget from "@/components/ChatWidget";

import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const loc = (hasLocale(routing.locales, locale) ? locale : "fr") as Locale;
  const t = await getTranslations({ locale: loc, namespace: "meta" });

  return {
    metadataBase: new URL(site.url),
    title: {
      default: t("home.title"),
      template: `%s — ${site.name}`,
    },
    description: t("home.description"),
    applicationName: site.name,
    robots: site.indexing
      ? { index: true, follow: true }
      : { index: false, follow: false },
    alternates: buildAlternates(loc, "/"),
    icons: {
      icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
      shortcut: "/favicon.svg",
      apple: "/apple-touch-icon.png",
    },
    openGraph: {
      type: "website",
      siteName: site.name,
      title: t("home.title"),
      description: t("home.description"),
      url: urlFor(loc, "/"),
      locale: OG_LOCALES[loc],
      alternateLocale: routing.locales
        .filter((l) => l !== loc)
        .map((l) => OG_LOCALES[l]),
      images: [
        {
          url: "/og.png",
          width: 1200,
          height: 630,
          type: "image/png",
          alt: site.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("home.title"),
      description: t("home.description"),
      images: ["/og.png"],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "nav" });

  // Une seule famille (Fraunces). La serif chinoise n'est posée que sur /zh :
  // sa variable n'existe pas ailleurs, donc ses fichiers ne sont jamais
  // téléchargés par les autres locales.
  const fontClass =
    locale === "zh"
      ? `${fraunces.variable} ${notoSerifSC.variable}`
      : fraunces.variable;

  return (
    <html lang={locale} className={fontClass}>
      <body className="min-h-screen bg-paper antialiased">
        <NextIntlClientProvider>
          <LenisProvider>
            {/* Doit vivre SOUS LenisProvider : il pilote l'instance Lenis. */}
            <ScrollToTop />
            {/* Précharge les héros des autres pages en temps mort. */}
            <HeroPrefetcher />
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-ink focus:px-5 focus:py-2.5 focus:text-body focus:text-paper"
            >
              {t("skip")}
            </a>
            <Header />
            <main id="main" tabIndex={-1} className="focus-visible:outline-none">
              {children}
            </main>
            <Footer />
            <ChatWidget enabled={!!process.env.ANTHROPIC_API_KEY} />
          </LenisProvider>
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
