"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/* Couleur de départ du fondu du footer = fond RÉEL du bas de la page.
   On descend le long des derniers enfants de <main>, tant qu'ils couvrent
   toute la largeur et touchent le bas de <main> (une carte ou un bouton en
   fin de section ne compte pas), et on retient le fond opaque le plus
   profond : c'est lui qu'on voit au bord. À défaut, le fond du <body>. Posé
   en `--footer-from` sur le <footer> ; relu à chaque navigation (le footer
   vit dans le layout). */
function bottomColor(): string {
  const opaque = (c: string) =>
    c !== "transparent" && !/rgba\(.*,\s*0\)$/.test(c);
  let color = getComputedStyle(document.body).backgroundColor;
  const main = document.getElementById("main");
  if (!main) return color;
  const edge = main.getBoundingClientRect();
  let el: Element | null = main;
  while (el) {
    const r = el.getBoundingClientRect();
    if (Math.abs(r.bottom - edge.bottom) > 1 || r.width < edge.width - 1) break;
    const bg = getComputedStyle(el).backgroundColor;
    if (opaque(bg)) color = bg;
    el = el.lastElementChild;
  }
  return color;
}

export default function FooterFadeFrom({ targetId }: { targetId: string }) {
  const pathname = usePathname();
  useEffect(() => {
    const footer = document.getElementById(targetId);
    if (footer) footer.style.setProperty("--footer-from", bottomColor());
  }, [pathname, targetId]);
  return null;
}
