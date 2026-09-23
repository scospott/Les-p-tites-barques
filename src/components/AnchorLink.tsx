"use client";

import type { ComponentProps, MouseEvent } from "react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useLenisRef } from "@/components/LenisProvider";
import { scrollToAnchor, setPendingAnchor } from "@/lib/anchor-scroll";

/* ------------------------------------------------------------------
   Lien vers une ancre d'une page (« /#logements », « /#histoire »…) qui
   GLISSE au lieu de sauter :
   - déjà sur la page cible → glissement Lenis vers la section, l'URL
     reçoit l'ancre ;
   - depuis une autre page → navigation vers la page (arrivée en haut,
     via ScrollToTop) puis glissement jusqu'à l'ancre.
   Clic modifié (⌘ / ctrl / shift / molette) → comportement natif du lien.
   reduced-motion → saut direct (cf. lib/anchor-scroll).
   ------------------------------------------------------------------ */

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  /** Appelé au clic géré (ex. fermer le menu mobile). */
  onNavigate?: () => void;
};

export default function AnchorLink({ href, onNavigate, onClick, ...rest }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const lenisRef = useLenisRef();

  const hashIndex = href.indexOf("#");
  const path = hashIndex >= 0 ? href.slice(0, hashIndex) || "/" : href;
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || !hash || hash.length < 2) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

    e.preventDefault();
    onNavigate?.();

    if (pathname === path) {
      if (scrollToAnchor(lenisRef?.current, hash)) {
        history.pushState(null, "", hash);
      }
      return;
    }
    setPendingAnchor(hash);
    router.push(path);
  };

  return <Link {...rest} href={href} onClick={handleClick} />;
}
