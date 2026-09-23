"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

import type { Gallery3DProps } from "./Gallery3D";

/**
 * Chargement paresseux de <Gallery3D> (Canvas + three.js ≈ 250 kB).
 * `ssr: false` : pas de rendu serveur du WebGL. Le gros bundle three.js part
 * dans un chunk séparé, téléchargé uniquement quand la galerie 3D est montée
 * — les pages qui n'affichent pas de carrousel n'en paient pas le poids.
 *
 * La galerie est loin sous la ligne de flottaison : on ne la monte qu'à
 * l'approche du viewport (une hauteur d'écran d'avance). Sans ça, l'évaluation
 * de react-three-fiber (~3 s de CPU sur desktop) bloquait le fil principal
 * pendant le chargement de la page.
 * Le bloc réservé garde la hauteur de la galerie : aucun saut de layout.
 */
const Gallery3D = dynamic<Gallery3DProps>(() => import("./Gallery3D"), {
  ssr: false,
  loading: () => <Placeholder />,
});

function Placeholder() {
  return <div aria-hidden className="h-[70vh] min-h-[28rem] w-full" />;
}

export default function Gallery3DLazy(props: Gallery3DProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "100% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  if (near) return <Gallery3D {...props} />;
  return (
    <div ref={ref}>
      <Placeholder />
    </div>
  );
}
