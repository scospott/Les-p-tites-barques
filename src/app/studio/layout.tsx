import type { Metadata, Viewport } from "next";

/* Le Studio est une application à part entière : il occupe tout l'écran, sans
   l'en-tête ni le pied de page du site, et hors du segment [locale] (son
   interface est déjà en français, cf. frFRLocale dans sanity.config.ts). */

export const metadata: Metadata = {
  title: "Back-office — Les P'tites Barques",
  // Le back-office n'a rien à faire dans un index de moteur de recherche.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Le Studio gère lui-même ses zones sûres et son zoom.
  viewportFit: "cover",
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
