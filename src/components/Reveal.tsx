"use client";

import {
  useRef,
  type ComponentType,
  type ElementType,
  type ReactNode,
  type Ref,
} from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface RevealProps {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** Décalage vertical initial (px). */
  y?: number;
  /** Délai (s). */
  delay?: number;
  /** Anime les enfants directs en cascade plutôt que le bloc entier. */
  stagger?: boolean;
}

/**
 * Révélation douce au scroll (fade + translation). Respecte prefers-reduced-motion
 * (l'état final est forcé visible via CSS dans ce cas).
 */
export default function Reveal({
  children,
  as,
  className = "",
  y = 28,
  delay = 0,
  stagger = false,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  // `as` peut être un tag DOM ("div", "section"…) ou un composant.
  // Depuis l'ajout de @react-three/fiber, l'union globale `ElementType` est
  // polluée par les éléments three.js (membres `never` injectés dans
  // `JSX.IntrinsicElements` — R3F v9 + React 19), ce qui ferait s'effondrer le
  // typage de `<Tag>` en `never`. On caste vers un composant aux props minimales
  // pour isoler Reveal de ce conflit de types — aucun impact à l'exécution.
  const Tag = (as ?? "div") as unknown as ComponentType<{
    ref?: Ref<HTMLDivElement>;
    "data-reveal"?: boolean;
    className?: string;
    children?: ReactNode;
  }>;

  useGSAP(
    () => {
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const el = ref.current;
      if (reduce || !el) return;

      // En mode cascade, le conteneur doit redevenir visible immédiatement
      // (ce sont ses enfants qui s'animent un à un).
      const targets = stagger ? Array.from(el.children) : [el];
      if (stagger) gsap.set(el, { autoAlpha: 1 });

      gsap.fromTo(
        targets,
        { autoAlpha: 0, y },
        {
          autoAlpha: 1,
          y: 0,
          duration: 1,
          delay,
          ease: "power3.out",
          stagger: stagger ? 0.12 : 0,
          scrollTrigger: {
            trigger: el,
            start: "top 82%",
            once: true,
          },
        },
      );
    },
    { scope: ref },
  );

  return (
    <Tag ref={ref} data-reveal className={className}>
      {children}
    </Tag>
  );
}
