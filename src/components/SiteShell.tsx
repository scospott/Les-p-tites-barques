import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import type { Locale } from "@/i18n/routing";
import { fraunces, notoSerifSC } from "@/lib/fonts";
import { OG_LOCALES } from "@/lib/locale";
import { site } from "@/lib/site";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";
import LenisProvider from "@/components/LenisProvider";
import ScrollToTop from "@/components/ScrollToTop";
import HeroPrefetcher from "@/components/HeroPrefetcher";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ApartmentsProvider } from "@/components/ApartmentsProvider";
import { toSummary } from "@/lib/appartements";
import { getApartments, getSite } from "@/sanity/adapters";
import ChatWidget from "@/components/ChatWidget";
import BookingContactModal from "@/components/BookingContactModal";

/* ------------------------------------------------------------------
   Habillage commun du site (document HTML, fournisseurs, header, footer,
   assistante…) et métadonnées par défaut. Partagé par le layout
   [locale] et la 404 globale (app/global-not-found.tsx), qui ne passe
   par aucun layout : les deux rendent exactement le même cadre.
   ------------------------------------------------------------------ */

/** Métadonnées par défaut d'une langue. */
export async function siteMetadata(loc: Locale): Promise<Metadata> {
  const seo = await getTranslations({ locale: loc, namespace: "home.seo" });

  // Valeurs par défaut communes. Chaque page publique fournit ensuite ses
  // propres title/description/canonical/Open Graph (buildPageMetadata) ; on
  // ne pose donc ici AUCUN canonical : une 404 ne doit pas pointer l'accueil.
  return {
    metadataBase: new URL(site.url),
    title: {
      default: seo("title"),
      template: `%s · ${site.name}`,
    },
    description: seo("description"),
    applicationName: site.name,
    robots: site.indexing
      ? { index: true, follow: true }
      : { index: false, follow: false },
    icons: {
      icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
      shortcut: "/favicon.svg",
      apple: "/apple-touch-icon.png",
    },
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: OG_LOCALES[loc],
      images: [{ ...DEFAULT_OG_IMAGE, alt: site.name }],
    },
  };
}

export default async function SiteShell({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const t = await getTranslations({ locale, namespace: "nav" });
  // Logements publiés (Sanity) : résumé transmis aux composants client
  // (fenêtre « Réserver », carte, assistante).
  const [apartments, siteContent] = await Promise.all([
    getApartments().then((list) => list.map(toSummary)),
    getSite(),
  ]);

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
          <ApartmentsProvider apartments={apartments}>
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
              {/* Fenêtre « la réservation en ligne arrive » (lib/booking.ts). */}
              <BookingContactModal email={siteContent.email} phone={siteContent.phone} />
            </LenisProvider>
          </ApartmentsProvider>
        </NextIntlClientProvider>
        <Analytics />
        {/* Core Web Vitals réels (terrain), remontés dans Vercel. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
