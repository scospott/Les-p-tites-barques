/* ============================================================
   Chargement progressif d'une séquence de héros.

   Le problème : à froid, le jeu desktop d'un héros pèse 12 à 25 Mo. Attendre
   qu'il soit entier avant d'animer, c'est laisser un visiteur rapide scroller
   sur le poster sans jamais voir le mouvement.

   Deux progressions se combinent ici.

   A. CLAIRSEMÉ → DENSE. Les frames ne sont pas chargées dans l'ordre 1, 2,
      3… mais par SUBDIVISION BINAIRE : d'abord les deux extrémités, puis le
      milieu, puis les quarts, les huitièmes… (cf. `buildLadder`). Chaque
      palier double la densité en couvrant TOUTE la timeline. Le scrub s'ouvre
      dès le premier palier (une douzaine de frames) : le mouvement est
      grossier mais réel, et le crossfade inter-frames de hero-canvas l'étire
      proprement sur les écarts. Il se resserre ensuite tout seul.

      L'échelle est emboîtée : le palier d'ouverture est toujours un préfixe
      de la même liste, quel que soit le nombre de frames qu'on décide d'y
      mettre — c'est aussi ce qui rend le budget initial (C) possible.

   B. 720 → HD (double-buffer, desktop seulement). On charge D'ABORD le jeu
      720 complet et on scrube dessus, agrandi. Le jeu 1920 arrive ensuite en
      arrière-plan et chaque frame HD reçue REMPLACE la 720 dans le buffer
      d'affichage ; le bitmap 720 correspondant est libéré dans la foulée. La
      qualité finale est donc intacte, elle arrive juste plus tard que le
      mouvement. Sur mobile, rien de tout ça : le jeu 720 EST le jeu final.

   C. BUDGET INITIAL. Avec `initialFrames`, seul ce préfixe de l'échelle 720
      part au chargement (il couvre déjà toute la timeline, à densité
      réduite) ; le reste de l'échelle ET le jeu HD attendent `release()`,
      appelé par le composant à la première interaction du visiteur. Une
      page ouverte et jamais scrollée ne tire donc que quelques Mo.

   L'ordonnancement (concurrence bornée, priorité stricte, ordre par proximité
   de la position de scroll) est délégué à frame-loader.ts.
   ============================================================ */

import { loadPass, type PassHandle } from "@/lib/frame-loader";
import type { FrameBuffer } from "@/lib/hero-canvas";

/** Frames du palier d'ouverture. */
const GATE_FRAMES = 12;

/**
 * Filet anti-connexion-lente. Si le palier d'ouverture n'est pas complet au
 * bout de ce délai, on ouvre quand même dès que `GATE_MIN` frames sont
 * décodées — l'échelle étant emboîtée, ces quelques frames couvrent déjà
 * toute la timeline et le crossfade fait le reste.
 *
 * Pourquoi un délai plutôt qu'un palier calibré sur `navigator.connection` :
 * Chrome ne met PAS à jour l'API Network Information depuis le throttling
 * DevTools, et son estimation est de toute façon absente ou périmée au tout
 * premier chargement — exactement le moment où la décision se prend. Une
 * mesure du réel bat une estimation dans tous les cas.
 */
const GATE_DEADLINE_MS = 1500;
const GATE_MIN = 4;

/**
 * Frames du palier d'ouverture demandées en `fetchpriority="high"` par le
 * héros visible : la moitié du palier, de quoi passer le seuil `GATE_MIN`
 * vite. (Elles partent après `load` : seul le poster est préchargé dans le
 * HTML, c'est lui le LCP.)
 */
export const PRELOAD_COUNT = 6;

/** Frames de tête chargées en continu avec le budget initial (cf. C). */
const HEAD_FRAMES = 6;

/** Taille maximale d'un palier — au-delà, l'ordre par proximité perd son sens. */
const MAX_STEP = 48;

/**
 * Ordre de chargement par subdivision binaire : extrémités, milieu, quarts…
 * Chaque préfixe de la liste couvre la timeline entière, à une densité qui
 * double palier après palier.
 */
export function buildLadder(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];

  const seen = new Uint8Array(count);
  const out: number[] = [0, count - 1];
  seen[0] = 1;
  seen[count - 1] = 1;

  let frontier = [0, count - 1];
  while (out.length < count) {
    const next: number[] = [];
    for (let k = 0; k + 1 < frontier.length; k++) {
      const a = frontier[k];
      const b = frontier[k + 1];
      if (b - a < 2) continue;
      const m = (a + b) >> 1;
      if (seen[m]) continue;
      seen[m] = 1;
      next.push(m);
      out.push(m);
    }
    if (next.length === 0) break;
    frontier = frontier.concat(next).sort((x, y) => x - y);
  }
  // Filet de sécurité : rien ne doit rester au bord du chemin.
  for (let i = 0; i < count; i++) if (!seen[i]) out.push(i);
  return out;
}

/** Découpe l'échelle en paliers de taille croissante (le 1er = le gate). */
function buildSteps(ladder: number[], gate: number): number[][] {
  const steps: number[][] = [];
  let at = 0;
  let size = Math.max(1, gate);
  while (at < ladder.length) {
    steps.push(ladder.slice(at, at + size));
    at += size;
    size = Math.min(size * 2, MAX_STEP);
  }
  return steps;
}

export interface HeroFramesOptions {
  /** Dossier du jeu de qualité FINALE (1920 sur desktop, 720 sur mobile). */
  dir: string;
  /**
   * Dossier du jeu 720 chargé en premier (double-buffer desktop). Absent sur
   * mobile : `dir` y est déjà le jeu 720.
   */
  dirLow?: string;
  frameCount: number;
  /**
   * Base de priorité : 0 = héros visible, 1 = héros différé. Le jeu HD prend
   * `base + HD_OFFSET`, donc TOUJOURS derrière tous les jeux 720 de la page.
   */
  base?: number;
  /** Position de scroll courante (index fractionnaire). */
  getPosition?: () => number;
  /**
   * `true` : la frame 1 n'est pas demandée au jeu 720 — le poster de la
   * section, en `fetchpriority="high"`, c'est déjà elle. On la sème via
   * `seedPoster()` dès qu'elle est décodée.
   */
  posterIsFirstFrame?: boolean;
  /** Nombre de frames marquées `fetchpriority="high"` (héros visible). */
  highPriority?: number;
  /**
   * Force la taille du palier d'ouverture. Utilisé par la soudure d'accueil
   * pour sa 2e séquence : elle n'apparaît qu'aux deux tiers d'un scroll de
   * 320 %, il suffit donc qu'elle ait de quoi ne jamais montrer un calque vide
   * — la faire peser autant que la 1re doublerait le délai d'ouverture.
   */
  gateFrames?: number;
  /**
   * Frames de l'échelle 720 chargées d'emblée (palier d'ouverture compris).
   * Au-delà, et pour tout le jeu HD, on attend `release()`. Absent = tout
   * part tout de suite.
   */
  initialFrames?: number;
  /** Avancement du palier d'ouverture — alimente l'indicateur. */
  onGateProgress?: (settled: number, total: number) => void;
  /** Une frame vient d'entrer dans le buffer (ou d'être remplacée en HD). */
  onFrame?: (index: number) => void;
}

export interface GateResult {
  decoded: number;
  total: number;
  /** `false` : trop de frames en échec, le scrub n'est pas montrable. */
  usable: boolean;
}

export interface HeroFramesHandle {
  /** Buffer d'affichage : meilleure image disponible à chaque index. */
  frames: FrameBuffer;
  /** Résolue quand il y a de quoi ouvrir le scrub — c'est le gate. */
  gate: Promise<GateResult>;
  /** Résolue quand TOUT est chargé (720 dense puis HD dense). */
  done: Promise<void>;
  /** Sème le poster comme frame 1 (il est déjà décodé, et à la bonne taille). */
  seedPoster: (img: HTMLImageElement) => void;
  cancel: () => void;
  /** Le visiteur arrive sur ce héros : il passe devant tout le reste. */
  promote: () => void;
  /** Libère ce qui dépasse `initialFrames` (reste du 720 + jeu HD). */
  release: () => void;
}

/** Écart de priorité entre un jeu 720 et son jeu HD. */
const HD_OFFSET = 10;
/** Pas de priorité entre deux paliers d'un même jeu. */
const STEP_GAP = 10;

export function loadHeroFrames(o: HeroFramesOptions): HeroFramesHandle {
  const count = o.frameCount;
  const frames: FrameBuffer = new Array(count);
  /** `true` : le slot tient la qualité finale (poster semé ou frame HD). */
  const isFinal: boolean[] = new Array(count).fill(false);
  /** `true` : l'image du slot a été créée ici (donc libérable). */
  const owned: boolean[] = new Array(count).fill(false);

  const lowDir = o.dirLow ?? o.dir;
  const wantsHd = !!o.dirLow && o.dirLow !== o.dir;
  const ladder = buildLadder(count);
  // Sur desktop comme sur mobile, la frame 1 arrive par le poster.
  const lowLadder = o.posterIsFirstFrame ? ladder.filter((i) => i !== 0) : ladder;

  const write = (index: number, img: HTMLImageElement, final: boolean) => {
    if (!final && isFinal[index]) return;
    const prev = frames[index];
    if (prev === img) return;
    frames[index] = img;
    if (final) isFinal[index] = true;
    // Le bitmap 720 remplacé n'a plus de raison d'exister : sans ça les deux
    // jeux cohabitent en mémoire jusqu'au démontage. On ne libère QUE ce
    // qu'on a créé — jamais le poster, qui vit dans le DOM.
    if (prev && owned[index]) prev.removeAttribute("src");
    owned[index] = true;
    o.onFrame?.(index);
  };

  const handles: PassHandle[] = [];
  const priorities: number[] = [];
  let base = o.base ?? 0;

  /* ---- Gate : ouverture du scrub ---- */
  let gateDecoded = 0;
  let gateOpened = false;
  let pastDeadline = false;
  let resolveGate!: (result: GateResult) => void;
  const gate = new Promise<GateResult>((r) => {
    resolveGate = r;
  });
  const gateSize = Math.min(
    o.gateFrames ?? GATE_FRAMES,
    Math.max(1, lowLadder.length),
  );
  const gateDeadline = window.setTimeout(() => {
    pastDeadline = true;
    tryOpenGate();
  }, GATE_DEADLINE_MS);

  function openGate(usable: boolean) {
    if (gateOpened) return;
    gateOpened = true;
    window.clearTimeout(gateDeadline);
    resolveGate({ decoded: gateDecoded, total: gateSize, usable });
  }

  function tryOpenGate() {
    if (gateOpened || !pastDeadline) return;
    if (gateDecoded >= Math.min(GATE_MIN, gateSize)) openGate(true);
  }

  const addPass = (
    dir: string,
    indices: number[],
    baseOffset: number,
    step: number,
    final: boolean,
    isGate: boolean,
  ) => {
    const priority = (base + baseOffset) * 1000 + step * STEP_GAP;
    const handle = loadPass({
      dir,
      indices,
      priority,
      getPosition: o.getPosition,
      highPriority: isGate ? o.highPriority : undefined,
      onFrame: (index, img, ok) => {
        if (ok && img) write(index, img, final);
        if (!isGate) return;
        if (ok) gateDecoded += 1;
        tryOpenGate();
      },
      onProgress: isGate ? o.onGateProgress : undefined,
    });
    handles.push(handle);
    priorities.push(baseOffset * 1000 + step * STEP_GAP);
    return handle;
  };

  // Budget initial : le préfixe de l'échelle part maintenant, le reste attend
  // `release()`. Le palier d'ouverture est toujours dans le préfixe.
  // S'y ajoutent les toutes premières frames, en continu : le scroll démarre
  // là, avant que le reste de l'échelle n'ait eu le temps d'arriver.
  const initialCount =
    o.initialFrames === undefined
      ? lowLadder.length
      : Math.max(gateSize, Math.min(o.initialFrames, lowLadder.length));
  const initialSet = new Set(lowLadder.slice(0, initialCount));
  const head =
    o.initialFrames === undefined
      ? []
      : lowLadder.filter((i) => i < HEAD_FRAMES && !initialSet.has(i));
  for (const i of head) initialSet.add(i);
  const initialList = lowLadder.slice(0, initialCount).concat(head);
  const lowSteps = buildSteps(initialList, gateSize);
  if (lowSteps.length) {
    const gateHandle = addPass(lowDir, lowSteps[0], 0, 0, !wantsHd, true);
    // Palier complet : c'est le cas normal, et le seul qui puisse conclure à
    // un repli (trop de frames en échec).
    gateHandle.promise.then((r) =>
      openGate(r.decoded >= Math.ceil(r.total * 0.6)),
    );
  } else {
    openGate(false);
  }
  for (let s = 1; s < lowSteps.length; s++) {
    addPass(lowDir, lowSteps[s], 0, s, !wantsHd, false);
  }

  /** Passes différées jusqu'à `release()`. */
  let held: (() => void)[] | null = [];
  const restLow = lowLadder.filter((i) => !initialSet.has(i));
  if (restLow.length) {
    held.push(() => {
      const steps = buildSteps(restLow, MAX_STEP);
      for (let s = 0; s < steps.length; s++) {
        addPass(lowDir, steps[s], 0, lowSteps.length + s, !wantsHd, false);
      }
    });
  }
  if (wantsHd) {
    // Priorité toujours supérieure à celle de TOUS les jeux 720 de la page :
    // le HD ne consomme un créneau que lorsque plus rien de léger n'attend.
    held.push(() => {
      const hdSteps = buildSteps(ladder, GATE_FRAMES);
      for (let s = 0; s < hdSteps.length; s++) {
        addPass(o.dir, hdSteps[s], HD_OFFSET, s, true, false);
      }
    });
  }
  let cancelled = false;
  const release = () => {
    if (!held || cancelled) return;
    const run = held;
    held = null;
    for (const fn of run) fn();
  };
  if (o.initialFrames === undefined) release();

  // Photographie des passes à cet instant : `done` ne couvre que ce qui est
  // parti. Après `release()`, le chargement continue sans que rien n'attende.
  const done = Promise.all(handles.map((h) => h.promise)).then(() => undefined);

  return {
    frames,
    gate,
    done,
    seedPoster: (img) => {
      if (count === 0) return;
      if (!img.complete || !img.naturalWidth) return;
      if (isFinal[0]) return;
      const prev = frames[0];
      frames[0] = img;
      // Le poster est servi à la résolution du jeu actif (élément <picture>) :
      // le compter comme définitif évite qu'une 720 vienne l'écraser.
      isFinal[0] = true;
      if (prev && owned[0]) prev.removeAttribute("src");
      owned[0] = false;
      o.onFrame?.(0);
    },
    cancel: () => {
      cancelled = true;
      held = null;
      window.clearTimeout(gateDeadline);
      for (const h of handles) h.cancel();
    },
    promote: () => {
      if (base <= -1) return;
      base = -1;
      for (let k = 0; k < handles.length; k++) {
        handles[k].setPriority(base * 1000 + priorities[k]);
      }
    },
    release,
  };
}
