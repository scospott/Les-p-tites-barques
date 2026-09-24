"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { heroLoadProfile } from "@/lib/hero-prefetch";
import { isSanityImage, sanitySrcSet } from "@/sanity/image";

interface SafeImageProps {
  /**
   * Chemin attendu, ex: "/images/la-vigie/01.jpg".
   * Absent → placeholder permanent (emplacement « photo à venir »).
   */
  src?: string;
  alt: string;
  /** Libellé discret affiché dans le placeholder (défaut: nom du fichier). */
  label?: string;
  /** Ratio CSS, ex: "16/9", "4/5". Si absent, occupe la hauteur du parent. */
  ratio?: string;
  /** Teinte du placeholder. "dark" pour les héros (titre blanc lisible). */
  tone?: "light" | "dark";
  /** Ajustement de l'image. "contain" pour voir la photo entière (lettrage). */
  fit?: "cover" | "contain";
  priority?: boolean;
  sizes?: string;
  className?: string;
  /** Classe sur l'image elle-même (object-position, ken-burns…). */
  imgClassName?: string;
  /**
   * Style en ligne sur l'image. Réservé aux valeurs qui viennent des DONNÉES
   * (un `objectPosition` par photo, par exemple) : une classe Tailwind
   * construite dynamiquement ne serait pas générée.
   */
  imgStyle?: CSSProperties;
  /**
   * La photo n'est demandée qu'à l'approche du viewport, avec la même marge
   * que les héros différés (cf. heroLoadProfile). Pour les grandes photos
   * sous un héros scroll-scrub : avant l'hydratation, le héros n'a pas
   * encore sa hauteur de scroll et le `loading="lazy"` natif les tirerait
   * dès l'arrivée sur la page.
   */
  deferUntilNear?: boolean;
}

function filenameLabel(src: string): string {
  const parts = src.split("/").filter(Boolean);
  const file = parts.at(-1) ?? src;
  const dir = parts.at(-2);
  return dir ? `${dir} / ${file}` : file;
}

/**
 * Image « drop-in » : un placeholder élégant reste sous l'image. Dès que le
 * vrai fichier existe dans /public, il se charge et apparaît en fondu.
 * Aucun visuel cassé, jamais.
 */
export default function SafeImage({
  src,
  alt,
  label,
  ratio,
  tone = "light",
  fit = "cover",
  priority = false,
  sizes,
  className = "",
  imgClassName = "",
  imgStyle,
  deferUntilNear = false,
}: SafeImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [near, setNear] = useState(!deferUntilNear);
  const rootRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const dark = tone === "dark";

  // Si l'image est déjà chargée avant l'hydratation (cache, image priority),
  // les événements onLoad/onError ne se déclenchent pas : on vérifie à la main.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete) {
      if (img.naturalWidth > 0) setLoaded(true);
      else setFailed(true);
    }
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (near || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: heroLoadProfile().deferredMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  return (
    <div
      ref={rootRef}
      className={`relative isolate overflow-hidden ${dark ? "bg-ink" : "bg-offwhite"} ${className}`}
      style={ratio ? { aspectRatio: ratio } : undefined}
    >
      {/* Placeholder (couche de base) */}
      <div
        aria-hidden={!failed}
        className={`absolute inset-0 grid place-items-center transition-opacity duration-700 ${
          loaded ? "opacity-0" : "opacity-100"
        }`}
      >
        {dark && (
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 90% at 50% 18%, #2b2825 0%, #1c1a18 45%, #121110 100%)",
            }}
          />
        )}
        <div
          className={`absolute inset-3 rounded-[2px] border ${
            dark ? "border-sand/25" : "border-sand/40"
          }`}
        />
        <div className="relative flex flex-col items-center gap-3 px-4 text-center">
          <svg
            width="46"
            height="20"
            viewBox="0 0 46 20"
            fill="none"
            className="text-sand"
            aria-hidden="true"
          >
            <path
              d="M1 13c4 0 4-4 8-4s4 4 8 4 4-4 8-4 4 4 8 4 4-4 8-4"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          <span
            className={`text-eyebrow uppercase tracking-[0.2em] ${
              dark ? "text-paper/55" : "text-ink-faint"
            }`}
          >
            {label ?? (src ? filenameLabel(src) : "Photo à venir")}
          </span>
        </div>
      </div>

      {/* Vraie photo (apparaît si le fichier existe) */}
      {src && near && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          // Photos du CDN Sanity : srcset (format et largeur au plus juste,
          // cf. sanity/image.ts). Photos locales : servies telles quelles.
          {...(isSanityImage(src) ? sanitySrcSet(src) : { src })}
          alt={alt}
          sizes={sizes ?? (isSanityImage(src) ? "100vw" : undefined)}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={imgStyle}
          className={`absolute inset-0 h-full w-full ${
            fit === "contain" ? "object-contain" : "object-cover"
          } transition-opacity duration-[1200ms] ease-out ${
            loaded && !failed ? "opacity-100" : "opacity-0"
          } ${imgClassName}`}
        />
      )}
    </div>
  );
}
