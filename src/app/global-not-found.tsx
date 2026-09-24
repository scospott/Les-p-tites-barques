import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import NotFoundContent from "@/components/NotFoundContent";
import SiteShell, { siteMetadata } from "@/components/SiteShell";

import "./globals.css";

/* ------------------------------------------------------------------
   404 de toute URL inconnue (experimental.globalNotFound, next.config).

   Pourquoi pas un catch-all [...rest] qui appelle notFound() : avec Next
   15.5, une 404 levée PENDANT le rendu d'une page sort en coquille
   d'erreur (`<html id="__next_error__">`), le contenu n'apparaissant
   qu'après l'hydratation. Une URL qui ne correspond à aucune route est,
   elle, rendue normalement côté serveur — ici, avec le même habillage
   que le site (SiteShell) : statut 404, titre, bouton et logements dans
   le HTML.

   Aucun layout ne s'applique : la langue vient de l'en-tête posé par le
   middleware next-intl (`/en/…` → en ; sans préfixe → fr).
   ------------------------------------------------------------------ */

export async function generateMetadata(): Promise<Metadata> {
  return siteMetadata((await getLocale()) as Locale);
}

export default async function GlobalNotFound() {
  const locale = (await getLocale()) as Locale;
  return (
    <SiteShell locale={locale}>
      <NotFoundContent />
    </SiteShell>
  );
}
