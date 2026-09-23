"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import { useTranslations } from "next-intl";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

import { framePath } from "@/lib/frame-loader";
import {
  createDrawState,
  drawFrames,
  invalidateDraw,
  touchFrame,
  type FrameBuffer,
} from "@/lib/hero-canvas";
import {
  PRELOAD_COUNT,
  loadHeroFrames,
  type HeroFramesHandle,
} from "@/lib/hero-frames";
import { afterLoad, heroLoadProfile, onFirstEngagement } from "@/lib/hero-prefetch";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/* Frontière poster / jeu de frames. Les deux DOIVENT être décidés par la même
   règle, sinon le passage du poster au canvas change de cadrage. */
const SMALL_MEDIA = "(max-width: 767px)";
const WIDE_MEDIA = "(min-width: 768px)";

// "loading" : le pin existe déjà (pas de saut de mise en page plus tard) et le
// poster tient l'écran ; les frames se chargent en file. "scrub" arrive dès
// que le PALIER D'OUVERTURE du jeu 720 est décodé — le reste (densification
// puis jeu HD) continue en arrière-plan, sans jamais interrompre le scrub.
type Mode = "init" | "loading" | "scrub" | "reduced" | "fallback";

interface ScrollHeroProps {
  /** Dossier des frames pleine résolution, ex: "/heroes/accueil-a" */
  framesDir: string;
  /** Dossier des frames allégées (720). Chargé EN PREMIER, y compris sur
      desktop où il sert de buffer d'attente avant le jeu pleine résolution —
      SAUF s'il est recadré (cf. `mobileIsCrop`). */
  framesDirMobile?: string;
  /**
   * `framesDirMobile` est-il un RECADRAGE (9:16) plutôt qu'un simple
   * sous-échantillonnage ? Si oui il ne montre pas le même cadre que le
   * poster : il est alors réservé aux viewports qui reçoivent le poster
   * mobile, et le desktop attend directement le jeu pleine résolution.
   */
  mobileIsCrop?: boolean;
  /** Nombre réel de frames (frame-0001…frame-{frameCount}). */
  frameCount: number;
  /** Image de base (SSR + sous le canvas). Défaut : 1re frame de `framesDir`. */
  poster?: string;
  title: string;
  /**
   * Complément du H1 lu par les moteurs et lecteurs d'écran seulement
   * (ex. « , Saint-Malo ») : le H1 d'une fiche porte nom + ville sans
   * changer le titre affiché.
   */
  titleSuffix?: string;
  /** Texte alternatif du poster (pièce + logement). Vide = décoratif. */
  posterAlt?: string;
  subtitle?: string;
  location?: string;
  /** Vidéo de repli plein écran si le scrub n'est pas possible. */
  fallbackVideo: string;
  scrollLabel?: string;
  /**
   * Ne pas disputer la bande passante au héros visible. Le 2e héros d'une page
   * passe en priorité 1 : son jeu 720 n'entre en file qu'une fois celui du
   * héros 1 servi, et il double tout le monde à l'approche du viewport.
   */
  deferPreload?: boolean;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Heuristique « appareil faible » : on préfère la vidéo de repli plutôt qu'un
 * scrub qui rame ou un téléchargement lourd sur réseau lent / data saver.
 */
function isWeakDevice(): boolean {
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
    deviceMemory?: number;
  };
  const c = nav.connection;
  if (c?.saveData) return true;
  if (c?.effectiveType && /(^|-)2g$/.test(c.effectiveType)) return true;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2) return true;
  return false;
}

/**
 * Hero à scroll-scrub : une séquence d'images défile au scroll pendant que la
 * section reste épinglée, puis se dépingle. Repli vidéo + reduced-motion gérés.
 *
 * Chargement progressif (cf. lib/hero-frames.ts) : jeu 720 clairsemé →
 * ouverture du scrub → densification → jeu pleine résolution substitué frame
 * par frame. Sur mobile, seul le jeu 720 existe : rien ne change pour lui.
 */
export default function ScrollHero({
  framesDir,
  framesDirMobile,
  mobileIsCrop = false,
  frameCount,
  poster,
  title,
  subtitle,
  titleSuffix,
  posterAlt,
  location,
  fallbackVideo,
  deferPreload = false,
  scrollLabel = "Découvrir",
}: ScrollHeroProps) {
  const tMedia = useTranslations("media");
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const posterRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLAnchorElement>(null);
  const framesRef = useRef<FrameBuffer>([]);
  const handleRef = useRef<HeroFramesHandle | null>(null);
  /** État de dessin (mémoïsation + bornes du fondu courant). */
  const drawStateRef = useRef(createDrawState());
  // Frame visée par le scroll + frame affichée amortie (LERP dans la boucle rAF).
  const targetFrameRef = useRef(0);
  const currentFrameRef = useRef(0);
  const revealRef = useRef<gsap.core.Tween | null>(null);

  const [mode, setMode] = useState<Mode>("init");
  const [progressPct, setProgressPct] = useState(0);
  /* Miroir de `mode === "scrub"` lisible depuis la boucle rAF (qui vit hors
     du cycle de rendu React). C'est LUI qui applique le gate : tant qu'il est
     faux, on ne peint rien sur le canvas — sinon on verrait défiler les
     quelques frames déjà décodées, c'est-à-dire exactement le scrub incomplet
     qu'on veut éviter. Le poster, net et plein cadre, tient l'écran. */
  const scrubReadyRef = useRef(false);
  useEffect(() => {
    scrubReadyRef.current = mode === "scrub";
  }, [mode]);

  /** `null` avant le montage (pas d'accès navigator au SSR). */
  const [small, setSmall] = useState<boolean | null>(null);
  /** Passe à `true` une seule fois : les transitions de `mode` ne doivent
      JAMAIS relancer (ni annuler) le chargement en cours. */
  const [startLoad, setStartLoad] = useState(false);

  // Poster par défaut : 1re frame plein résolution (SSR-safe, avant le mount).
  const resolvedPoster = poster ?? framePath(framesDir, 1);
  const posterIsFirstFrame = resolvedPoster === framePath(framesDir, 1);
  const mobilePoster = framesDirMobile ? framePath(framesDirMobile, 1) : null;
  /* LE JEU AFFICHÉ DOIT SUIVRE LE POSTER, exactement.
     Le poster mobile est servi par le <picture> sous SMALL_MEDIA ; c'est donc
     cette frontière-là — et pas une autre — qui décide du jeu de frames dès
     que celui-ci est RECADRÉ. Sans ça, un viewport peut recevoir le poster
     4:3 puis se faire peindre un 9:16 : c'est le saut de cadrage à
     l'ouverture du gate. */
  const smallDir = framesDirMobile ?? framesDir;
  const reducedFrame = framePath(small ? smallDir : framesDir, frameCount);

  /* Priorité réseau : SEUL LE POSTER part en <link rel="preload"
     fetchpriority="high"> dès le HTML. C'est lui qui tient le cadre (et le
     LCP) jusqu'à l'ouverture du scrub. Les frames ne partent qu'après
     `load` : préchargées dans l'en-tête, elles lui disputaient la bande
     passante et repoussaient le premier affichage de plusieurs secondes sur
     réseau mobile. */
  if (!deferPreload) {
    if (mobilePoster) {
      preload(mobilePoster, {
        as: "image",
        fetchPriority: "high",
        media: SMALL_MEDIA,
      });
      preload(resolvedPoster, {
        as: "image",
        fetchPriority: "high",
        media: WIDE_MEDIA,
      });
    } else {
      preload(resolvedPoster, { as: "image", fetchPriority: "high" });
    }
    // Seul le poster est préchargé (c'est le LCP) : les frames du scrub ne
    // partent qu'après `load` (cf. afterLoad), pour ne pas lui disputer la
    // bande passante.
  }

  const paint = useCallback((pos: number) => {
    drawFrames(canvasRef.current, framesRef.current, drawStateRef.current, pos);
  }, []);

  // Recalcule la taille du buffer canvas (DPR plafonné) puis redessine.
  // No-op si la taille n'a pas changé (évite les réallocations sur mobile).
  // Appelé uniquement au montage et sur `resize` — jamais dans la boucle rAF,
  // c'est le seul endroit qui lit `clientWidth/Height` (donc le layout).
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    const nw = Math.round(w * dpr);
    const nh = Math.round(h * dpr);
    if (canvas.width === nw && canvas.height === nh) return;
    canvas.width = nw;
    canvas.height = nh;
    invalidateDraw(drawStateRef.current);
    paint(currentFrameRef.current);
  }, [paint]);

  /** Le poster est la frame 1, déjà décodée et servie à la bonne résolution
      par le <picture> : on l'injecte telle quelle dans le buffer plutôt que de
      la retélécharger (une requête de moins avant l'ouverture du scrub). */
  const seedPoster = useCallback(() => {
    const img = posterRef.current;
    if (img && posterIsFirstFrame) handleRef.current?.seedPoster(img);
  }, [posterIsFirstFrame]);

  // Choix du mode au montage (évite tout accès navigator au SSR).
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    // Jeu recadré : on colle à la media query du poster, au pixel de
    // frontière près. Jeu de même cadrage : on garde l'heuristique
    // « petit écran OU pointeur grossier », qui épargne les appareils
    // faibles sans conséquence visible (le cadre est le même).
    setSmall(
      mobileIsCrop
        ? window.matchMedia(SMALL_MEDIA).matches
        : coarse || window.innerWidth < 768,
    );
    if (prefersReducedMotion()) setMode("reduced");
    else if (isWeakDevice()) setMode("fallback");
    else {
      setMode("loading");
      // Héros 1 : frames après `load`. Héros différé : rien ne part avant
      // qu'il approche (effet plus bas).
      if (!deferPreload) return afterLoad(() => setStartLoad(true));
    }
  }, [mobileIsCrop, deferPreload]);

  // Chargement progressif de la séquence.
  useEffect(() => {
    if (!startLoad || small === null) return;

    const profile = heroLoadProfile();
    const handle = loadHeroFrames({
      // Mobile : le jeu 720 EST le jeu final, pas de double-buffer.
      dir: small ? smallDir : framesDir,
      // Palier d'attente desktop : UNIQUEMENT si le 720 a le même cadrage.
      // Un recadrage peint ici sauterait au cadrage du poster.
      dirLow: small || mobileIsCrop ? undefined : framesDirMobile,
      frameCount,
      base: deferPreload ? 1 : 0,
      getPosition: () => currentFrameRef.current,
      posterIsFirstFrame,
      highPriority: deferPreload ? 0 : PRELOAD_COUNT,
      // Héros 1 : budget initial, le reste à la première interaction. Le
      // héros 2 ne démarre qu'à l'approche — le visiteur scrolle déjà.
      initialFrames: deferPreload ? undefined : profile.initialFrames,
      onGateProgress: (settled, total) =>
        setProgressPct(total ? Math.min(100, Math.round((settled / total) * 100)) : 0),
      onFrame: (index) => touchFrame(drawStateRef.current, index),
    });
    handleRef.current = handle;
    framesRef.current = handle.frames;
    seedPoster();

    // Il approche du viewport : il passe devant ce qui reste du héros 1.
    if (deferPreload) handle.promote();
    const offEngage = deferPreload
      ? () => {}
      : onFirstEngagement(() => handle.release());
    let cancelled = false;

    handle.gate.then(({ usable }) => {
      if (cancelled) return;
      // GATE : le scrub s'ouvre sur le palier clairsemé — jamais sur un canvas
      // vide. Trop de frames en échec → repli.
      setMode(usable ? "scrub" : "fallback");
    });

    return () => {
      cancelled = true;
      offEngage();
      handle.cancel();
      handleRef.current = null;
    };
  }, [
    startLoad,
    small,
    framesDir,
    framesDirMobile,
    mobileIsCrop,
    smallDir,
    frameCount,
    deferPreload,
    posterIsFirstFrame,
    seedPoster,
  ]);

  // Héros différé : son chargement ne démarre qu'à l'approche du viewport
  // (marge 50 % en profil contraint, 100 % sinon — cf. heroLoadProfile).
  useEffect(() => {
    if (!deferPreload || startLoad || mode !== "loading") return;
    const section = sectionRef.current;
    if (!section) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setStartLoad(true);
          io.disconnect();
        }
      },
      { rootMargin: heroLoadProfile().deferredMargin },
    );
    io.observe(section);
    return () => io.disconnect();
  }, [deferPreload, startLoad, mode]);

  // Scrub : pin de la section + frame courante pilotée par la progression.
  // Le pin est construit dès "loading" pour que l'espaceur existe au 1er paint
  // (sinon insertion tardive → saut de page) : LE SCROLL DE LA PAGE RESTE DONC
  // LIBRE pendant le préchargement, seul le défilé d'images attend.
  const wantsScrub = mode === "loading" || mode === "scrub";
  useGSAP(
    () => {
      if (!wantsScrub) return;
      const section = sectionRef.current;
      if (!section) return;

      // Évite les sauts de pin liés à la barre d'adresse mobile.
      ScrollTrigger.config({ ignoreMobileResize: true });
      resize();

      // ScrollTrigger pilote la CIBLE (targetFrame) ; le dessin se fait dans la
      // boucle rAF qui interpole vers cette cible — pas d'update synchrone sur
      // l'event scroll (évite les saccades).
      const state = { frame: 0 };
      gsap.to(state, {
        frame: frameCount - 1,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "+=150%",
          pin: true,
          scrub: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const p = self.progress;
            // Dès qu'on scrolle, on termine la révélation pour éviter que le
            // titre reste invisible (fondu parent × fondu enfants).
            if (p > 0) revealRef.current?.progress(1);
            if (overlayRef.current) {
              overlayRef.current.style.opacity = String(Math.max(0, 1 - p * 1.7));
              overlayRef.current.style.transform = `translateY(${-p * 28}px)`;
            }
            if (cueRef.current) {
              cueRef.current.style.opacity = String(Math.max(0, 1 - p * 6));
            }
          },
        },
        onUpdate: () => {
          targetFrameRef.current = state.frame;
        },
      });

      // Boucle rAF : LERP frame-rate-aware de la frame affichée vers la cible
      // (rendu soyeux, continu) ; dessin canvas, jamais sur l'event scroll.
      // La position reste FRACTIONNAIRE jusqu'au dessin — c'est elle qui
      // alimente le crossfade inter-frames. Aucune avance autonome : sans
      // scroll, la cible ne bouge pas et le LERP se stabilise dessus.
      const SMOOTH = 0.13;
      let last = performance.now();
      let raf = requestAnimationFrame(function tick(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const alpha = 1 - Math.pow(1 - SMOOTH, dt * 60);
        const ready = scrubReadyRef.current;
        const cur = currentFrameRef.current;
        // Pas encore prêt : on suit la cible sans amortir NI dessiner, pour
        // que l'ouverture du gate se fasse pile à la bonne frame (aucun
        // rattrapage visible si le visiteur a déjà scrollé pendant l'attente).
        const next = ready
          ? cur + (targetFrameRef.current - cur) * alpha
          : targetFrameRef.current;
        currentFrameRef.current = next;
        if (ready) paint(next);
        raf = requestAnimationFrame(tick);
      });

      const onResize = () => resize();
      window.addEventListener("resize", onResize);
      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
      };
    },
    { scope: sectionRef, dependencies: [wantsScrub, frameCount] },
  );

  // Révélation douce de l'overlay au montage (désactivée en reduced-motion).
  useGSAP(
    () => {
      if (prefersReducedMotion() || !overlayRef.current) return;
      revealRef.current = gsap.from(overlayRef.current.children, {
        autoAlpha: 0,
        y: 26,
        duration: 1.1,
        ease: "power3.out",
        stagger: 0.12,
        delay: 0.25,
      });
    },
    { scope: sectionRef },
  );

  const showCanvas = mode === "init" || mode === "loading" || mode === "scrub";

  return (
    <section
      ref={sectionRef}
      data-hero
      className="relative flex h-[100svh] min-h-[34rem] w-full items-end overflow-hidden bg-ink"
    >
      {/* ===== HERO SLOT — séquence scroll-scrub =====
          Média : public/videos/<...>.mp4 → frames public/heroes/<...>/frame-XXXX.webp
          (extraction ffmpeg, voir public/heroes/README.md).
          Replis : reduced-motion (dernière frame statique) et vidéo plein écran.
          ============================================================ */}

      {/* Poster : base SSR + sous le canvas avant le 1er dessin.
          PAS de -z-10 : la <section> est `relative` sans z-index, elle ne crée
          donc pas de contexte d'empilement et un enfant négatif passerait
          DERRIÈRE son fond `bg-ink` — le poster serait noir. En z-auto, les
          enfants positionnés se peignent dans l'ordre du DOM : poster, puis
          canvas par-dessus. */}
      {/* Le <source> mobile évite de télécharger un poster 1920px sur un
          téléphone qui ne servira jamais que les frames 720px. Choix fait par
          le navigateur, avant tout JS — donc valable dès le SSR. */}
      <picture>
        {mobilePoster && (
          <source media={SMALL_MEDIA} srcSet={mobilePoster} />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={posterRef}
          src={resolvedPoster}
          alt={posterAlt ?? ""}
          aria-hidden={posterAlt ? undefined : true}
          fetchPriority="high"
          onLoad={seedPoster}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </picture>

      {showCanvas && (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
        />
      )}

      {mode === "reduced" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={reducedFrame}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {mode === "fallback" && fallbackVideo && (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={fallbackVideo}
          poster={resolvedPoster}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        />
      )}

      {/* Voile dégradé pour la lisibilité du titre */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(79, 74, 68,0.30) 0%, rgba(79, 74, 68,0.08) 36%, rgba(79, 74, 68,0.30) 70%, rgba(79, 74, 68,0.66) 100%)",
        }}
      />

      {/* Indicateur de préchargement — filet kaki + pastille de pourcentage,
          discrets, posés en bas du héros. Ils suivent le PALIER D'OUVERTURE :
          ils disent « ça arrive » et disparaissent au passage en scrub, pendant
          que la densification et le jeu HD continuent en silence. */}
      {mode === "loading" && (
        <div
          role="progressbar"
          aria-label={tMedia("loading")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPct}
          className="absolute inset-x-0 bottom-0 z-20"
        >
          <p className="kicker shell-wide mb-2.5 justify-end text-paper/60">
            {progressPct}&#8239;%
          </p>
          <div className="h-px w-full bg-paper/15">
            <div
              className="h-full transition-[width] duration-300 ease-out"
              style={{
                width: `${progressPct}%`,
                backgroundColor: "#B3B49A",
              }}
            />
          </div>
        </div>
      )}

      {/* Overlay titre / lieu */}
      <div
        ref={overlayRef}
        className="shell-wide relative z-10 w-full pb-[14vh] sm:pb-[12vh]"
      >
        {location && (
          <p className="kicker mb-6 text-paper/85">{location}</p>
        )}
        {title && (
          <h1 className="display-1 max-w-4xl text-paper">
            {title}
            {titleSuffix && <span className="sr-only">{titleSuffix}</span>}
          </h1>
        )}
        {subtitle && (
          <p className="hero-sub mt-7 max-w-xl text-paper/90">{subtitle}</p>
        )}
      </div>

      {/* Indicateur de scroll */}
      <a
        ref={cueRef}
        href="#contenu"
        aria-label={scrollLabel}
        className="group absolute bottom-7 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 sm:flex"
      >
        <span className="kicker text-paper/75 transition-colors group-hover:text-paper">
          {scrollLabel}
        </span>
        <span className="relative h-9 w-px overflow-hidden bg-paper/30">
          <span className="absolute inset-0 animate-[scrollcue_2.2s_var(--ease-out-soft)_infinite] bg-paper" />
        </span>
      </a>
    </section>
  );
}
