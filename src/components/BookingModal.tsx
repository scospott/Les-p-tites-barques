"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import SafeImage from "@/components/SafeImage";
import Ornament from "@/components/Ornament";
import { useApartments } from "@/components/ApartmentsProvider";
import { pick, type Apartment } from "@/lib/appartements";
import type { Locale } from "@/i18n/routing";
import { formatRating } from "@/lib/locale";

/* ------------------------------------------------------------------
   BookingModal — « Choisissez votre logement ». Ouverte par le bouton
   « Réserver » du header : overlay sombre + panneau crème, grille des
   4 logements (photo, note, emplacement, nom — PAS de prix), clic →
   navigation vers la page du logement. Rendue en portal dans <body>
   (le header a un backdrop-filter qui ferait de lui le containing block
   d'un enfant en position:fixed). Animations : globals.css (.booking-modal).
   Typo : une seule serif, corps jamais plus petit que le texte courant.
   ------------------------------------------------------------------ */

const KAKI = "#656B57";

export default function BookingModal({
  open,
  onClose,
  region,
}: {
  open: boolean;
  onClose: () => void;
  /** Limite la grille aux logements d'une destination (CTA des pages destination). */
  region?: Apartment["region"];
}) {
  const t = useTranslations("bookingModal");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const apartments = useApartments();

  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Échap + focus trap + scroll verrouillé + retour du focus à la fermeture.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes =
        panelRef.current?.querySelectorAll<HTMLElement>("button, a[href]");
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  const goTo = (slug: string) => {
    onClose();
    router.push(`/appartements/${slug}`);
  };

  return createPortal(
    <div
      className="booking-modal fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
      style={{ backgroundColor: "rgba(79, 74, 68,.55)" }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        data-bm-panel
        data-lenis-prevent
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-[720px] overflow-y-auto rounded-[22px] p-6 sm:p-9"
        style={{ backgroundColor: "#F8F5F0" }}
      >
        {/* En-tête — eyebrow kaki, titre (échelle des sections), séparateur,
            sous-titre + fermeture */}
        <div className="flex items-start justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="kicker" style={{ color: KAKI }}>
              {t("eyebrow")}
            </p>
            <h2 className="section-title mt-3 text-left">{t("title")}</h2>
            <Ornament className="mt-4" />
            <p className="mt-3 text-body text-ink-soft">{t("subtitle")}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-full text-ink-soft transition-colors duration-200 hover:bg-ink/5 hover:text-ink"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Grille des 4 logements — photo, note, emplacement, nom (pas de prix) */}
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {apartments
            .filter((a) => !region || a.region === region)
            .map((a) => {
            const name = pick(a.name, locale);
            const locality = pick(a.locality, locale);
            const ratingStr =
              typeof a.rating === "number" ? formatRating(a.rating, locale) : null;
            return (
              <button
                key={a.slug}
                type="button"
                onClick={() => goTo(a.slug)}
                aria-label={`${name} — ${t("availability")}`}
                className="group cursor-pointer overflow-hidden rounded-[16px] border-[0.5px] border-line bg-white text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(79, 74, 68,0.14)]"
              >
                <div className="relative">
                  <SafeImage
                    src={a.mainImage}
                    alt={name}
                    fit="cover"
                    sizes="(min-width:640px) 320px, 90vw"
                    className="h-[140px] w-full"
                  />
                  {ratingStr && (
                    <span
                      className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-body font-medium leading-none"
                      style={{
                        backgroundColor: "rgba(79, 74, 68,.72)",
                        color: "#F1ECE3",
                        backdropFilter: "blur(4px)",
                      }}
                    >
                      ★ {ratingStr}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <p className="kicker text-ink-faint">{locality}</p>
                  <p className="subtitle mt-1.5 text-ink">{name}</p>
                  <p
                    className="mt-2.5 inline-flex items-center gap-1.5 text-body transition-[gap] duration-300 group-hover:gap-2.5"
                    style={{ color: KAKI }}
                  >
                    {t("availability")}
                    <svg
                      width="14"
                      height="9"
                      viewBox="0 0 18 10"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M0 5h16m-4-4 4 4-4 4"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
