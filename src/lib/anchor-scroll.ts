import type Lenis from "lenis";

/* ------------------------------------------------------------------
   Glissement doux vers une ancre — un seul endroit pour la durée, la
   courbe et le décalage du header, partagé par :
   - les liens de navigation (Header, Footer, « Retour aux logements »)
     via <AnchorLink> ;
   - les ancres internes « #section » d'une page (LenisProvider) ;
   - l'arrivée sur l'accueil depuis une autre page (ScrollToTop lit
     l'ancre en attente et glisse une fois la page posée en haut).

   Lenis absent (prefers-reduced-motion : il n'est jamais monté) → saut
   direct, sans animation, au même décalage.
   ------------------------------------------------------------------ */

/** Hauteur du header fixe : la section s'arrête juste dessous. */
export const HEADER_OFFSET = -72;

/** ~1 s, courbe douce entrée/sortie (easeInOutCubic). */
export const ANCHOR_DURATION = 1.1;
export const anchorEase = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface ScrollOpts {
  offset?: number;
  duration?: number;
  /** Saut direct, sans animation. */
  immediate?: boolean;
}

/**
 * Glisse vers `target` (sélecteur « #id » ou élément). Renvoie false si la
 * cible n'existe pas dans la page — au lien de décider (navigation…).
 */
export function scrollToAnchor(
  lenis: Lenis | null | undefined,
  target: string | HTMLElement,
  opts: ScrollOpts = {},
): boolean {
  const el =
    typeof target === "string"
      ? document.querySelector<HTMLElement>(target)
      : target;
  if (!el) return false;

  const offset = opts.offset ?? HEADER_OFFSET;

  if (!lenis || opts.immediate || prefersReducedMotion()) {
    const top = el.getBoundingClientRect().top + window.scrollY + offset;
    if (lenis) lenis.scrollTo(top, { immediate: true });
    else window.scrollTo({ top, behavior: "auto" });
    return true;
  }

  lenis.scrollTo(el, {
    offset,
    duration: opts.duration ?? ANCHOR_DURATION,
    easing: anchorEase,
    onComplete: () => {
      // La mise en page a pu bouger pendant le glissement (héros épinglés
      // par ScrollTrigger, images qui se posent) : un court second
      // glissement rattrape l'écart, une seule fois.
      const drift = el.getBoundingClientRect().top + offset;
      if (Math.abs(drift) > 8) {
        lenis.scrollTo(el, { offset, duration: 0.5, easing: anchorEase });
      }
    },
  });
  return true;
}

/* ---- Ancre en attente d'une navigation vers une autre page ----
   <AnchorLink> la pose avant `router.push("/")` ; ScrollToTop la relève
   une fois sur la nouvelle page (posée en haut) et glisse jusqu'à elle. */
let pendingAnchor: string | null = null;

export function setPendingAnchor(hash: string) {
  pendingAnchor = hash;
}

export function takePendingAnchor(): string | null {
  const hash = pendingAnchor;
  pendingAnchor = null;
  return hash;
}
