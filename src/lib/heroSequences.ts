// Séquences scroll-scrub par logement (frames extraites d'une vidéo via ffmpeg).
// Le nombre de frames (`frameCount`) est le compte RÉEL de fichiers générés —
// à mettre à jour si on ré-extrait. Voir public/heroes/<dir>/frame-XXXX.webp.

export interface HeroSequence {
  /** Dossier des frames pleine résolution (desktop), ex: "/heroes/parame/hero1" */
  framesDir: string;
  /** Dossier des frames allégées (mobile) — même nombre de frames. Mémoire ÷3. */
  framesDirMobile?: string;
  /**
   * Le jeu 720 est-il un RECADRAGE (9:16 pris au centre) et non un simple
   * sous-échantillonnage du jeu desktop ?
   *
   * Ça change tout côté rendu : un jeu 720 de même cadrage sert de palier
   * d'attente sur desktop (il s'affiche agrandi le temps que le HD arrive,
   * invisible à l'œil). Un jeu RECADRÉ, lui, ne montre pas le même cadre que
   * le poster — l'afficher sur desktop ferait sauter le cadrage à l'ouverture
   * du gate. Il est donc réservé aux viewports où le poster recadré est servi.
   */
  mobileIsCrop?: boolean;
  /** Nombre réel de frames présentes dans le dossier. */
  frameCount: number;
  /** Image affichée avant le préchargement / en base (SSR). */
  poster: string;
  /** Vidéo de repli (reduced-motion off, appareil faible, échec des frames). */
  fallbackVideo: string;
}

/* ------------------------------------------------------------------
   Héros des 3 logements malouins — clips Seedance (4,04 s, 24 fps),
   sources hors dépôt : ~/Documents/ScottLab/Assets/petites-barques/videos.
   Desktop : fps=24, scale 1920, lanczos + unsharp, -quality 82.
   Mobile  : fps=24, crop 9:16 centré, scale 720, -quality 86 — d'où
   `mobileIsCrop: true` : ce jeu ne montre pas le même cadre que le desktop et
   ne doit donc s'afficher que sur petit écran.
   Le mobile garde le MÊME fps que le desktop : le chargeur (hero-frames.ts)
   demande le jeu 720 aux mêmes indices que le jeu HD — un jeu mobile moins
   dense ferait 404 sur la moitié de l'échelle et le gate basculerait en repli.
   Compte réel : 97 frames par séquence, desktop et mobile alignés.
   Pas de vidéo de repli (`fallbackVideo` vide) : aucun .mp4 dans le dépôt,
   le repli est le poster / la dernière frame.
   ------------------------------------------------------------------ */
export const heroSequences: Record<string, HeroSequence> = {
  // LES REMPARTS MER — héros 1 (haut de page) et héros 2 (bas de page).
  "remparts-mer-1": {
    framesDir: "/heroes/remparts-mer/hero1",
    framesDirMobile: "/heroes/remparts-mer/hero1-mobile",
    mobileIsCrop: true,
    frameCount: 97,
    poster: "/heroes/remparts-mer/hero1/frame-0001.webp",
    fallbackVideo: "",
  },
  "remparts-mer-2": {
    framesDir: "/heroes/remparts-mer/hero2",
    framesDirMobile: "/heroes/remparts-mer/hero2-mobile",
    mobileIsCrop: true,
    frameCount: 97,
    poster: "/heroes/remparts-mer/hero2/frame-0001.webp",
    fallbackVideo: "",
  },
  // LES REMPARTS PLAGE — héros 1 et héros 2.
  "remparts-plage-1": {
    framesDir: "/heroes/remparts-plage/hero1",
    framesDirMobile: "/heroes/remparts-plage/hero1-mobile",
    mobileIsCrop: true,
    frameCount: 97,
    poster: "/heroes/remparts-plage/hero1/frame-0001.webp",
    fallbackVideo: "",
  },
  "remparts-plage-2": {
    framesDir: "/heroes/remparts-plage/hero2",
    framesDirMobile: "/heroes/remparts-plage/hero2-mobile",
    mobileIsCrop: true,
    frameCount: 97,
    poster: "/heroes/remparts-plage/hero2/frame-0001.webp",
    fallbackVideo: "",
  },
  // PARAMÉ — un seul clip : le héros 2 reste un Ken Burns image (PROVISOIRE).
  // Source carrée (2880×2880) → frames desktop 1920×1920, recadrées en
  // « cover » par le canvas.
  "parame-1": {
    framesDir: "/heroes/parame/hero1",
    framesDirMobile: "/heroes/parame/hero1-mobile",
    mobileIsCrop: true,
    frameCount: 97,
    poster: "/heroes/parame/hero1/frame-0001.webp",
    fallbackVideo: "",
  },
  // Hero d'accueil soudé — 2 séquences enchaînées (A puis B) avec crossfade.
  // 30 fps, scale 2560 (desktop) / 720 (mobile). 118 frames (alignés). Pas de
  // vidéo de repli (fallbackVideo vide) : le repli reduced-motion = 1re frame A.
  // A : Saint-Malo, finit sous l'eau bleue.
  "accueil-a": {
    framesDir: "/heroes/accueil-a",
    framesDirMobile: "/heroes/accueil-a-mobile",
    frameCount: 118,
    poster: "/heroes/accueil-a/frame-0001.webp",
    fallbackVideo: "",
  },
  // B : sort de l'eau bleue → plage de Guadeloupe.
  "accueil-b": {
    framesDir: "/heroes/accueil-b",
    framesDirMobile: "/heroes/accueil-b-mobile",
    frameCount: 118,
    poster: "/heroes/accueil-b/frame-0001.webp",
    fallbackVideo: "",
  },
};
