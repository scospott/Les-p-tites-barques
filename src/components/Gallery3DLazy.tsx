"use client";

import dynamic from "next/dynamic";

import type { Gallery3DProps } from "./Gallery3D";

/**
 * Chargement paresseux de <Gallery3D> (Canvas + three.js ≈ 250 kB).
 * `ssr: false` : pas de rendu serveur du WebGL. Le gros bundle three.js part
 * dans un chunk séparé, téléchargé uniquement quand la galerie 3D est montée
 * — les pages qui n'affichent pas de carrousel n'en paient pas le poids.
 * Le fallback réserve la hauteur pour éviter tout saut de layout.
 */
const Gallery3D = dynamic<Gallery3DProps>(() => import("./Gallery3D"), {
  ssr: false,
  loading: () => <div aria-hidden className="h-[70vh] min-h-[28rem] w-full" />,
});

export default Gallery3D;
