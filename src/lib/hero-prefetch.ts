/* ============================================================
   Budget réseau des héros scroll-scrub — ce que la page charge, et quand.

   Un héros pèse 8 à 33 Mo selon le jeu (720 ou 1920). La règle est donc de
   ne charger que ce que le visiteur va voir, au moment où il va le voir :

   1. PAGE COURANTE, HÉROS 1. Au chargement, un préfixe de son échelle
      (`initialFrames`, cf. hero-frames.ts) : de quoi ouvrir le scrub et
      couvrir toute la timeline à densité réduite. Le reste (jeu 720 dense,
      puis jeu HD sur desktop) part à la PREMIÈRE INTERACTION — scroll,
      molette, toucher, clavier. Le poster, lui, est préchargé en
      `fetchpriority="high"` par le composant : c'est le LCP.

   2. PAGE COURANTE, HÉROS 2. Rien au chargement. Il démarre quand sa
      section approche du viewport (marge 50 % en profil contraint, 100 %
      sinon — cf. `heroLoadProfile`).

   3. AUTRES PAGES. Jamais en profil contraint. Sur desktop, uniquement sur
      INTENTION (survol ou focus d'un lien vers la page), après l'événement
      `load`, en temps mort (`requestIdleCallback`), un seul héros à la fois :
      une nouvelle intention remplace la précédente. Et seulement le préfixe
      d'ouverture de son héros 1, en cache HTTP (fetch jeté, aucun bitmap).

   PROFIL CONTRAINT = écran < 768 px, OU Save-Data, OU connexion annoncée
   autre que 4g. (L'API Network Information est absente de Safari/Firefox :
   là, seule la largeur d'écran décide.)
   ============================================================ */

import { scrubHeroesOf } from "@/lib/apartment-config";
import { routing } from "@/i18n/routing";
import { loadPass, warmUrl, type PassHandle } from "@/lib/frame-loader";
import { heroSequences, type HeroSequence } from "@/lib/heroSequences";
import { buildLadder } from "@/lib/hero-frames";

/** Priorité plancher : derrière tout jeu 720 ou HD de la page ouverte. */
const PREFETCH_PRIORITY = 500_000;

/** Frames du préfixe initial d'un héros 1, par profil. */
const INITIAL_FRAMES_CONSTRAINED = 24;
const INITIAL_FRAMES_DESKTOP = 40;

interface NavigatorNet extends Navigator {
  connection?: { effectiveType?: string; saveData?: boolean };
}

/* ---------- Profil de chargement ---------- */

export function isConstrained(): boolean {
  if (typeof window === "undefined") return true;
  if (window.innerWidth < 768) return true;
  const c = (navigator as NavigatorNet).connection;
  if (c?.saveData) return true;
  if (c?.effectiveType && c.effectiveType !== "4g") return true;
  return false;
}

export interface HeroLoadProfile {
  constrained: boolean;
  /** Préfixe de l'échelle chargé avant toute interaction (héros 1). */
  initialFrames: number;
  /** Marge d'approche qui déclenche le chargement du héros 2. */
  deferredMargin: string;
}

export function heroLoadProfile(): HeroLoadProfile {
  const constrained = isConstrained();
  return {
    constrained,
    initialFrames: constrained ? INITIAL_FRAMES_CONSTRAINED : INITIAL_FRAMES_DESKTOP,
    deferredMargin: constrained ? "50% 0px" : "100% 0px",
  };
}

/* ---------- Après `load` ---------- */

/**
 * Appelle `cb` une fois la page chargée (événement `load`), puis à la frame
 * suivante. Les frames du scrub partent donc APRÈS le poster, les polices,
 * le CSS et le bundle : elles ne disputent plus la bande passante au premier
 * affichage (LCP). Renvoie de quoi annuler.
 */
export function afterLoad(cb: () => void): () => void {
  let raf = 0;
  const go = () => {
    raf = requestAnimationFrame(cb);
  };
  if (document.readyState === "complete") {
    go();
    return () => cancelAnimationFrame(raf);
  }
  window.addEventListener("load", go, { once: true });
  return () => {
    window.removeEventListener("load", go);
    cancelAnimationFrame(raf);
  };
}

/* ---------- Première interaction ---------- */

const ENGAGE_EVENTS = ["scroll", "wheel", "touchstart", "pointerdown", "keydown"] as const;

/**
 * Appelle `cb` une seule fois, à la première interaction du visiteur (ou tout
 * de suite si la page est déjà scrollée — retour arrière, ancre). Renvoie de
 * quoi se désabonner.
 */
export function onFirstEngagement(cb: () => void): () => void {
  if (window.scrollY > 0) {
    cb();
    return () => {};
  }
  let fired = false;
  const fire = () => {
    if (fired) return;
    fired = true;
    off();
    cb();
  };
  const off = () => {
    for (const e of ENGAGE_EVENTS) window.removeEventListener(e, fire);
  };
  for (const e of ENGAGE_EVENTS) window.addEventListener(e, fire, { passive: true });
  return off;
}

/* ---------- Route → héros ---------- */

const LOCALE_PREFIX = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);

/**
 * Clés de `heroSequences` d'une page. Le pathname peut être préfixé de la
 * locale (les liens du DOM le sont ; `usePathname` de next-intl ne l'est pas).
 */
export function heroKeysForPath(pathname: string): string[] {
  const p = pathname.replace(/[?#].*$/, "").replace(LOCALE_PREFIX, "") || "/";
  if (p === "/") return ["accueil-a", "accueil-b"];
  const m = /^\/appartements\/([^/]+)/.exec(p);
  if (!m) return [];
  return scrubHeroesOf(m[1]);
}

/* ---------- Préchargement sur intention (desktop) ---------- */

let pageKeys: string[] = [];
let loaded = false;
let idleId: number | null = null;
let running: PassHandle | null = null;
/** Héros déjà réchauffés pendant la session. */
const warmed = new Set<string>();

function onIdle(fn: () => void): number {
  if (typeof requestIdleCallback === "function") {
    return requestIdleCallback(fn, { timeout: 2000 }) as unknown as number;
  }
  return window.setTimeout(fn, 200);
}

function cancelIdle(id: number) {
  if (typeof cancelIdleCallback === "function") cancelIdleCallback(id);
  else window.clearTimeout(id);
}

function stop() {
  if (idleId !== null) {
    cancelIdle(idleId);
    idleId = null;
  }
  if (running) {
    running.cancel();
    running = null;
  }
}

/**
 * Jeu que ce viewport affichera vraiment pour `seq`. Un jeu 720 RECADRÉ n'est
 * peint que sur petit écran : sur desktop, on ouvre directement sur le 1920.
 */
function openingDir(seq: HeroSequence): string {
  if (seq.mobileIsCrop) return seq.framesDir;
  return seq.framesDirMobile ?? seq.framesDir;
}

/** Arme le préchargement pour la page `pathname` (appelé à chaque navigation). */
export function armHeroPrefetch(pathname: string): () => void {
  pageKeys = heroKeysForPath(pathname);
  stop();
  const onLoad = () => {
    loaded = true;
  };
  if (document.readyState === "complete") onLoad();
  else window.addEventListener("load", onLoad, { once: true });
  return () => {
    window.removeEventListener("load", onLoad);
    stop();
  };
}

/**
 * Intention vers `pathname` (survol / focus d'un lien) : on réchauffe le
 * poster et le préfixe d'ouverture de son héros 1, en temps mort, après
 * `load`. Un seul héros à la fois.
 */
export function warmHeroesForPath(pathname: string) {
  if (!loaded || isConstrained()) return;
  const key = heroKeysForPath(pathname)[0];
  if (!key || pageKeys.includes(key) || warmed.has(key)) return;
  const seq = heroSequences[key];
  if (!seq) return;

  stop();
  idleId = onIdle(() => {
    idleId = null;
    warmed.add(key);
    // Poster de la page d'arrivée, tel qu'il sera servi sur desktop.
    warmUrl(seq.poster, "low");
    const pass = loadPass({
      dir: openingDir(seq),
      indices: buildLadder(seq.frameCount).slice(1, 1 + INITIAL_FRAMES_DESKTOP),
      priority: PREFETCH_PRIORITY,
      warmOnly: true,
    });
    running = pass;
    pass.promise.then((r) => {
      if (running === pass) running = null;
      // Passe coupée par une autre intention : on pourra y revenir.
      if (r.decoded < r.total) warmed.delete(key);
    });
  });
}
