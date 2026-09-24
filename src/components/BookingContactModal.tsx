"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

import Ornament from "@/components/Ornament";
import Reveal from "@/components/Reveal";
import { OPEN_BOOKING_EVENT } from "@/lib/booking";

/* ------------------------------------------------------------------
   Réservation — version HONNÊTE, tant qu'aucun moteur n'est branché
   (BOOKING_ENGINE=none, cf. lib/booking.ts).

   Tous les boutons « Réserver » (header, pages destination, fiche,
   assistante) ouvrent cette fenêtre : « la réservation en ligne arrive,
   Gwenaëlle vous répond directement », un lien mailto, le téléphone s'il
   est affiché (Sanity › Site › Contact), et un lien vers l'assistante.
   Pas de prix, pas de calendrier.

   Montée une seule fois (layout) ; ouverte par l'événement global
   OPEN_BOOKING_EVENT. Le même contenu existe en section, sur la fiche
   (<BookingContactPanel>).
   ------------------------------------------------------------------ */

const KAKI = "#656B57";

interface ContactProps {
  email: string;
  /** Présent seulement si « Afficher le téléphone » est coché dans le Studio. */
  phone?: string;
}

/** Les trois façons de joindre Gwenaëlle. */
function ContactActions({
  email,
  phone,
  apartmentName,
  onAssistant,
  centered = false,
}: ContactProps & { apartmentName?: string; onAssistant: () => void; centered?: boolean }) {
  const t = useTranslations("bookingSoon");
  const subject = apartmentName
    ? t("mailSubjectFor", { name: apartmentName })
    : t("mailSubject");
  const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}`;
  const tel = phone?.replace(/[^\d+]/g, "");

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap ${centered ? "sm:justify-center" : ""}`}>
      <a href={mailto} className="btn btn-primary px-7 py-3">
        {t("email")}
      </a>
      {tel && (
        <a href={`tel:${tel}`} className="btn btn-ghost px-7 py-3">
          {t("phone", { phone: phone! })}
        </a>
      )}
      <button type="button" onClick={onAssistant} className="btn btn-ghost cursor-pointer px-7 py-3">
        {t("assistant")}
      </button>
    </div>
  );
}

const openAssistant = () => window.dispatchEvent(new CustomEvent("lesptitesbarques:open-chat"));

/** Fenêtre ouverte par les boutons « Réserver ». */
export default function BookingContactModal({ email, phone }: ContactProps) {
  const t = useTranslations("bookingSoon");
  const [open, setOpen] = useState(false);
  const [apartmentName, setApartmentName] = useState<string | undefined>();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      setApartmentName((e as CustomEvent<{ apartmentName?: string }>).detail?.apartmentName);
      setOpen(true);
    };
    window.addEventListener(OPEN_BOOKING_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_BOOKING_EVENT, onOpen);
  }, []);

  // Échap + focus trap + scroll verrouillé + retour du focus (cf. BookingModal).
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setOpen(false);
      if (e.key !== "Tab") return;
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>("button, a[href]");
      if (!nodes?.length) return;
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
  const close = () => setOpen(false);

  return createPortal(
    <div
      className="booking-modal fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
      style={{ backgroundColor: "rgba(79, 74, 68,.55)" }}
      onClick={close}
    >
      <div
        ref={panelRef}
        data-bm-panel
        data-lenis-prevent
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-soon-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-[560px] overflow-y-auto rounded-[22px] p-6 sm:p-9"
        style={{ backgroundColor: "#F8F5F0" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="kicker" style={{ color: KAKI }}>
              {apartmentName ?? t("kicker")}
            </p>
            <h2 id="booking-soon-title" className="section-title mt-3 text-left">
              {t("title")}
            </h2>
            <Ornament className="mt-4" />
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label={t("close")}
            className="flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-full text-ink-soft transition-colors duration-200 hover:bg-ink/5 hover:text-ink"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <p className="mt-4 text-body text-ink-soft">{t("body")}</p>
        <div className="mt-7">
          <ContactActions
            email={email}
            phone={phone}
            apartmentName={apartmentName}
            onAssistant={() => {
              close();
              openAssistant();
            }}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Même contenu, en section : le bloc « Réserver en direct » de la fiche. */
export function BookingContactPanel({
  email,
  phone,
  apartmentName,
  kicker,
  title,
}: ContactProps & { apartmentName: string; kicker: string; title: string }) {
  const t = useTranslations("bookingSoon");
  return (
    <section id="reserver" className="bg-paper">
      <Reveal className="shell py-20 text-center sm:py-28">
        <p className="kicker justify-center">{kicker}</p>
        <h2 className="section-title mt-4">{title}</h2>
        <Ornament className="mt-5 justify-center" />
        <p className="mx-auto mt-8 max-w-xl text-body text-ink-soft">
          {t("title")} {t("body")}
        </p>
        <div className="mt-9">
          <ContactActions
            email={email}
            phone={phone}
            apartmentName={apartmentName}
            onAssistant={openAssistant}
            centered
          />
        </div>
      </Reveal>
    </section>
  );
}
