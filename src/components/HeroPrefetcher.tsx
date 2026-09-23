"use client";

import { useEffect } from "react";
import { usePathname } from "@/i18n/navigation";

import { armHeroPrefetch, warmHeroesForPath } from "@/lib/hero-prefetch";

/* ------------------------------------------------------------------
   Pilote du préchargement inter-pages des héros (cf. lib/hero-prefetch.ts).
   Monté une fois dans le layout : il arme le préchargement en temps mort
   pour la page courante, le coupe à chaque navigation, et réchauffe la
   première frame d'une page dès que le visiteur en survole un lien.
   ------------------------------------------------------------------ */

export default function HeroPrefetcher() {
  // `usePathname` de next-intl : chemin SANS le préfixe de locale.
  const pathname = usePathname();

  useEffect(() => armHeroPrefetch(pathname), [pathname]);

  useEffect(() => {
    // Délégation sur le document : `pointerover` bubble (contrairement à
    // `pointerenter`), un seul écouteur couvre donc header, footer, cartes,
    // modal de réservation et pins de la carte.
    const onIntent = (event: Event) => {
      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const raw = anchor.getAttribute("href");
      if (!raw || raw.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      warmHeroesForPath(url.pathname);
    };

    document.addEventListener("pointerover", onIntent, { passive: true });
    document.addEventListener("touchstart", onIntent, { passive: true });
    return () => {
      document.removeEventListener("pointerover", onIntent);
      document.removeEventListener("touchstart", onIntent);
    };
  }, []);

  return null;
}
