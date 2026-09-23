"use client";

import { useEffect } from "react";
import { usePathname } from "@/i18n/navigation";

import { armHeroPrefetch, warmHeroesForPath } from "@/lib/hero-prefetch";

/* ------------------------------------------------------------------
   Pilote du préchargement inter-pages des héros (cf. lib/hero-prefetch.ts).
   Monté une fois dans le layout : il note la page courante (et coupe tout
   préchargement à chaque navigation), puis transmet les intentions —
   survol ou focus d'un lien interne — qui seules déclenchent le
   réchauffage du héros de la page visée (desktop, après `load`).
   ------------------------------------------------------------------ */

export default function HeroPrefetcher() {
  // `usePathname` de next-intl : chemin SANS le préfixe de locale.
  const pathname = usePathname();

  useEffect(() => armHeroPrefetch(pathname), [pathname]);

  useEffect(() => {
    // Délégation sur le document : `pointerover` et `focusin` remontent
    // (contrairement à `pointerenter` / `focus`), un seul écouteur couvre
    // donc header, footer, cartes, modal de réservation et pins de la carte.
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
    document.addEventListener("focusin", onIntent);
    return () => {
      document.removeEventListener("pointerover", onIntent);
      document.removeEventListener("focusin", onIntent);
    };
  }, []);

  return null;
}
