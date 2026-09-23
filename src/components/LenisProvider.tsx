"use client";

import { createContext, useContext, useEffect, useRef, type RefObject } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { scrollToAnchor } from "@/lib/anchor-scroll";

/**
 * Référence vers l'instance Lenis courante — `null` tant qu'elle n'est pas
 * créée, et pour toute la session en `prefers-reduced-motion` (Lenis n'est
 * alors jamais monté). On expose la REF (identité stable) plutôt que
 * l'instance : personne n'est re-rendu quand Lenis naît ou meurt.
 */
const LenisRefContext = createContext<RefObject<Lenis | null> | null>(null);

/** Donne accès à l'instance Lenis (ex. pour un scrollTo impératif). */
export function useLenisRef() {
  return useContext(LenisRefContext);
}

/**
 * Smooth scroll (Lenis) synchronisé avec le ticker GSAP et ScrollTrigger.
 * Désactivé si l'utilisateur préfère réduire les animations.
 */
export default function LenisProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return;

    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    lenis.on("scroll", ScrollTrigger.update);

    const update = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);

    // ScrollTrigger doit recalculer une fois la page peinte / les polices prêtes.
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh);

    // Ancres internes (#section : « Découvrir » du héros, « Réserver en
    // direct »…) : glissement doux via Lenis, décalage header (helper
    // partagé lib/anchor-scroll — même courbe que les liens de navigation).
    const onAnchorClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement)?.closest?.(
        'a[href^="#"]',
      ) as HTMLAnchorElement | null;
      if (!anchor) return;
      const hash = anchor.getAttribute("href");
      if (!hash || hash.length < 2) return;
      const target = document.querySelector<HTMLElement>(hash);
      if (!target) return;
      event.preventDefault();
      history.pushState(null, "", hash);
      scrollToAnchor(lenis, target);
      // Déplace le focus clavier vers la cible (utile pour le lien d'évitement) ;
      // sans casser le scroll fluide ni cibler les éléments non focusables.
      target.focus?.({ preventScroll: true });
    };
    document.addEventListener("click", onAnchorClick);

    return () => {
      gsap.ticker.remove(update);
      window.removeEventListener("load", refresh);
      document.removeEventListener("click", onAnchorClick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return (
    <LenisRefContext.Provider value={lenisRef}>
      {children}
    </LenisRefContext.Provider>
  );
}
