/* ============================================================
   Dessin d'une position FRACTIONNAIRE sur le canvas d'un héros.

   Partagé par <ScrollHero> et <HeroWeld> (qui en pilote deux, un par calque
   de la soudure A→B).

   Deux idées :

   1. CROSSFADE INTER-FRAMES. Position 12,4 → frame 12 pleine + frame 13 à
      40 %. Avec un simple arrondi, une séquence à 30 fps parcourue lentement
      au scroll saute d'une image à l'autre : l'œil voit des paliers. Ici le
      canvas fabrique l'image intermédiaire, le mouvement redevient continu.

   2. TOLÉRANCE AUX TROUS. Le jeu de frames arrive clairsemé puis se densifie
      (cf. hero-frames.ts). On ne fond donc pas « N vers N+1 » mais « la frame
      décodée la plus proche en dessous vers la suivante décodée » : tant que
      la couverture est grossière, le fondu s'étire sur l'écart, et il se
      resserre tout seul à mesure que les intermédiaires arrivent. C'est ce
      qui rend le scrub utilisable bien avant la fin du chargement, sans
      jamais montrer un à-coup ni un canvas vide.
   ============================================================ */

export type FrameBuffer = (HTMLImageElement | undefined)[];

export interface DrawState {
  /** Clé de mémoïsation (position × 100). -1 = à repeindre. */
  key: number;
  /** Bornes du dernier fondu : servent à savoir si une frame qui arrive
      change l'image affichée (et donc s'il faut repeindre). */
  lo: number;
  hi: number;
}

export function createDrawState(): DrawState {
  return { key: -1, lo: -1, hi: -1 };
}

/** Force le prochain dessin (resize, changement de buffer). */
export function invalidateDraw(state: DrawState) {
  state.key = -1;
}

/**
 * Une frame vient d'entrer dans le buffer (ou d'être remplacée par sa version
 * HD). On ne repeint que si elle tombe dans le fondu courant — sinon le
 * remplissage dense déclencherait un redraw plein écran par frame reçue.
 */
export function touchFrame(state: DrawState, index: number) {
  if (state.key === -1) return;
  if (index >= state.lo && index <= state.hi) state.key = -1;
}

function ready(img: HTMLImageElement | undefined): img is HTMLImageElement {
  return !!img && img.complete && img.naturalWidth > 0;
}

/**
 * Peint `pos` (index fractionnaire) sur `canvas`. Renvoie `true` si un dessin
 * a réellement eu lieu.
 *
 * Le dessin de la frame de base est toujours opaque et couvre tout le canvas
 * (cadrage « cover ») : aucun besoin de clearRect, et pas de rémanence.
 */
export function drawFrames(
  canvas: HTMLCanvasElement | null,
  frames: FrameBuffer,
  state: DrawState,
  pos: number,
): boolean {
  if (!canvas) return false;
  const maxIndex = frames.length - 1;
  if (maxIndex < 0) return false;

  const clamped = Math.max(0, Math.min(pos, maxIndex));
  // Mémoïsation au centième de frame : à l'arrêt, plus rien n'est repeint.
  const key = Math.round(clamped * 100);
  if (key === state.key) return false;

  const i = Math.floor(clamped);

  // `lo` : frame décodée la plus proche en dessous. À défaut (début de
  // séquence pas encore arrivé), la première décodée au-dessus.
  let lo = -1;
  let below = true;
  for (let k = i; k >= 0; k--) {
    if (ready(frames[k])) {
      lo = k;
      break;
    }
  }
  if (lo < 0) {
    below = false;
    for (let k = i + 1; k <= maxIndex; k++) {
      if (ready(frames[k])) {
        lo = k;
        break;
      }
    }
  }
  // Rien de décodé du tout : on ne peint pas. Le poster, net et plein cadre,
  // tient l'écran — c'est le gate anti-canvas-vide.
  if (lo < 0) return false;

  let hi = -1;
  for (let k = lo + 1; k <= maxIndex; k++) {
    if (ready(frames[k])) {
      hi = k;
      break;
    }
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  // `canvas.width/height` sont des propriétés du buffer, pas une lecture de
  // layout : la boucle rAF ne provoque donc aucun reflow.
  const cw = canvas.width;
  const ch = canvas.height;
  // Le jeu 720 est affiché agrandi sur desktop tant que le HD n'est pas
  // arrivé : on demande le meilleur rééchantillonnage disponible. (L'état du
  // contexte est réinitialisé par toute réaffectation de canvas.width.)
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const paint = (img: HTMLImageElement, alpha: number) => {
    const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  };

  paint(frames[lo] as HTMLImageElement, 1);

  if (hi > lo) {
    const t = Math.max(0, Math.min(1, (clamped - lo) / (hi - lo)));
    // Sautée quand elle ne pèserait rien (moins d'1 % d'opacité).
    if (t > 0.01) paint(frames[hi] as HTMLImageElement, t);
  }

  ctx.globalAlpha = 1;
  state.key = key;
  // Si `lo` a été trouvé AU-DESSUS de la position, toute frame en dessous
  // changerait le dessin : on élargit la fenêtre d'invalidation jusqu'à 0.
  state.lo = below ? lo : 0;
  state.hi = hi >= 0 ? hi : maxIndex;
  return true;
}
