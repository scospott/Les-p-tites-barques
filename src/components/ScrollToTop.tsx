"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "@/i18n/navigation";
import { useLenisRef } from "@/components/LenisProvider";
import { scrollToAnchor, takePendingAnchor } from "@/lib/anchor-scroll";

/* ------------------------------------------------------------------
   Remise à zéro du scroll à chaque navigation interne.

   Pourquoi ce composant : Lenis tient sa PROPRE position de défilement et
   pilote le scroll de la page. La restauration de Next au changement de route
   ne la met pas à jour — on arrivait donc sur la nouvelle page avec la
   position de la précédente (clic sur une carte logement, un pin de la carte
   destination, une carte de la modal Réserver, un lien du footer…).
   On remet donc Lenis à 0 nous-mêmes, en `immediate` : pas d'animation de
   remontée, la page s'ouvre en haut.

   Deux exceptions, volontaires :
   - URL avec ancre (« /#logements », « /#histoire »…) : on ne touche à rien,
     le comportement d'ancre doit gagner.
   - Retour / avance navigateur (popstate) : on laisse la restauration native
     ramener le visiteur là où il était.
   Le tout premier rendu est également ignoré — au chargement d'une page la
   position est déjà bonne, et un rechargement doit garder la sienne.

   ANCRE EN ATTENTE (lib/anchor-scroll) : un <AnchorLink> cliqué depuis une
   autre page (« Les logements » sur une fiche logement) pose l'ancre puis
   navigue vers l'accueil SANS hash. On arrive donc en haut, et une fois la
   page posée (héros épinglés, polices) on GLISSE jusqu'à la section.
   ------------------------------------------------------------------ */

/** Délai avant le glissement : le temps que ScrollTrigger épingle les héros. */
const PENDING_ANCHOR_DELAY_MS = 160;

export default function ScrollToTop() {
  const pathname = usePathname();
  const lenisRef = useLenisRef();
  const mounted = useRef(false);
  const fromHistory = useRef(false);

  // Marque les navigations issues des boutons précédent / suivant : popstate
  // est émis avant que React ne re-rende avec le nouveau pathname, le drapeau
  // est donc posé à temps pour l'effet ci-dessous.
  useEffect(() => {
    const onPopState = () => {
      fromHistory.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (fromHistory.current) {
      fromHistory.current = false;
      return;
    }
    if (window.location.hash) return;

    const lenis = lenisRef?.current;
    if (lenis) lenis.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);

    const pending = takePendingAnchor();
    if (!pending) return;
    const timer = setTimeout(() => {
      if (scrollToAnchor(lenisRef?.current, pending)) {
        history.replaceState(null, "", pending);
      }
    }, PENDING_ANCHOR_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pathname, lenisRef]);

  return null;
}
