/* ============================================================
   Préchargement inter-pages des héros scroll-scrub.

   Une fois la page courante entièrement servie, la bande passante ne coûte
   plus rien à personne : on en profite pour amener les frames 720 des héros
   des AUTRES pages. Avec le cache immuable d'un an posé sur /heroes
   (next.config.ts), une navigation vers un logement ouvre alors son scrub
   quasi instantanément, sans un octet de réseau.

   Trois précautions, toutes indispensables :

   1. AUCUN BITMAP. Le préchargement passe par `fetch` (mode « warm » du
      chargeur) : la réponse entre en cache HTTP puis est jetée. Garder des
      HTMLImageElement décodés pour huit séquences ferait exploser la mémoire
      pour des images qu'on ne dessinera peut-être jamais.

   2. GARDE-FOUS RÉSEAU. Rien ne part en Save-Data, en 2g/3g, ni sur un
      appareil à faible mémoire. Sur ces profils le coût est réel pour le
      visiteur et le bénéfice hypothétique.

   3. PRIORITÉ PLANCHER ET ABANDON. Les passes sont enfilées derrière tout le
      reste (l'ordonnanceur est à priorité stricte : elles ne prennent un
      créneau que si aucune séquence de la page n'attend), et tout est coupé
      dès que le visiteur navigue.

   S'y ajoute le réchauffage au survol : quand la souris (ou le doigt) touche
   un lien interne, on tire la première frame de la cible. C'est le signal
   d'intention le plus fiable qui existe, et ça ne coûte qu'une requête.
   ============================================================ */

import { apartments } from "@/lib/appartements";
import { framePath, loadPass, warmUrl, type PassHandle } from "@/lib/frame-loader";
import { heroSequences, type HeroSequence } from "@/lib/heroSequences";
import { buildLadder } from "@/lib/hero-frames";

/** Priorité plancher : derrière tout jeu 720 ou HD de la page ouverte. */
const PREFETCH_PRIORITY = 500_000;

/** Délai après lequel une page sans séquence à charger s'autorise à précharger. */
const IDLE_ARM_DELAY = 2500;

interface NavigatorNet extends Navigator {
  connection?: { effectiveType?: string; downlink?: number; saveData?: boolean };
  deviceMemory?: number;
}

/** Séquences de la page courante pas encore complètes. */
const pending = new Set<object>();
/** Dossiers déjà préchargés pendant la session (rien à refaire). */
const warmedDirs = new Set<string>();

let armed = false;
let idleId: number | null = null;
let running: PassHandle | null = null;
let pageKeys: string[] = [];

/* ---------- Route → héros ---------- */

/**
 * Clés de `heroSequences` d'une page. Le pathname peut être préfixé de la
 * locale (les liens du DOM le sont ; `usePathname` de next-intl ne l'est pas).
 */
export function heroKeysForPath(pathname: string): string[] {
  const p =
    pathname.replace(/[?#].*$/, "").replace(/^\/(fr|en)(?=\/|$)/, "") || "/";
  if (p === "/") return ["accueil-a", "accueil-b"];
  const m = /^\/appartements\/([^/]+)/.exec(p);
  if (!m) return [];
  return apartments.find((a) => a.slug === m[1])?.scrubHeroes ?? [];
}

/* ---------- Registre des séquences de la page ---------- */

export function registerHeroSequence(): {
  complete: () => void;
  release: () => void;
} {
  const token = {};
  pending.add(token);
  // Une séquence de la page ouverte reprend la main sur le préchargement.
  stopIdlePrefetch();
  return {
    complete: () => {
      if (pending.delete(token)) maybeStart();
    },
    release: () => {
      pending.delete(token);
    },
  };
}

/* ---------- Préchargement en temps mort ---------- */

function allowed(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as NavigatorNet;
  const c = nav.connection;
  if (c?.saveData) return false;
  if (c?.effectiveType && /^(slow-2g|2g|3g)$/.test(c.effectiveType)) return false;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2) return false;
  return true;
}

function onIdle(fn: () => void): number {
  if (typeof requestIdleCallback === "function") {
    return requestIdleCallback(fn, { timeout: 4000 }) as unknown as number;
  }
  return window.setTimeout(fn, 400);
}

function cancelIdle(id: number) {
  if (typeof cancelIdleCallback === "function") cancelIdleCallback(id);
  else window.clearTimeout(id);
}

/**
 * Séquences réellement branchées sur une page (accueil + héros scrub des
 * logements). Une séquence présente dans heroSequences mais débranchée (ex.
 * anciens clips en attente de ré-extraction) n'est pas préchargée.
 */
function usedKeys(): Set<string> {
  const keys = new Set(["accueil-a", "accueil-b"]);
  for (const a of apartments) for (const k of a.scrubHeroes ?? []) keys.add(k);
  return keys;
}

/**
 * Jeu que ce viewport affichera vraiment pour `seq`. Un jeu 720 RECADRÉ n'est
 * peint que sur petit écran : le réchauffer sur desktop reviendrait à tirer
 * 8 à 14 Mo de frames qui ne seront jamais dessinées.
 */
function dirForViewport(seq: HeroSequence): string {
  const small = window.matchMedia("(max-width: 767px)").matches;
  if (seq.mobileIsCrop && !small) return seq.framesDir;
  return seq.framesDirMobile ?? seq.framesDir;
}

function nextTarget() {
  const used = usedKeys();
  for (const [key, seq] of Object.entries(heroSequences)) {
    if (!used.has(key) || pageKeys.includes(key)) continue;
    const dir = dirForViewport(seq);
    if (warmedDirs.has(dir)) continue;
    return { seq, dir };
  }
  return null;
}

function run() {
  idleId = null;
  if (!armed || pending.size > 0 || running || !allowed()) return;

  const target = nextTarget();
  if (!target) return;
  warmedDirs.add(target.dir);

  const pass = loadPass({
    dir: target.dir,
    indices: buildLadder(target.seq.frameCount),
    priority: PREFETCH_PRIORITY,
    warmOnly: true,
  });
  running = pass;
  pass.promise.then(() => {
    if (running !== pass) return;
    running = null;
    if (armed) idleId = onIdle(run);
  });
}

function maybeStart() {
  if (!armed || pending.size > 0 || running || idleId !== null) return;
  if (!allowed()) return;
  idleId = onIdle(run);
}

/** Arme le préchargement pour la page `pathname` (appelé à chaque navigation). */
export function armHeroPrefetch(pathname: string): () => void {
  pageKeys = heroKeysForPath(pathname);
  armed = true;
  // Une page sans héros (mentions légales, 404…) n'a personne pour signaler la
  // fin du chargement : on lui laisse le temps de se poser, puis on démarre.
  const t = window.setTimeout(maybeStart, IDLE_ARM_DELAY);
  maybeStart();
  return () => {
    window.clearTimeout(t);
    stopIdlePrefetch();
    armed = false;
  };
}

export function stopIdlePrefetch() {
  if (idleId !== null) {
    cancelIdle(idleId);
    idleId = null;
  }
  if (running) {
    running.cancel();
    running = null;
  }
}

/* ---------- Réchauffage au survol d'un lien interne ---------- */

/**
 * Première frame du (ou des) héros de la cible : le poster, à la résolution
 * que servira le `<picture>` de la page d'arrivée, plus la frame 1 du jeu 720
 * si elle diffère (c'est celle sur laquelle le scrub s'ouvrira).
 */
export function warmHeroesForPath(pathname: string) {
  if (!allowed()) return;
  const keys = heroKeysForPath(pathname);
  const key = keys[0];
  if (!key) return;
  const seq = heroSequences[key];
  if (!seq) return;

  const small = window.matchMedia("(max-width: 767px)").matches;
  const low = seq.framesDirMobile ?? seq.framesDir;
  // Poster de la page d'arrivée, à la résolution qu'elle servira…
  warmUrl(framePath(small ? low : seq.framesDir, 1), "high");
  // …puis la frame 1 du jeu sur lequel son scrub s'ouvrira, si elle diffère.
  const opening = dirForViewport(seq);
  if (opening !== (small ? low : seq.framesDir)) {
    warmUrl(framePath(opening, 1), "low");
  }
}
