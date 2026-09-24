"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import SafeImage from "./SafeImage";

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

interface HeroProps {
  variant: "brand" | "appartement";
  title: string;
  /** Complément du H1 invisible à l'écran (voir ScrollHero.titleSuffix). */
  titleSuffix?: string;
  subtitle?: string;
  kicker?: string;
  scrollLabel?: string;
  /** Chemin du média (image), ex. la photo principale du logement. */
  media: string;
  mediaLabel?: string;
  /** Texte alternatif de la photo (défaut : le titre). */
  mediaAlt?: string;
  /**
   * Titre et sous-titre affichés d'emblée, sans révélation SplitText (la
   * parallaxe et le Ken Burns restent). Pages destination : le texte du
   * héros est l'élément LCP mobile, il ne doit pas attendre le JS.
   */
  staticText?: boolean;
}

export default function Hero({
  variant,
  title,
  titleSuffix,
  subtitle,
  kicker,
  scrollLabel,
  media,
  mediaLabel,
  mediaAlt,
  staticText = false,
}: HeroProps) {
  const root = useRef<HTMLElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const sideRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduce) return;

      // Parallaxe douce du média au scroll. Le conteneur est sur-dimensionné
      // (voir -top/h ci-dessous) pour absorber la translation sans exposer de bord.
      gsap.to(mediaRef.current, {
        yPercent: 10,
        ease: "none",
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });

      if (staticText) return;

      // Révélation SplitText du titre (une fois les polices prêtes).
      let split: SplitText | null = null;
      const setup = () => {
        if (!titleRef.current) return;
        // Seul le titre visible est découpé : le complément `sr-only` reste
        // un texte d'un bloc, hors animation.
        const target =
          titleRef.current.querySelector<HTMLElement>("[data-split]") ??
          titleRef.current;
        split = SplitText.create(target, {
          type: "lines",
          mask: "lines",
          // Découpe en lignes seulement : le texte reste lisible tel quel,
          // pas d'aria-label (interdit sur un <span> sans rôle).
          aria: "none",
          linesClass: "hero-line",
        });
        // Les lignes sont déjà décalées hors champ (mask) : on peut révéler le
        // conteneur sans flash, puis animer les lignes.
        gsap.set(titleRef.current, { autoAlpha: 1 });
        const tl = gsap.timeline({ delay: 0.1 });
        tl.from(split.lines, {
          yPercent: 115,
          duration: 1.15,
          ease: "power4.out",
          stagger: 0.12,
        });
        if (sideRef.current) {
          tl.from(
            sideRef.current.children,
            {
              autoAlpha: 0,
              y: 16,
              duration: 0.9,
              ease: "power3.out",
              stagger: 0.12,
            },
            "-=0.7",
          );
        }
      };

      if (document.fonts?.ready) {
        document.fonts.ready.then(setup);
      } else {
        setup();
      }

      return () => split?.revert();
    },
    { scope: root },
  );

  const isBrand = variant === "brand";

  return (
    <section
      ref={root}
      data-hero
      className="relative flex h-[100svh] min-h-[34rem] w-full items-end overflow-hidden"
    >
      {/* ===== HERO SLOT =====
          Scott remplace le média ici :
          - vidéo scrub GSAP ScrollTrigger (image→vidéo IA)
          - OU splat (Luma/Polycam)
          - OU image Ken Burns (défaut actuel)
          Garder le fallback Ken Burns si pas de média.
          `media` = photo principale du logement (/images/accueil/…) ;
          tant qu'elle n'existe pas, <SafeImage> affiche un placeholder charbon.
          ===================== */}
      <div ref={mediaRef} className="absolute inset-x-0 -top-[16%] -z-20 h-[132%]">
        <SafeImage
          src={media}
          alt={mediaAlt ?? title}
          tone="dark"
          priority
          sizes="100vw"
          label={mediaLabel}
          className="h-full w-full"
          imgClassName="ken-burns"
        />
      </div>

      {/* Voile dégradé pour la lisibilité du titre */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(180deg, rgba(79, 74, 68,0.34) 0%, rgba(79, 74, 68,0.12) 38%, rgba(79, 74, 68,0.30) 72%, rgba(79, 74, 68,0.62) 100%)",
        }}
      />

      <div className="shell-wide relative z-10 w-full pb-[14vh] sm:pb-[12vh]">
        <div className="max-w-4xl">
          {kicker && (
            <p className="kicker mb-6 text-paper/85">{kicker}</p>
          )}
          <h1
            ref={titleRef}
            className={
              isBrand
                ? `${staticText ? "" : "hero-title "}display-1 text-paper`
                : `${staticText ? "" : "hero-title "}font-display text-[clamp(2.4rem,6.5vw,5.5rem)] leading-[0.98] text-paper`
            }
          >
            <span data-split>{title}</span>
            {titleSuffix && <span className="sr-only">{titleSuffix}</span>}
          </h1>

          <div ref={sideRef} className="mt-7 max-w-xl">
            {subtitle && (
              <p className="hero-sub text-paper/90">{subtitle}</p>
            )}
          </div>
        </div>
      </div>

      {/* Indicateur de scroll */}
      <a
        href="#contenu"
        aria-label={scrollLabel ?? "Découvrir"}
        className="group absolute bottom-7 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 sm:flex"
      >
        <span className="kicker text-paper/75 transition-colors group-hover:text-paper">
          {scrollLabel ?? "Découvrir"}
        </span>
        <span className="relative h-9 w-px overflow-hidden bg-paper/30">
          <span className="absolute inset-0 animate-[scrollcue_2.2s_var(--ease-out-soft)_infinite] bg-paper" />
        </span>
      </a>
    </section>
  );
}
