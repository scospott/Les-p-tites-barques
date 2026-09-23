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
  preloadIndices,
  type HeroFramesHandle,
} from "@/lib/hero-frames";
import { registerHeroSequence } from "@/lib/hero-prefetch";

gsap.registerPlugin(ScrollTrigger, useGSAP);

type Mode = "init" | "loading" | "scrub" | "static";

/**
 * Palier d'ouverture de la séquence B. Elle n'entre en scène qu'aux deux tiers
 * d'un scroll de 320 % : trois frames (début, milieu, fin) suffisent à garantir
 * qu'aucun calque vide n'apparaîtra à la soudure, et le reste arrive très
 * largement avant que le visiteur n'y soit. Faire attendre l'ouverture du
 * scrub sur un jeu B complet, c'est le faire attendre pour rien.
 */
const GATE_B = 3;

interface HeroWeldProps {
  /** Séquence A (1re phase). */
  dirA: string;
  dirMobileA?: string;
  countA: number;
  /** Séquence B (2e phase). */
  dirB: string;
  dirMobileB?: string;
  countB: number;
  /** Frames de chevauchement du crossfade (soudure A→B). */
  crossfade?: number;
  posterA?: string;
  title: string;
  /** Sous-titre affiché pendant la phase A (Saint-Malo). */
  subtitleA?: string;
  /** Sous-titre affiché pendant la phase B (Guadeloupe). */
  subtitleB?: string;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

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
 * Hero d'accueil « soudé » : deux séquences scroll-scrub enchaînées (A puis B)
 * en un seul scroll continu et épinglé. Sur la soudure, un crossfade en opacité
 * (canvas A au-dessus, qui s'efface sur le canvas B) masque le raccord — les
 * deux clips étant « plein bleu », la jointure devient invisible.
 *
 * Fluidité : chargement progressif (jeu 720 clairsemé → dense → jeu pleine
 * résolution substitué frame par frame, cf. lib/hero-frames.ts), dessin canvas
 * piloté par une boucle rAF qui interpole (LERP) vers la cible du scroll —
 * jamais d'update synchrone sur l'event scroll. Reduced-motion / appareil
 * faible → 1re frame A.
 */
export default function HeroWeld({
  dirA,
  dirMobileA,
  countA,
  dirB,
  dirMobileB,
  countB,
  crossfade = 6,
  posterA,
  title,
  subtitleA,
  subtitleB,
}: HeroWeldProps) {
  const tMedia = useTranslations("media");
  const sectionRef = useRef<HTMLElement>(null);
  const canvasARef = useRef<HTMLCanvasElement>(null);
  const canvasBRef = useRef<HTMLCanvasElement>(null);
  const posterRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const subtitleARef = useRef<HTMLParagraphElement>(null);
  const subtitleBRef = useRef<HTMLParagraphElement>(null);
  const framesARef = useRef<FrameBuffer>([]);
  const framesBRef = useRef<FrameBuffer>([]);
  const handleARef = useRef<HeroFramesHandle | null>(null);
  const drawARef = useRef(createDrawState());
  const drawBRef = useRef(createDrawState());
  const targetGRef = useRef(0);
  const currentGRef = useRef(0);
  const revealRef = useRef<gsap.core.Tween | null>(null);

  const [mode, setMode] = useState<Mode>("init");
  const [progressPct, setProgressPct] = useState(0);
  /* Miroir de `mode === "scrub"` lisible depuis la boucle rAF : c'est le gate.
     Tant qu'il est faux, aucun pixel n'est peint sur les canvas — le poster
     tient l'écran, net. */
  const scrubReadyRef = useRef(false);
  useEffect(() => {
    scrubReadyRef.current = mode === "scrub";
  }, [mode]);

  /** `null` avant le montage (pas d'accès navigator au SSR). */
  const [small, setSmall] = useState<boolean | null>(null);
  /** Passe à `true` une seule fois : les transitions de `mode` ne doivent
      jamais relancer (ni annuler) le chargement en cours. */
  const [startLoad, setStartLoad] = useState(false);

  const lowA = dirMobileA ?? dirA;
  const lowB = dirMobileB ?? dirB;
  const resolvedPoster = posterA ?? framePath(dirA, 1);
  const posterIsFirstFrame = resolvedPoster === framePath(dirA, 1);

  /* Priorité réseau : les frames dont dépend l'OUVERTURE du scrub partent en
     <link rel="preload" fetchpriority="high"> dès le HTML, avant même que le
     bundle ne soit parsé. Côté B, ce sont les trois frames de son palier
     minimal : elles conditionnent le gate au même titre que celles de A, et
     les laisser démarrer à l'hydratation coûterait une seconde pleine sur
     réseau lent. Le reste de B suivra tranquillement.

     LE POSTER EN PREMIER, impérativement. À priorité égale le navigateur sert
     dans l'ordre de découverte, et les <link> de l'en-tête précèdent le <img>
     du corps : sans cette ligne, les frames doublent le poster et l'écran
     reste noir plusieurs secondes de plus sur réseau lent. Or c'est le poster
     qui tient le cadre (et le LCP) jusqu'à l'ouverture du scrub. */
  if (dirMobileA) {
    preload(framePath(dirMobileA, 1), {
      as: "image",
      fetchPriority: "high",
      media: "(max-width: 767px)",
    });
    preload(resolvedPoster, {
      as: "image",
      fetchPriority: "high",
      media: "(min-width: 768px)",
    });
  } else {
    preload(resolvedPoster, { as: "image", fetchPriority: "high" });
  }
  for (const index of preloadIndices(countA)) {
    preload(framePath(lowA, index + 1), { as: "image", fetchPriority: "high" });
  }
  for (const index of preloadIndices(countB, GATE_B, false)) {
    preload(framePath(lowB, index + 1), { as: "image", fetchPriority: "high" });
  }

  // Recalcule la taille des 2 canvas (DPR plafonné) puis force un redraw.
  const resize = useCallback(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let changed = false;
    for (const canvas of [canvasARef.current, canvasBRef.current]) {
      if (!canvas) continue;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) continue;
      const nw = Math.round(w * dpr);
      const nh = Math.round(h * dpr);
      if (canvas.width !== nw || canvas.height !== nh) {
        canvas.width = nw;
        canvas.height = nh;
        changed = true;
      }
    }
    if (changed) {
      invalidateDraw(drawARef.current);
      invalidateDraw(drawBRef.current);
    }
  }, []);

  /** Le poster est la frame 1 de A, déjà décodée et servie à la bonne
      résolution par le <picture> : une requête de moins avant l'ouverture. */
  const seedPoster = useCallback(() => {
    const img = posterRef.current;
    if (img && posterIsFirstFrame) handleARef.current?.seedPoster(img);
  }, [posterIsFirstFrame]);

  // Mode au montage (pas d'accès navigator au SSR).
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    setSmall(coarse || window.innerWidth < 768);
    if (prefersReducedMotion() || isWeakDevice()) setMode("static");
    else {
      setMode("loading");
      setStartLoad(true);
    }
  }, []);

  // Chargement progressif des deux séquences. A et B partagent la même base de
  // priorité : leurs paliers s'entrelacent (palier d'ouverture de A, puis celui
  // de B, puis les densifications) au lieu de servir A en entier avant B.
  useEffect(() => {
    if (!startLoad || small === null) return;

    let doneA = 0;
    let totalA = 0;
    let doneB = 0;
    let totalB = 0;
    const bump = () => {
      const total = totalA + totalB;
      setProgressPct(
        total ? Math.min(100, Math.round(((doneA + doneB) / total) * 100)) : 0,
      );
    };

    // B est créée AVANT A, volontairement. Les deux partagent la même base de
    // priorité, la file départageant à égalité par ordre de création : le
    // palier minimal de B (3 frames) passe donc devant le palier d'ouverture
    // de A (12), au lieu d'attendre derrière lui. Comme le gate exige les
    // deux, l'ordre inverse faisait dépendre l'ouverture des quinze frames au
    // lieu des sept réellement nécessaires.
    const b = loadHeroFrames({
      dir: small ? lowB : dirB,
      dirLow: small ? undefined : dirMobileB,
      frameCount: countB,
      base: 0,
      // Position de B dans son propre repère (elle démarre à countA - K).
      getPosition: () => currentGRef.current - (countA - crossfade),
      gateFrames: GATE_B,
      highPriority: GATE_B,
      onGateProgress: (settled, total) => {
        doneB = settled;
        totalB = total;
        bump();
      },
      onFrame: (index) => touchFrame(drawBRef.current, index),
    });
    const a = loadHeroFrames({
      dir: small ? lowA : dirA,
      dirLow: small ? undefined : dirMobileA,
      frameCount: countA,
      base: 0,
      getPosition: () => currentGRef.current,
      posterIsFirstFrame,
      highPriority: PRELOAD_COUNT,
      onGateProgress: (settled, total) => {
        doneA = settled;
        totalA = total;
        bump();
      },
      onFrame: (index) => touchFrame(drawARef.current, index),
    });

    handleARef.current = a;
    framesARef.current = a.frames;
    framesBRef.current = b.frames;
    seedPoster();

    const registration = registerHeroSequence();
    let cancelled = false;

    Promise.all([a.gate, b.gate]).then(([ra, rb]) => {
      if (cancelled) return;
      // GATE : le scrub s'ouvre sur les paliers clairsemés de A ET de B — B
      // avec un palier minimal, juste de quoi ne jamais révéler un calque vide
      // à la soudure. Trop de frames en échec → repli sur le poster fixe.
      setMode(ra.usable && rb.usable ? "scrub" : "static");
    });
    Promise.all([a.done, b.done]).then(() => {
      if (!cancelled) registration.complete();
    });

    return () => {
      cancelled = true;
      registration.release();
      a.cancel();
      b.cancel();
      handleARef.current = null;
    };
  }, [
    startLoad,
    small,
    dirA,
    dirMobileA,
    lowA,
    countA,
    dirB,
    dirMobileB,
    lowB,
    countB,
    crossfade,
    posterIsFirstFrame,
    seedPoster,
  ]);

  // Scrub soudé : pin + cible (G) pilotée par la progression, dessin en rAF.
  const wantsScrub = mode === "loading" || mode === "scrub";
  useGSAP(
    () => {
      if (!wantsScrub) return;
      const section = sectionRef.current;
      if (!section) return;

      ScrollTrigger.config({ ignoreMobileResize: true });
      resize();

      const K = crossfade;
      // « Temps » global de la soudure : A (0…countA-1) puis B, en partageant K
      // frames de chevauchement. G = nombre de pas de scroll distincts.
      const G = countA + countB - K;

      const state = { g: 0 };
      gsap.to(state, {
        g: G - 1,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "+=320%",
          pin: true,
          scrub: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const p = self.progress;
            if (p > 0) revealRef.current?.progress(1);
            // Le titre reste visible EN PERMANENCE (aucun fondu de l'overlay) ;
            // seul un léger parallaxe vertical accompagne le scroll. Le sous-titre
            // A→B est piloté séparément par le rAF (crossfade de la soudure).
            if (overlayRef.current) {
              overlayRef.current.style.transform = `translateY(${-p * 26}px)`;
            }
          },
        },
        onUpdate: () => {
          targetGRef.current = state.g;
        },
      });

      const SMOOTH = 0.13;
      let last = performance.now();
      let raf = requestAnimationFrame(function tick(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const alpha = 1 - Math.pow(1 - SMOOTH, dt * 60);
        const ready = scrubReadyRef.current;
        // Pas encore prêt : on suit la cible sans amortir ni dessiner, pour
        // que l'ouverture du gate tombe pile sur la bonne frame.
        if (!ready) {
          currentGRef.current = targetGRef.current;
          raf = requestAnimationFrame(tick);
          return;
        }
        const g = (currentGRef.current += (targetGRef.current - currentGRef.current) * alpha);

        // Positions A / B gardées FRACTIONNAIRES : c'est drawFrames qui fond
        // la frame N vers la suivante décodée (crossfade inter-frames). Un
        // arrondi ici remettrait les paliers qu'on cherche à effacer.
        const aIdx = Math.min(g, countA - 1);
        const bIdx = Math.max(0, Math.min(g - (countA - K), countB - 1));
        let aOpacity: number;
        if (g <= countA - K) aOpacity = 1;
        else if (g >= countA) aOpacity = 0;
        else aOpacity = 1 - (g - (countA - K)) / K;

        drawFrames(canvasBRef.current, framesBRef.current, drawBRef.current, bIdx);
        drawFrames(canvasARef.current, framesARef.current, drawARef.current, aIdx);
        if (canvasARef.current) {
          canvasARef.current.style.opacity = String(aOpacity);
        }
        // Les 2 sous-titres suivent le scrub : A (Saint-Malo) s'efface pendant
        // la soudure et B (Guadeloupe) apparaît, au rythme exact du crossfade.
        if (subtitleARef.current) {
          subtitleARef.current.style.opacity = String(aOpacity);
        }
        if (subtitleBRef.current) {
          subtitleBRef.current.style.opacity = String(1 - aOpacity);
        }
        raf = requestAnimationFrame(tick);
      });

      const onResize = () => resize();
      window.addEventListener("resize", onResize);
      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
      };
    },
    { scope: sectionRef, dependencies: [wantsScrub, countA, countB, crossfade] },
  );

  // Révélation douce de l'overlay (désactivée en reduced-motion).
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
      {/* Poster SSR = 1re frame de A (sous les canvas / repli reduced-motion).
          Le <source> mobile évite de tirer un poster 1920px sur un téléphone
          qui ne servira que les frames 720px — choix fait avant tout JS.

          PAS de -z-10 : la <section> n'a pas de z-index propre, et une fois
          épinglée elle passe en `position: fixed` — donc en contexte
          d'empilement. Un enfant à z négatif se peint alors DERRIÈRE le fond
          `bg-ink` de la section : le poster restait invisible, et l'écran noir
          jusqu'à l'ouverture du scrub. En z-auto, les enfants positionnés se
          peignent dans l'ordre du DOM : poster, puis canvas par-dessus. */}
      <picture>
        {dirMobileA && (
          <source media="(max-width: 767px)" srcSet={framePath(dirMobileA, 1)} />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={posterRef}
          src={resolvedPoster}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          onLoad={seedPoster}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </picture>

      {showCanvas && (
        <>
          {/* Calque B (dessous) — toujours opaque. */}
          <canvas
            ref={canvasBRef}
            aria-hidden="true"
            className="absolute inset-0 h-full w-full"
          />
          {/* Calque A (dessus) — s'efface sur la soudure (crossfade). */}
          <canvas
            ref={canvasARef}
            aria-hidden="true"
            className="absolute inset-0 h-full w-full"
          />
        </>
      )}

      {/* Voile dégradé pour la lisibilité du titre clair (renforcé en bas,
          où se pose le texte — reste lisible sur eau claire / ciel / sable). */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(79, 74, 68,0.34) 0%, rgba(79, 74, 68,0.10) 38%, rgba(79, 74, 68,0.30) 70%, rgba(79, 74, 68,0.66) 100%)",
        }}
      />

      {/* Indicateur de préchargement — filet kaki + pastille de pourcentage,
          discrets, en bas du héros. Il suit les PALIERS D'OUVERTURE : le scroll
          de la page reste libre, et la densification comme le jeu pleine
          résolution continuent en silence une fois le scrub lancé. */}
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
              style={{ width: `${progressPct}%`, backgroundColor: "#B3B49A" }}
            />
          </div>
        </div>
      )}

      {/* Overlay marque. Ombre portée (héritée par le titre + sous-titres) pour
          garantir la lisibilité du texte blanc sur toutes les frames. */}
      <div
        ref={overlayRef}
        className="shell-wide relative z-10 w-full pb-[14vh] sm:pb-[12vh]"
        style={{
          textShadow:
            "0 2px 16px rgba(40, 36, 32,0.5), 0 1px 4px rgba(40, 36, 32,0.42)",
        }}
      >
        {title && <h1 className="display-1 max-w-4xl text-paper">{title}</h1>}
        {(subtitleA || subtitleB) && (
          <div className="relative mt-7 max-w-xl">
            {/* A (Saint-Malo) définit la hauteur ; B (Guadeloupe) se superpose. */}
            <p
              ref={subtitleARef}
              className="hero-sub text-paper/90"
            >
              {subtitleA}
            </p>
            <p
              ref={subtitleBRef}
              className="hero-sub absolute inset-0 text-paper/90 opacity-0"
            >
              {subtitleB}
            </p>
          </div>
        )}
      </div>

    </section>
  );
}
