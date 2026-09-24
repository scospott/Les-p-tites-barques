"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, extend, useFrame, useThree, type ThreeElement } from "@react-three/fiber";
import { Image, useCursor } from "@react-three/drei";
import * as THREE from "three";

import { useTranslations } from "next-intl";
import SafeImage from "./SafeImage";
import { isSanityImage, sanityImageUrl } from "@/sanity/image";

/** Libellés traduits de la galerie (page → composant, via next-intl). */
interface GalleryTexts {
  hint: string;
  close: string;
  prev: string;
  next: string;
  photo: (index: number) => string;
  enlarge: (index: number) => string;
  title: string;
}

/* ============================================================
   Galerie 3D — carrousel en ANNEAU FERMÉ, façon pmndrs
   « cards-with-border-radius »
   (réf. https://pmndrs.github.io/examples/cards-with-border-radius/).

   N cartes-images courbées à coins arrondis disposées en cercle ; un <Rig> fait
   tourner l'anneau UNIQUEMENT au drag/swipe (cliquer-glisser souris, swipe au
   doigt). La molette N'EST PLUS interceptée : elle défile la page normalement
   (aucune scrollbar interne, aucun piège au scroll).
   Survol = mise en avant (scale + zoom + coins + léger lift) avec useCursor.
   Clic simple sur une carte = lightbox plein écran (overlay sombre, image en
   grand, flèches préc./suiv., clic dehors ou Échap pour fermer).

   API drei (vérifiée sur la version installée, drei 10.x) :
   - <Image url|texture radius zoom transparent side> : `radius` = rayon des
     coins en unités-monde ; accepte une géométrie enfant (plane bombée) via
     <bentPlaneGeometry> enregistrée par extend().
   - useCursor(hovered) pour le curseur au survol ; le curseur grab/grabbing est
     porté par le canvas (drag).
   Rotation pilotée par les pointer events sur le canvas + amortissement
   THREE.MathUtils.damp (pas de dépendance maath, pas de ScrollControls).

   Replis :
   - mobile (pointer coarse / écran étroit), prefers-reduced-motion, appareil
     faible ou pas de WebGL → carrousel 2D horizontal (scroll-snap), cliquable.
   - image absente → placeholder clair élégant au bon ratio (texture générée) /
     <SafeImage> en 2D.
   ============================================================ */

export interface Gallery3DProps {
  /** Photos de la galerie (chemins /public), dans l'ordre d'affichage. */
  images: string[];
  /** Texte alternatif de chaque photo (même ordre). Absent → « {nom} — photo N ». */
  alts?: string[];
  /**
   * Nombre minimal de cartes de l'anneau. Si `images` en compte moins, les
   * emplacements restants affichent un placeholder élégant (galerie incomplète).
   */
  count?: number;
  /** Libellé discret du logement (placeholders + a11y). */
  label?: string;
}

/* Géométrie des cartes (unités-monde) — PORTRAIT 2:3, le format des photos de
   galerie livrées (1024×1536). Les plans larges (héros, photo principale) sont
   recadrés au centre par le shader de <Image>, qui fait un « cover » exact
   (cf. uniforms scale/imageBounds) : jamais d'étirement, quel que soit le
   ratio de la source. */
const CARD_W = 1.4;
const CARD_H = 2.1;
const BEND = 0.05; // courbure des cartes (faible → bords peu inclinés)
const RADIUS_REST = 0.14; // coins arrondis au repos (unités-monde)
const RADIUS_HOVER = 0.2;
const ZOOM_REST = 1.2; // image légèrement recadrée au repos
const ZOOM_HOVER = 1; // image entière au survol

/**
 * Rayon de l'anneau : l'entraxe entre deux cartes voisines vaut exactement
 * `CARD_W * SPACING`. Facteur resserré (1.2) → cartes plus proches, anneau plus
 * dense, tout en gardant une marge nette (entraxe 1.8 vs largeur 1.5) pour ne
 * pas se chevaucher à la rotation ni au survol (scale 1.12).
 */
function ringRadius(count: number): number {
  const SPACING = 1.2;
  return (CARD_W * SPACING) / (2 * Math.sin(Math.PI / Math.max(count, 3)));
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Mobile : pointeur grossier ou écran étroit → on préfère le carrousel 2D. */
function isMobile(): boolean {
  return (
    window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768
  );
}

/** Même heuristique « appareil faible » que <ScrollHero>. */
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

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return (
      !!window.WebGLRenderingContext &&
      !!(canvas.getContext("webgl2") || canvas.getContext("webgl"))
    );
  } catch {
    return false;
  }
}

/**
 * Plane bombée (bent plane) — reprend l'algorithme de maath.geometry sans la
 * dépendance : on courbe la plane le long de sa largeur autour d'un arc.
 */
class BentPlaneGeometry extends THREE.PlaneGeometry {
  constructor(
    radius: number,
    width = 1,
    height = 1,
    widthSegments = 20,
    heightSegments = 1,
  ) {
    super(width, height, widthSegments, heightSegments);
    const p = this.parameters;
    const hw = p.width * 0.5;
    const a = new THREE.Vector2(-hw, 0);
    const b = new THREE.Vector2(0, radius);
    const c = new THREE.Vector2(hw, 0);
    const ab = new THREE.Vector2().subVectors(a, b);
    const bc = new THREE.Vector2().subVectors(b, c);
    const ac = new THREE.Vector2().subVectors(a, c);
    const r =
      (ab.length() * bc.length() * ac.length()) / (2 * Math.abs(ab.cross(ac)));
    const center = new THREE.Vector2(0, radius - r);
    const baseV = new THREE.Vector2().subVectors(a, center);
    const baseAngle = baseV.angle() - Math.PI * 0.5;
    const arc = baseAngle * 2;
    const uv = this.attributes.uv;
    const pos = this.attributes.position;
    const mainV = new THREE.Vector2();
    for (let i = 0; i < uv.count; i += 1) {
      const uvRatio = 1 - uv.getX(i);
      const y = pos.getY(i);
      mainV.copy(c).rotateAround(center, arc * uvRatio);
      pos.setXYZ(i, mainV.x, y, -mainV.y);
    }
    pos.needsUpdate = true;
    this.computeVertexNormals();
  }
}

// Enregistre <bentPlaneGeometry> comme élément JSX géré par R3F : c'est R3F qui
// crée/dispose la géométrie au montage/démontage (et la recrée proprement sous
// React StrictMode), ce qui évite tout dispose() manuel piégeux.
extend({ BentPlaneGeometry });

declare module "@react-three/fiber" {
  interface ThreeElements {
    bentPlaneGeometry: ThreeElement<typeof BentPlaneGeometry>;
  }
}

/**
 * Texture de repli « placeholder clair » dessinée sur un canvas — cohérente
 * avec la palette (paper-soft, filet + vague stone, numéro encre).
 * Déterministe (aucun aléatoire). Remplacée par la vraie photo dès qu'elle
 * existe.
 */
function makePlaceholderTexture(index: number): THREE.Texture {
  const w = 512;
  const h = Math.round((512 * CARD_H) / CARD_W);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(1, "#efece8");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Cadre intérieur (filet stone)
  ctx.strokeStyle = "rgba(154,143,128,0.5)";
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, w - 32, h - 32);

  // Vague (stone)
  ctx.strokeStyle = "rgba(154,143,128,0.9)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  const cx = w / 2;
  const cy = h / 2;
  ctx.beginPath();
  for (let k = 0; k <= 48; k += 1) {
    const t = k / 48;
    const x = cx - 92 + t * 184;
    const y = cy - 18 + Math.sin(t * Math.PI * 4) * 8;
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Numéro discret (encre douce)
  ctx.fillStyle = "rgba(107,104,100,0.65)";
  ctx.font = "600 24px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(String(index + 1).padStart(2, "0"), cx, cy + 40);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Charge la vraie photo ; renvoie un placeholder tant qu'elle est absente.
 * `url` null = emplacement sans photo (galerie incomplète) → placeholder seul.
 */
function useCardTexture(url: string | null, index: number): THREE.Texture {
  const placeholder = useMemo(() => makePlaceholderTexture(index), [index]);
  const [texture, setTexture] = useState<THREE.Texture>(placeholder);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.load(
      // Photo Sanity : 1200 px et format moderne (AVIF/WebP) suffisent à une
      // carte du carrousel ; l'original (2400 px) reste pour la lightbox.
      isSanityImage(url) ? sanityImageUrl(url, 1200) : url,
      (tex) => {
        if (cancelled) return;
        tex.colorSpace = THREE.SRGBColorSpace;
        setTexture(tex);
      },
      undefined,
      () => {
        /* fichier absent → on garde le placeholder */
      },
    );
    return () => {
      cancelled = true;
    };
  }, [url]);

  return texture;
}

interface CardProps {
  index: number;
  url: string | null;
  position: [number, number, number];
  rotation: [number, number, number];
}

function Card({ index, url, position, rotation }: CardProps) {
  const ref = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const texture = useCardTexture(url, index);
  const base = useMemo(() => new THREE.Vector3(...position), [position]);
  const lift = useRef(0);

  // L'index est lu par le raycast du <Rig> (clic → lightbox).
  useEffect(() => {
    if (ref.current) ref.current.userData.cardIndex = index;
  }, [index]);

  useFrame((_, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    lift.current = THREE.MathUtils.damp(lift.current, hovered ? 1 : 0, 8, delta);

    // Mise en avant : la carte avance (radialement) et se soulève un peu.
    mesh.position.copy(base).multiplyScalar(1 + lift.current * 0.06);
    mesh.position.y = lift.current * 0.08;

    const scale = 1 + lift.current * 0.12;
    mesh.scale.setScalar(scale);

    const mat = mesh.material as unknown as { radius: number; zoom: number };
    if (mat) {
      mat.radius = THREE.MathUtils.lerp(RADIUS_REST, RADIUS_HOVER, lift.current);
      mat.zoom = THREE.MathUtils.lerp(ZOOM_REST, ZOOM_HOVER, lift.current);
    }
  });

  return (
    <Image
      ref={ref}
      texture={texture}
      radius={RADIUS_REST}
      zoom={ZOOM_REST}
      transparent
      side={THREE.DoubleSide}
      position={position}
      rotation={rotation}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Plane bombée gérée par R3F (création/dispose auto, StrictMode-safe). */}
      <bentPlaneGeometry args={[BEND, CARD_W, CARD_H, 24, 1]} />
    </Image>
  );
}

function Carousel({
  images,
  count,
  radius,
}: {
  images: string[];
  count: number;
  radius: number;
}) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const theta = (i / count) * Math.PI * 2;
        return (
          <Card
            key={i}
            index={i}
            url={images[i] ?? null}
            position={[Math.sin(theta) * radius, 0, Math.cos(theta) * radius]}
            rotation={[0, theta, 0]}
          />
        );
      })}
    </>
  );
}

/**
 * Fait tourner l'anneau UNIQUEMENT au drag/swipe (souris + tactile) via les
 * pointer events du canvas ; parallaxe douce. La molette n'est pas interceptée
 * (la page défile). Détecte aussi le « tap » (clic sans drag) et raycaste pour
 * ouvrir la lightbox sur la carte cliquée.
 */
function Rig({
  children,
  onCardClick,
}: {
  children: ReactNode;
  onCardClick: (index: number) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const { camera, raycaster, gl } = useThree();
  const drag = useRef({
    rot: 0,
    target: 0,
    active: false,
    lastX: 0,
    downX: 0,
    downY: 0,
    moved: false,
  });

  useEffect(() => {
    const el = gl.domElement; // le canvas WebGL

    const onDown = (e: PointerEvent) => {
      const d = drag.current;
      d.active = true;
      d.lastX = e.clientX;
      d.downX = e.clientX;
      d.downY = e.clientY;
      d.moved = false;
      el.setPointerCapture?.(e.pointerId);
      el.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d.active) return;
      const dx = e.clientX - d.lastX;
      d.lastX = e.clientX;
      d.target += dx * 0.005;
      if (Math.abs(e.clientX - d.downX) > 5 || Math.abs(e.clientY - d.downY) > 5) {
        d.moved = true;
      }
    };
    const reset = (e: PointerEvent) => {
      drag.current.active = false;
      el.releasePointerCapture?.(e.pointerId);
      el.style.cursor = "grab";
    };
    const onUp = (e: PointerEvent) => {
      const d = drag.current;
      if (!d.active) return;
      const moved = d.moved;
      reset(e);
      if (moved) return; // un drag ne déclenche pas la lightbox

      // Tap (pas de drag) → raycast pour trouver la carte sous le pointeur.
      const grp = ref.current;
      if (!grp) return;
      const rect = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(grp.children, true);
      for (const h of hits) {
        let o: THREE.Object3D | null = h.object;
        while (o) {
          if (typeof o.userData.cardIndex === "number") {
            onCardClick(o.userData.cardIndex);
            return;
          }
          o = o.parent;
        }
      }
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", reset);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", reset);
    };
  }, [camera, raycaster, gl, onCardClick]);

  useFrame((state, delta) => {
    drag.current.rot = THREE.MathUtils.damp(
      drag.current.rot,
      drag.current.target,
      6,
      delta,
    );
    if (ref.current) {
      ref.current.rotation.y = drag.current.rot;
    }
    // Met à jour le raycaster pour garder le survol réactif pendant la rotation.
    state.events.update?.();
    // Parallaxe douce de la caméra au pointeur.
    state.camera.position.x = THREE.MathUtils.damp(
      state.camera.position.x,
      -state.pointer.x * 0.5,
      4,
      delta,
    );
    state.camera.position.y = THREE.MathUtils.damp(
      state.camera.position.y,
      state.pointer.y * 0.3,
      4,
      delta,
    );
    state.camera.lookAt(0, 0, 0);
  });

  return <group ref={ref}>{children}</group>;
}

/**
 * Repli carrousel 2D horizontal (scroll-snap), cliquable → lightbox.
 * Les emplacements sans photo (galerie incomplète) affichent le placeholder
 * <SafeImage>, non cliquable.
 */
function Carousel2D({
  images,
  count,
  label,
  texts,
  onCardClick,
}: {
  images: string[];
  count: number;
  label?: string;
  texts: GalleryTexts;
  onCardClick: (index: number) => void;
}) {
  return (
    <div className="shell-wide">
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
        {Array.from({ length: count }, (_, i) => {
          const src = images[i];
          const card = (
            <SafeImage
              src={src}
              alt={src ? texts.photo(i + 1) : ""}
              label={label}
              // Même cadre portrait qu'en 3D ; `object-cover` (défaut de
              // SafeImage) recadre les plans larges sans les déformer.
              ratio={`${CARD_W}/${CARD_H}`}
              sizes="(min-width:1024px) 24vw, (min-width:640px) 36vw, 68vw"
              className="rounded-[12px] border border-line"
            />
          );
          return src ? (
            <button
              key={i}
              type="button"
              onClick={() => onCardClick(i)}
              aria-label={texts.enlarge(i + 1)}
              className="w-[68%] shrink-0 cursor-pointer snap-center sm:w-[36%] lg:w-[24%]"
            >
              {card}
            </button>
          ) : (
            <div
              key={i}
              aria-hidden="true"
              className="w-[68%] shrink-0 snap-center sm:w-[36%] lg:w-[24%]"
            >
              {card}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Lightbox plein écran — overlay sombre, image en grand, préc./suiv., Échap. */
function Lightbox({
  images,
  index,
  texts,
  onClose,
  onNavigate,
}: {
  images: string[];
  index: number;
  texts: GalleryTexts;
  onClose: () => void;
  onNavigate: (delta: number) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onNavigate(-1);
      else if (e.key === "ArrowRight") onNavigate(1);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, onNavigate]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={texts.title}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/95 backdrop-blur-sm"
    >
      {/* Fermer */}
      <button
        type="button"
        aria-label={texts.close}
        onClick={onClose}
        className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full text-paper/80 transition-colors hover:bg-paper/10 hover:text-paper"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      {/* Précédent */}
      <button
        type="button"
        aria-label={texts.prev}
        onClick={(e) => {
          e.stopPropagation();
          onNavigate(-1);
        }}
        className="absolute left-3 z-10 grid h-12 w-12 place-items-center rounded-full text-paper/80 transition-colors hover:bg-paper/10 hover:text-paper sm:left-6"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>

      {/* Image */}
      <figure onClick={(e) => e.stopPropagation()} className="px-14 sm:px-20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[index]}
          alt={texts.photo(index + 1)}
          className="max-h-[86vh] max-w-[88vw] rounded-[4px] object-contain shadow-2xl"
        />
      </figure>

      {/* Suivant */}
      <button
        type="button"
        aria-label={texts.next}
        onClick={(e) => {
          e.stopPropagation();
          onNavigate(1);
        }}
        className="absolute right-3 z-10 grid h-12 w-12 place-items-center rounded-full text-paper/80 transition-colors hover:bg-paper/10 hover:text-paper sm:right-6"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>

      {/* Compteur */}
      <p className="kicker pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-paper/70">
        {index + 1} / {images.length}
      </p>
    </div>
  );
}

export default function Gallery3D({ images, alts, count, label }: Gallery3DProps) {
  const t = useTranslations("apartment");
  const name = label ?? t("galleryTitle");
  const texts: GalleryTexts = useMemo(
    () => ({
      hint: t("galleryHint"),
      close: t("galleryClose"),
      prev: t("galleryPrev"),
      next: t("galleryNext"),
      photo: (index: number) =>
        alts?.[index - 1] || t("galleryPhoto", { name, index }),
      enlarge: (index: number) => t("galleryEnlarge", { name, index }),
      title: `${name} — ${t("galleryTitle")}`,
    }),
    [t, name, alts],
  );
  // "pending" au SSR / 1er paint : on ne monte pas le <Canvas> côté serveur.
  const [mode, setMode] = useState<"pending" | "3d" | "2d">("pending");
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    if (isMobile() || prefersReducedMotion() || isWeakDevice() || !hasWebGL())
      setMode("2d");
    else setMode("3d");
  }, []);

  // Cartes de l'anneau : toutes les photos, complétées à `count` par des
  // placeholders (galerie incomplète). Minimum 3 pour un anneau lisible.
  const slots = Math.max(images.length, count ?? 0, 3);
  const radius = useMemo(() => ringRadius(slots), [slots]);

  // Seules les cartes-photo ouvrent la lightbox (pas les placeholders).
  const openLightbox = useCallback(
    (i: number) => {
      if (i < images.length) setLightbox(i);
    },
    [images.length],
  );
  const navigate = useCallback(
    (delta: number) =>
      setLightbox((cur) =>
        cur === null ? cur : (cur + delta + images.length) % images.length,
      ),
    [images.length],
  );

  return (
    <>
      {mode === "pending" && (
        // Réserve la hauteur (évite le saut de layout) en attendant l'hydratation.
        <div aria-hidden className="h-[70vh] min-h-[28rem] w-full" />
      )}

      {mode === "2d" && (
        <div className="py-2">
          <Carousel2D
            images={images}
            count={slots}
            label={label}
            texts={texts}
            onCardClick={openLightbox}
          />
        </div>
      )}

      {mode === "3d" && (
        <div className="relative h-[70vh] min-h-[28rem] w-full">
          <Canvas
            dpr={[1, 1.75]}
            gl={{ antialias: true }}
            camera={{ position: [0, 0, radius + 6], fov: 27 }}
            style={{ touchAction: "pan-y", cursor: "grab" }}
          >
            <Rig onCardClick={openLightbox}>
              <Carousel images={images} count={slots} radius={radius} />
            </Rig>
          </Canvas>

          <p className="kicker pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-ink-soft/70">
            ↻ {texts.hint}
          </p>
        </div>
      )}

      {lightbox !== null && (
        <Lightbox
          images={images}
          index={lightbox}
          texts={texts}
          onClose={() => setLightbox(null)}
          onNavigate={navigate}
        />
      )}
    </>
  );
}
