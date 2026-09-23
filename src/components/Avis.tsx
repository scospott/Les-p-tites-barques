"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Reveal from "@/components/Reveal";
import Ornament from "@/components/Ornament";
import type { Review } from "@/lib/appartements";
import type { Locale } from "@/i18n/routing";
import { LOCALE_TAGS, formatRating } from "@/lib/locale";

/* ------------------------------------------------------------------
   Avis (design validé).
   1) Barre récap : note globale + badge générique « Coup de cœur des
      voyageurs » + nombre de commentaires (uniquement les blocs dont la
      donnée existe).
   2) Carrousel défilable de cartes d'avis (avatars initiales) : flèches +
      swipe/scroll natif (scroll-snap), 3 cartes visibles sur desktop,
      1 sur mobile.
   Données depuis lib/appartements.ts (rating / ratingScale / reviewCount /
   reviewBadge / reviews). Avis réels (Airbnb/Booking) — on n'affiche que
   les champs présents (pays, date facultatifs).
   DA : serif Libre Baskerville (note/citations), sans-serif (labels/prénoms/
   stats), terre cuite #A8603C + kaki #656B57 en accent.
   Lisibilité (demande cliente, clientèle de tous âges) : les citations sont
   en serif DROIT (plus d'italique), ≥ 18 px, interligne généreux ; prénoms
   en sans-serif semi-gras bien contrastés.
   ------------------------------------------------------------------ */

const TERRA = "#A8603C"; // terre cuite — étoiles, note, laurier
const KAKI = "#656B57"; // kaki/vert-de-gris — 2e teinte d'avatar
const INK = "#4F4A44"; // taupe — 3e teinte d'avatar
const SERIF = "var(--font-display)";
const AVATAR_COLORS = [TERRA, KAKI, INK];

function Star({ size = 14, color = TERRA }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18.9 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" />
    </svg>
  );
}

/** Laurier « Coup de cœur voyageurs » — deux branches feuillues, terre cuite. */
function LaurelIcon({ size = 30, color = TERRA }: { size?: number; color?: string }) {
  const leaf = (cx: number, cy: number, rot: number, key: string) => (
    <ellipse
      key={key}
      cx={cx}
      cy={cy}
      rx="2.3"
      ry="1.1"
      transform={`rotate(${rot} ${cx} ${cy})`}
      fill={color}
    />
  );
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      {/* tiges */}
      <path d="M12 28C7 25 5 19 6.5 12" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M20 28C25 25 27 19 25.5 12" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      {/* feuilles — gauche */}
      {leaf(9, 23, -20, "l1")}
      {leaf(7, 20, -35, "l2")}
      {leaf(5.7, 16.5, -55, "l3")}
      {leaf(5.5, 13, -75, "l4")}
      {/* feuilles — droite (miroir x=16) */}
      {leaf(23, 23, 20, "r1")}
      {leaf(25, 20, 35, "r2")}
      {leaf(26.3, 16.5, 55, "r3")}
      {leaf(26.5, 13, 75, "r4")}
    </svg>
  );
}

export default function Avis({
  kicker,
  title,
  rating,
  ratingScale = 10,
  reviewCount,
  countLabel,
  badge,
  reviews,
  placeholder,
  locale,
  prevLabel,
  nextLabel,
}: {
  kicker: string;
  title: string;
  rating: number;
  ratingScale?: 5 | 10;
  reviewCount?: number;
  countLabel: string;
  badge?: string | null;
  reviews?: Review[];
  placeholder: string;
  locale: Locale;
  /** Libellés des flèches (traduits par la page). */
  prevLabel: string;
  nextLabel: string;
}) {
  void ratingScale; // récap : on affiche la note seule (pas de « /10 »)
  const ratingStr = formatRating(rating, locale);
  const hasReviews = !!reviews && reviews.length > 0;

  /* Carrousel : piste scroll-snap + flèches. Le swipe/scroll natif reste
     maître ; les flèches font défiler d'une carte (scrollBy fluide). */
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateNav = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    updateNav();
    window.addEventListener("resize", updateNav);
    return () => window.removeEventListener("resize", updateNav);
  }, [updateNav]);

  const scrollByCard = useCallback((dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("figure");
    const step = card ? card.offsetWidth + 16 : el.clientWidth; // 16 = gap-4
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }, []);

  // Date d'avis « AAAA-MM » → « juin 2026 » / « June 2026 ». Champ facultatif.
  const monthFormatter = new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    month: "long",
    year: "numeric",
  });
  const formatMonth = (iso?: string) => {
    if (!iso) return null;
    const [year, month] = iso.split("-").map(Number);
    if (!year || !month) return null;
    return monthFormatter.format(new Date(Date.UTC(year, month - 1, 1)));
  };

  // Badge éventuellement composé (« Libellé · précision ») → titre + sous-ligne.
  const badgeParts = badge ? badge.split("·").map((s) => s.trim()) : [];
  const badgeMain = badgeParts[0] ?? null;
  const badgeSub = badgeParts.slice(1).join(" · ") || null;

  // Blocs de la barre récap : uniquement ceux dont la donnée existe.
  const segments: React.ReactNode[] = [];

  segments.push(
    <div key="rating" className="flex items-center gap-2.5">
      <Star size={26} color={TERRA} />
      <span
        className="leading-none text-ink"
        style={{ fontFamily: SERIF, fontSize: "clamp(2.25rem, 5vw, 3rem)" }}
      >
        {ratingStr}
      </span>
    </div>,
  );

  if (badgeMain) {
    segments.push(
      <div key="badge" className="flex items-center gap-2.5">
        <LaurelIcon size={30} color={TERRA} />
        <div className="text-left">
          <p className="text-body font-semibold leading-tight text-ink">
            {badgeMain}
          </p>
          {badgeSub && (
            <p className="mt-0.5 text-body leading-snug text-ink-faint">
              {badgeSub}
            </p>
          )}
        </div>
      </div>,
    );
  }

  if (typeof reviewCount === "number") {
    segments.push(
      <div key="count" className="flex flex-col items-center">
        <span className="text-[2.1rem] font-semibold leading-none text-ink">
          {reviewCount}
        </span>
        <span className="kicker mt-1.5 text-ink-faint">{countLabel}</span>
      </div>,
    );
  }

  return (
    <section className="bg-offwhite">
      <div className="shell py-20 sm:py-28">
        <Reveal className="text-center">
          <p className="kicker justify-center">{kicker}</p>
          <h2 className="section-title mt-4">{title}</h2>
          <Ornament className="mt-5 justify-center" />
        </Reveal>

        {/* 1. Barre récap — carte blanche, filets verticaux, wrap sur mobile */}
        <Reveal className="mt-10">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-5 rounded-[18px] border-[0.5px] border-line bg-paper px-6 py-6 sm:gap-x-12 sm:px-12 sm:py-8">
            {segments.map((seg, i) => (
              <Fragment key={i}>
                {i > 0 && (
                  <span
                    aria-hidden
                    className="hidden h-11 w-px shrink-0 bg-line sm:block"
                  />
                )}
                {seg}
              </Fragment>
            ))}
          </div>
        </Reveal>

        {/* 2. Carrousel de cartes d'avis — flèches + swipe (scroll-snap) */}
        {hasReviews ? (
          <Reveal className="mt-8">
            {/* Flèches préc./suiv. — grisées en butée */}
            <div className="mb-4 flex justify-end gap-2.5">
              {(
                [
                  { dir: -1, label: prevLabel, enabled: canPrev, d: "m15 18-6-6 6-6" },
                  { dir: 1, label: nextLabel, enabled: canNext, d: "m9 18 6-6-6-6" },
                ] as const
              ).map((b) => (
                <button
                  key={b.dir}
                  type="button"
                  // aria-disabled (et non disabled) : un bouton natif disabled
                  // éjecterait le focus clavier vers <body> en arrivant en butée.
                  onClick={() => b.enabled && scrollByCard(b.dir)}
                  aria-disabled={!b.enabled}
                  aria-label={b.label}
                  className={`grid h-11 w-11 place-items-center rounded-full border-[0.5px] border-line bg-paper text-ink transition-all duration-200 ${
                    b.enabled
                      ? "hover:bg-white hover:shadow-[0_4px_12px_rgba(40, 36, 32,0.10)]"
                      : "cursor-default opacity-30"
                  }`}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d={b.d} />
                  </svg>
                </button>
              ))}
            </div>

            {/* Piste : 1 carte visible mobile, ~2 tablette, 3 desktop */}
            <div
              ref={trackRef}
              onScroll={updateNav}
              className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {reviews!.map((r, i) => {
                const initial = r.name.trim().charAt(0).toUpperCase();
                const month = formatMonth(r.date);
                const meta = [r.country, month].filter(Boolean).join(" · ");
                return (
                  <figure
                    key={i}
                    className="flex w-[88%] flex-none snap-start flex-col rounded-[14px] border-[0.5px] border-line bg-paper p-6 sm:w-[58%] sm:p-7 lg:w-[calc((100%-2rem)/3)]"
                  >
                    {/* Rangée de 5 étoiles terre cuite */}
                    <div className="flex items-center gap-1">
                      {[0, 1, 2, 3, 4].map((s) => (
                        <Star key={s} size={13} color={TERRA} />
                      ))}
                    </div>

                    {/* Citation — serif droit, 18-19 px, interligne 1.7 :
                        lisible par tous (plus d'italique, cf. en-tête). */}
                    <blockquote
                      className="mt-4 flex-1 text-body not-italic leading-[1.7] text-ink"
                      style={{ fontFamily: SERIF }}
                    >
                      « {r.text} »
                    </blockquote>

                    {/* Bas de carte — avatar initiale + prénom + pays si dispo */}
                    <figcaption className="mt-6 flex items-center gap-3.5">
                      <span
                        aria-hidden
                        className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-body font-semibold text-paper"
                        style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                      >
                        {initial}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-body font-semibold text-ink">
                          {r.name}
                        </p>
                        {meta && (
                          <p className="text-body text-ink-soft">
                            {meta}
                          </p>
                        )}
                      </div>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </Reveal>
        ) : (
          <Reveal className="mt-8 rounded-[14px] border-[0.5px] border-dashed border-sand/60 bg-paper/70 p-8">
            <p className="kicker text-ink-faint">
              {placeholder}
            </p>
          </Reveal>
        )}
      </div>
    </section>
  );
}
