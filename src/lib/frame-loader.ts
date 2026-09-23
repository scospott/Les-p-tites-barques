/* ============================================================
   Chargeur de frames des héros scroll-scrub — ordonnanceur global.

   L'unité de travail est la PASSE : un lot d'indices à charger dans un
   dossier donné, avec une priorité. Une séquence n'est plus une passe unique
   mais un empilement de passes de plus en plus denses (cf. hero-frames.ts) ;
   c'est ce découpage qui permet d'ouvrir le scrub sur une couverture
   clairsemée sans attendre les 12-25 Mo du jeu complet.

   Quatre garanties, dans cet ordre d'importance :

   1. DÉCODAGE, pas seulement téléchargement. `img.decode()` attend que le
      bitmap soit prêt à être peint. Un `onload` ne dit que « les octets sont
      arrivés » : le premier `drawImage` déclencherait alors un décodage
      synchrone en plein scroll — exactement la micro-saccade qu'on chasse.

   2. CONCURRENCE BORNÉE, GLOBALEMENT. `MAX_IN_FLIGHT` requêtes au total,
      toutes passes confondues. Lâcher 119 requêtes d'un coup sature la file
      du navigateur : les premières frames arrivent aussi tard que les
      dernières, et rien n'est utilisable avant la fin.

   3. PRIORITÉ STRICTE ET PRÉEMPTIBLE. À chaque créneau libéré, c'est la passe
      de plus petite priorité qui parle — pas celle qui avait commencé. Une
      passe de fond (jeu HD, préchargement d'une autre page) se fait donc
      doubler dès qu'un besoin plus urgent apparaît, sans être annulée : les
      requêtes déjà en vol finissent, les suivantes attendent. C'est ce qui
      garantit que le jeu HD ne démarre qu'une fois le jeu 720 complet, et que
      le préchargement inter-pages ne vole jamais un octet à la page ouverte.

   4. ORDRE PAR PROXIMITÉ. À l'intérieur d'une passe, la prochaine frame
      chargée est la plus proche de la position de scroll courante, avec un
      léger biais vers l'aval (le scroll avance). Le remplissage se fait donc
      là où le visiteur regarde.
   ============================================================ */

/** Requêtes simultanées, toutes passes confondues. */
export const MAX_IN_FLIGHT = 8;

/**
 * Biais aval de l'ordre de remplissage : une frame en amont de la position
 * courante « coûte » 1,5 fois sa distance. Le scroll allant vers l'avant, on
 * remplit d'abord ce qui va être vu.
 */
const BACKWARD_COST = 1.5;

export function framePath(dir: string, index: number): string {
  return `${dir}/frame-${String(index).padStart(4, "0")}.webp`;
}

export interface PassResult {
  /** Frames réellement décodées (prêtes à peindre). */
  decoded: number;
  /** Frames en échec (404, décodage impossible). */
  failed: number;
  /** Frames demandées par la passe. */
  total: number;
}

export interface PassOptions {
  /** Dossier des frames, ex. "/heroes/accueil-a-mobile". */
  dir: string;
  /** Indices 0-based à charger (frame-0001 = index 0). */
  indices: number[];
  /** Plus petit = plus prioritaire. */
  priority: number;
  /** Position de scroll courante (index fractionnaire), pour l'ordre. */
  getPosition?: () => number;
  /** Nombre de premières requêtes marquées `fetchpriority="high"`. */
  highPriority?: number;
  /**
   * `true` : on réchauffe seulement le cache HTTP (fetch consommé puis jeté).
   * Aucun HTMLImageElement n'est conservé, donc aucun bitmap décodé en
   * mémoire — indispensable pour le préchargement des AUTRES pages, qui
   * porterait sinon des centaines de Mo de bitmaps jamais affichés.
   */
  warmOnly?: boolean;
  /** Appelé pour chaque frame réglée, décodée ou non. */
  onFrame?: (index: number, img: HTMLImageElement | null, ok: boolean) => void;
  /** Appelé à chaque frame réglée, avec l'avancement de la passe. */
  onProgress?: (settled: number, total: number) => void;
}

export interface PassHandle {
  /** Résolue quand toutes les frames de la passe sont réglées (ou annulées). */
  promise: Promise<PassResult>;
  /** Abandonne la passe et coupe les requêtes en vol. */
  cancel: () => void;
  /** Repositionne la passe dans l'ordre global. */
  setPriority: (priority: number) => void;
}

/** Une requête en vol. `done` rend le règlement idempotent (cf. cancel). */
interface Req {
  img: HTMLImageElement | null;
  abort: AbortController | null;
  done: boolean;
}

interface Pass {
  o: PassOptions;
  priority: number;
  /** Ordre d'arrivée — départage les priorités égales (FIFO stable). */
  seq: number;
  pending: number[];
  total: number;
  settled: number;
  decoded: number;
  failed: number;
  issued: number;
  live: Set<Req>;
  cancelled: boolean;
  finished: boolean;
  resolve: (result: PassResult) => void;
}

const passes = new Set<Pass>();
let inFlight = 0;
let seqCounter = 0;

/** Passe la plus prioritaire ayant encore du travail. */
function pick(): Pass | null {
  let best: Pass | null = null;
  for (const p of passes) {
    if (p.cancelled || p.finished || p.pending.length === 0) continue;
    if (
      !best ||
      p.priority < best.priority ||
      (p.priority === best.priority && p.seq < best.seq)
    ) {
      best = p;
    }
  }
  return best;
}

/** Retire de `pending` l'indice le plus proche de la position courante. */
function takeNext(p: Pass): number {
  const pend = p.pending;
  if (pend.length === 1) return pend.pop() as number;

  const pos = p.o.getPosition ? p.o.getPosition() : 0;
  let bestAt = 0;
  let bestCost = Infinity;
  for (let k = 0; k < pend.length; k++) {
    const d = pend[k] - pos;
    const cost = d >= 0 ? d : -d * BACKWARD_COST;
    if (cost < bestCost) {
      bestCost = cost;
      bestAt = k;
    }
  }
  const index = pend[bestAt];
  // Retrait en O(1) : on remonte le dernier élément dans le trou.
  pend[bestAt] = pend[pend.length - 1];
  pend.pop();
  return index;
}

function settle(
  p: Pass,
  req: Req,
  index: number,
  img: HTMLImageElement | null,
  ok: boolean,
) {
  if (req.done) return;
  req.done = true;
  p.live.delete(req);
  inFlight -= 1;

  try {
    if (p.cancelled || p.finished) return;
    p.settled += 1;
    if (ok) p.decoded += 1;
    else p.failed += 1;
    p.o.onFrame?.(index, img, ok);
    p.o.onProgress?.(p.settled, p.total);
    if (p.settled >= p.total) finishPass(p);
  } finally {
    // Le créneau est rendu quoi qu'il arrive : une exception dans un callback
    // ne doit jamais bloquer l'ordonnanceur.
    schedule();
  }
}

function issue(p: Pass) {
  const index = takeNext(p);
  const url = framePath(p.o.dir, index + 1);
  const req: Req = { img: null, abort: null, done: false };
  p.live.add(req);
  p.issued += 1;
  inFlight += 1;

  if (p.o.warmOnly) {
    const ctrl = new AbortController();
    req.abort = ctrl;
    const init: RequestInit & { priority?: "high" | "low" | "auto" } = {
      signal: ctrl.signal,
      credentials: "same-origin",
      priority: "low",
    };
    fetch(url, init)
      // Le corps DOIT être consommé pour que la réponse entre en cache ; on
      // le jette aussitôt (aucun décodage, aucun bitmap).
      .then((res) => (res.ok ? res.arrayBuffer().then(() => true) : false))
      .then(
        (ok) => settle(p, req, index, null, ok),
        () => settle(p, req, index, null, false),
      );
    return;
  }

  const img = new Image();
  req.img = img;
  img.decoding = "async";
  if (p.o.highPriority && p.issued <= p.o.highPriority) {
    (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = "high";
  }
  img.src = url;

  if (typeof img.decode === "function") {
    img.decode().then(
      () => settle(p, req, index, img, true),
      // decode() rejette aussi bien sur un 404 que sur certains cas bénins
      // selon le navigateur : on retombe sur l'état réel de l'image.
      () => settle(p, req, index, img, img.complete && img.naturalWidth > 0),
    );
  } else {
    img.onload = () => settle(p, req, index, img, true);
    img.onerror = () => settle(p, req, index, img, false);
  }
}

function schedule() {
  while (inFlight < MAX_IN_FLIGHT) {
    const p = pick();
    if (!p) return;
    issue(p);
  }
}

function finishPass(p: Pass) {
  if (p.finished) return;
  p.finished = true;
  passes.delete(p);
  p.resolve({ decoded: p.decoded, failed: p.failed, total: p.total });
}

function cancelPass(p: Pass) {
  if (p.finished || p.cancelled) return;
  p.cancelled = true;
  p.pending.length = 0;
  passes.delete(p);

  for (const req of p.live) {
    if (req.done) continue;
    // On solde le créneau NOUS-MÊMES : couper une image ne déclenche pas
    // `onerror` de façon fiable selon le navigateur, et un règlement manqué
    // bloquerait `inFlight` — donc l'ordonnanceur — définitivement.
    req.done = true;
    inFlight -= 1;
    req.abort?.abort();
    // `removeAttribute` plutôt que `src = ""` : une chaîne vide relance une
    // requête vers l'URL du document sur certains navigateurs.
    req.img?.removeAttribute("src");
  }
  p.live.clear();

  p.finished = true;
  p.resolve({ decoded: p.decoded, failed: p.failed, total: p.total });
  schedule();
}

/**
 * Met une passe en file. Le chargement démarre dès qu'un créneau se libère et
 * qu'aucune passe plus prioritaire n'attend.
 */
export function loadPass(o: PassOptions): PassHandle {
  let resolve!: (result: PassResult) => void;
  const promise = new Promise<PassResult>((r) => {
    resolve = r;
  });

  const p: Pass = {
    o,
    priority: o.priority,
    seq: seqCounter++,
    pending: o.indices.slice(),
    total: o.indices.length,
    settled: 0,
    decoded: 0,
    failed: 0,
    issued: 0,
    live: new Set(),
    cancelled: false,
    finished: false,
    resolve,
  };

  if (p.total === 0) {
    p.finished = true;
    resolve({ decoded: 0, failed: 0, total: 0 });
  } else {
    passes.add(p);
    schedule();
  }

  return {
    promise,
    cancel: () => cancelPass(p),
    setPriority: (priority: number) => {
      if (p.priority === priority) return;
      p.priority = priority;
      // La préemption prend effet au prochain créneau libéré : les requêtes
      // déjà en vol vont au bout (les couper gaspillerait ce qui est déjà
      // arrivé), les suivantes passent derrière.
      schedule();
    },
  };
}

/**
 * Réchauffe une URL isolée dans le cache HTTP, hors ordonnanceur (une requête,
 * déclenchée par une intention de l'utilisateur : survol d'un lien). Sans
 * effet si l'URL a déjà été réchauffée pendant la session.
 */
const warmedUrls = new Set<string>();

export function warmUrl(url: string, priority: "high" | "low" = "low") {
  if (warmedUrls.has(url)) return;
  warmedUrls.add(url);
  const init: RequestInit & { priority?: "high" | "low" | "auto" } = {
    credentials: "same-origin",
    priority,
  };
  fetch(url, init)
    .then((res) => (res.ok ? res.arrayBuffer() : null))
    .catch(() => {
      // Un réchauffage raté n'a aucune conséquence : la frame sera chargée
      // normalement à l'arrivée sur la page. On réautorise juste un essai.
      warmedUrls.delete(url);
    });
}
