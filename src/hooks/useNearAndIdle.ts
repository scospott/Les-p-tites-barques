"use client";

import { useEffect, useState, type RefObject } from "react";

/* ============================================================
   useNearAndIdle — feu vert pour monter un composant LOURD (three.js :
   globe de l'accueil, galerie 3D des fiches).

   Trois conditions, toutes requises :
   1. la page a fini de charger (`load`) — donc jamais avant le LCP ;
   2. le fil principal est libre (`requestIdleCallback`) ;
   3. l'emplacement approche du viewport (IntersectionObserver, avec une
      marge : le composant a le temps d'arriver avant d'être vu).

   Sans ça, l'évaluation de three.js et les premiers rendus WebGL tombaient
   pendant le chargement : sur le desktop de PageSpeed (WebGL logiciel),
   ~1,2 s de tâches longues sur l'accueil pour un globe situé quatre écrans
   plus bas.
   ============================================================ */

/** Page chargée ET fil libre : une seule fois par page, partagé. */
let idlePromise: Promise<void> | null = null;
function afterLoadAndIdle(): Promise<void> {
  if (idlePromise) return idlePromise;
  idlePromise = new Promise<void>((resolve) => {
    const idle = () =>
      "requestIdleCallback" in window
        ? window.requestIdleCallback(() => resolve(), { timeout: 2000 })
        : setTimeout(resolve, 200);
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
  });
  return idlePromise;
}

export function useNearAndIdle(
  ref: RefObject<Element | null>,
  { rootMargin = "100% 0px", enabled = true }: { rootMargin?: string; enabled?: boolean } = {},
): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!enabled || ready || !el) return;
    let cancelled = false;
    let io: IntersectionObserver | undefined;
    afterLoadAndIdle().then(() => {
      if (cancelled) return;
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            io?.disconnect();
            setReady(true);
          }
        },
        { rootMargin },
      );
      io.observe(el);
    });
    return () => {
      cancelled = true;
      io?.disconnect();
    };
  }, [ref, rootMargin, enabled, ready]);

  return ready;
}
