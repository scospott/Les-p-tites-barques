"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { isSanityImage, sanityLoader } from "@/sanity/image";
import { useLocale, useTranslations } from "next-intl";

import AssistantAvatar from "@/components/AssistantAvatar";
import AssistantHouseCard from "@/components/AssistantHouseCard";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cleanMarkdown, type Suggestion } from "@/hooks/useAssistantChat";
import { useApartments } from "@/components/ApartmentsProvider";
import { pick, type ApartmentSummary } from "@/lib/appartements";
import type { HouseRef } from "@/lib/assistant-houses";

/* ------------------------------------------------------------------
   Briques d'interface de l'assistante, partagées par la carte de l'accueil
   (AssistantCTA, posée sur une photo) et le panneau flottant (ChatWidget,
   fond crème). `tone` adapte les rares éléments posés directement sur le
   fond : "photo" (texte clair) ou "cream" (texte brun).

   - ApartmentPicker : « De quel logement parle-t-on ? » + grille 2×2.
   - ContextBadge    : « Vous parlez de … · changer ».
   - Thread          : fil à défilement maison (barre native masquée,
                       colonne flèches + indicateur à droite, desktop).
   - UserBubble / BotBubble / TypingBubble.
   - Composer        : champ + bouton d'envoi, puis les pastilles.
   ------------------------------------------------------------------ */

export type AssistantTone = "photo" | "cream";

const TERRA = "#A8603C";
const BROWN = "#4F4A44";
const CREAM = "#FFFAF2";
const SERIF = "var(--font-display)";

/* ---------------- Sélecteur de logement ---------------- */

export function ApartmentPicker({
  onPick,
  tone,
  className = "",
}: {
  /** Slug du logement, ou `null` pour une question générale. */
  onPick: (slug: string | null) => void;
  tone: AssistantTone;
  className?: string;
}) {
  const t = useTranslations("chat");
  const locale = useLocale() as Locale;
  const onPhoto = tone === "photo";
  const apartments = useApartments();

  return (
    <div className={className}>
      <p
        className={`text-center text-[15px] leading-snug ${onPhoto ? "on-photo-kicker text-[#FFFAF2]" : "text-[#4F4A44]"}`}
        style={{ fontFamily: SERIF }}
      >
        {t("pickTitle")}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {apartments.map((a) => {
          const name = pick(a.name, locale);
          return (
            <button
              key={a.slug}
              type="button"
              onClick={() => onPick(a.slug)}
              aria-label={t("pickAria", { name })}
              className="group overflow-hidden rounded-2xl bg-[rgb(255_250_242/0.96)] text-left shadow-[0_4px_16px_rgba(28,26,24,.14)] transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A8603C]"
            >
              <span className="relative block h-[84px] min-[900px]:h-[96px]">
                <Image
                  src={a.mainImage}
                  // Vitrine servie par le CDN Sanity (cf. sanity/image.ts).
                  loader={isSanityImage(a.mainImage) ? sanityLoader : undefined}
                  alt=""
                  fill
                  sizes="(min-width: 900px) 240px, 45vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
              </span>
              <span className="block px-3 pb-2.5 pt-2">
                <span
                  className="block text-[16px] leading-tight text-[#4F4A44]"
                  style={{ fontFamily: SERIF }}
                >
                  {name}
                </span>
                <span className="mt-0.5 block text-[10.5px] uppercase leading-snug tracking-[0.14em] text-[#736F69]">
                  {pick(a.locality, locale)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-center">
        <button
          type="button"
          onClick={() => onPick(null)}
          className={`text-[14px] underline underline-offset-4 transition-opacity hover:opacity-80 ${onPhoto ? "on-photo-kicker text-[#FFFAF2]" : "text-[#4F4A44]"}`}
          style={{ fontFamily: SERIF }}
        >
          {t("pickGeneral")}
        </button>
      </p>
    </div>
  );
}

/* ---------------- Badge de contexte ---------------- */

export function ContextBadge({
  chosen,
  onChange,
  className = "",
}: {
  /** Logement choisi ; absent = question générale. */
  chosen?: ApartmentSummary;
  onChange: () => void;
  className?: string;
}) {
  const t = useTranslations("chat");
  const locale = useLocale() as Locale;
  return (
    <div
      className={`inline-flex max-w-full items-center gap-2.5 rounded-full bg-[rgb(255_250_242/0.96)] py-1.5 pl-1.5 pr-4 text-left shadow-[0_4px_16px_rgba(28,26,24,.14)] ${className}`}
    >
      <span className="relative h-8 w-8 flex-none overflow-hidden rounded-full bg-[#E9E3D9]">
        {chosen ? (
          <Image
            src={chosen.mainImage}
            loader={isSanityImage(chosen.mainImage) ? sanityLoader : undefined}
            alt=""
            fill
            sizes="32px"
            className="object-cover"
          />
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="absolute inset-0 m-auto h-4 w-4 text-[#736F69]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
          </svg>
        )}
      </span>
      <span className="min-w-0">
        {chosen && (
          <span className="block text-[9.5px] uppercase leading-none tracking-[0.18em] text-[#736F69]">
            {t("youTalkAbout")}
          </span>
        )}
        <span
          className={`block truncate text-[15px] leading-tight text-[#4F4A44] ${chosen ? "mt-1" : ""}`}
          style={{ fontFamily: SERIF }}
        >
          {chosen ? pick(chosen.name, locale) : t("general")}
        </span>
      </span>
      <button
        type="button"
        onClick={onChange}
        aria-label={t("changeAria")}
        className="ml-1 flex-none text-[13px] text-[#A8603C] underline underline-offset-2 hover:text-[#8E4F31]"
        style={{ fontFamily: SERIF }}
      >
        {t("change")}
      </button>
    </div>
  );
}

/* ---------------- Fil à défilement maison ---------------- */

export interface ThreadHandle {
  /** Élément qui défile (pour l'auto-scroll vers le bas). */
  el: HTMLDivElement | null;
}

/**
 * Fil de conversation. La barre native est masquée (`.assist-thread`) ; à
 * droite, une colonne de 28 px : bouton « haut », trait vertical avec un
 * curseur dont la hauteur et la position reflètent la portion visible, bouton
 * « bas ». Clic = une hauteur de vue, en douceur. Le trait n'est pas
 * déplaçable (V1) ; molette et doigt restent actifs. Colonne masquée sous
 * 900 px (le doigt suffit) et quand tout le fil tient dans la vue.
 */
export const Thread = forwardRef<
  ThreadHandle,
  {
    children: React.ReactNode;
    tone: AssistantTone;
    className?: string;
    innerClassName?: string;
    style?: React.CSSProperties;
  }
>(function Thread({ children, tone, className = "", innerClassName = "", style }, ref) {
  const t = useTranslations("chat");
  const elRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => ({
    get el() {
      return elRef.current;
    },
  }));

  const [m, setM] = useState({ scrollable: false, ratio: 1, pos: 0, atTop: true, atBottom: true });
  const measure = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setM({
      scrollable: max > 2,
      ratio: el.scrollHeight ? el.clientHeight / el.scrollHeight : 1,
      pos: max > 0 ? el.scrollTop / max : 0,
      atTop: el.scrollTop <= 1,
      atBottom: el.scrollTop >= max - 1,
    });
  }, []);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const mo = new MutationObserver(measure);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
      mo.disconnect();
    };
  }, [measure]);

  const page = (dir: 1 | -1) => {
    const el = elRef.current;
    if (el) el.scrollBy({ top: dir * el.clientHeight * 0.9, behavior: "smooth" });
  };

  const onPhoto = tone === "photo";
  const track = onPhoto ? "bg-white/[.28]" : "bg-[rgba(79,74,68,.16)]";
  const thumb = onPhoto ? "bg-white/90" : "bg-[rgba(79,74,68,.55)]";
  const btn =
    "flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[rgb(255_250_242/0.96)] text-[#4F4A44] shadow-[0_2px_8px_rgba(28,26,24,.16)] transition-opacity disabled:opacity-40";
  const thumbPct = Math.max(12, m.ratio * 100);

  return (
    <div className={`relative flex min-h-0 gap-2 ${className}`} style={style}>
      <div
        ref={elRef}
        data-lenis-prevent
        aria-live="polite"
        className={`assist-thread min-h-0 min-w-0 flex-1 overflow-y-auto ${innerClassName}`}
      >
        {children}
      </div>
      {m.scrollable && (
        <div className="hidden w-7 flex-none flex-col items-center gap-2 py-1 min-[900px]:flex">
          <button
            type="button"
            className={btn}
            onClick={() => page(-1)}
            disabled={m.atTop}
            aria-label={t("scrollUp")}
          >
            <Chevron up />
          </button>
          <div aria-hidden className={`relative w-[2px] flex-1 rounded-full ${track}`}>
            <div
              className={`absolute inset-x-0 rounded-full ${thumb}`}
              style={{
                height: `${thumbPct}%`,
                top: `${m.pos * (100 - thumbPct)}%`,
              }}
            />
          </div>
          <button
            type="button"
            className={btn}
            onClick={() => page(1)}
            disabled={m.atBottom}
            aria-label={t("scrollDown")}
          >
            <Chevron />
          </button>
        </div>
      )}
    </div>
  );
});

function Chevron({ up = false }: { up?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transform: up ? "rotate(180deg)" : undefined }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/* ---------------- Bulles ---------------- */

function Stamp({
  time,
  tone,
  align,
}: {
  time?: string;
  tone: AssistantTone;
  align: "left" | "right";
}) {
  if (!time) return null;
  return (
    <span
      className={`mt-1 block text-[11px] tracking-[0.02em] ${align === "right" ? "text-right" : "text-left"} ${tone === "photo" ? "on-photo-kicker text-[#FFFAF2]/80" : "text-[rgba(79,74,68,.5)]"}`}
    >
      {time}
    </span>
  );
}

const bubbleText = "whitespace-pre-wrap px-4 py-2.5 text-[14.5px] leading-[1.55]";

export function UserBubble({
  children,
  time,
  tone,
}: {
  children: React.ReactNode;
  time?: string;
  tone: AssistantTone;
}) {
  return (
    <div data-msg className="max-w-[85%] self-end">
      <div
        className={`${bubbleText} rounded-[16px_16px_4px_16px] shadow-[0_2px_8px_rgba(28,26,24,.14)]`}
        style={{ background: TERRA, color: CREAM, fontFamily: SERIF }}
      >
        {children}
      </div>
      <Stamp time={time} tone={tone} align="right" />
    </div>
  );
}

export function BotBubble({
  children,
  time,
  tone,
  houses = [],
  pageAria,
}: {
  children: React.ReactNode;
  time?: string;
  tone: AssistantTone;
  houses?: HouseRef[];
  pageAria?: (name: string) => string;
}) {
  const content = typeof children === "string" ? cleanMarkdown(children) : children;
  return (
    <div data-msg className="flex max-w-[94%] items-start gap-2 self-start">
      <AssistantAvatar size={28} ringColor={tone === "photo" ? BROWN : "#F8F5F0"} />
      <div className="min-w-0">
        <div
          className={`${bubbleText} rounded-[16px_16px_16px_4px] shadow-[0_2px_8px_rgba(28,26,24,.1)]`}
          style={{ background: "rgb(255 253 250 / 0.97)", color: BROWN, fontFamily: SERIF }}
        >
          {content}
        </div>
        {houses.map((h) => (
          <AssistantHouseCard
            key={h.slug}
            house={h}
            aria={pageAria ? pageAria(h.name) : h.name}
          />
        ))}
        <Stamp time={time} tone={tone} align="left" />
      </div>
    </div>
  );
}

export function TypingBubble({ tone }: { tone: AssistantTone }) {
  return (
    <div data-msg className="flex items-end gap-2 self-start">
      <AssistantAvatar size={28} ringColor={tone === "photo" ? BROWN : "#F8F5F0"} />
      <div
        data-typing
        className="inline-flex items-center gap-1.5 rounded-[16px_16px_16px_4px] px-4 py-3.5 shadow-[0_2px_8px_rgba(28,26,24,.1)]"
        style={{ background: "rgb(255 253 250 / 0.97)" }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: "rgba(101, 107, 87,.65)" }}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------------- Saisie + pastilles ---------------- */

export const Composer = forwardRef<
  HTMLDivElement,
  {
    input: string;
    setInput: (v: string) => void;
    onSubmit: () => void;
    onChip: (text: string) => void;
    chips: Suggestion[];
    /** aria-label d'une pastille (question posée). */
    chipAria?: (question: string) => string;
    loading: boolean;
    inputAria: string;
    inputRef?: React.Ref<HTMLInputElement>;
    className?: string;
  }
>(function Composer(
  {
    input,
    setInput,
    onSubmit,
    onChip,
    chips,
    chipAria,
    loading,
    inputAria,
    inputRef,
    className = "",
  },
  ref,
) {
  const t = useTranslations("chat");
  const sendDisabled = !input.trim() || loading;
  return (
    <div
      ref={ref}
      className={`rounded-[20px] bg-[rgb(255_253_250/0.97)] p-1.5 shadow-[0_2px_6px_rgba(79,74,68,.18),0_14px_34px_rgba(28,26,24,.2)] ${className}`}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="flex items-center gap-2 pl-3.5"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("placeholder")}
          aria-label={inputAria}
          className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-[#4F4A44] outline-none placeholder:text-[rgba(79,74,68,.5)]"
          style={{ fontFamily: SERIF }}
        />
        <button
          type="submit"
          aria-label={t("send")}
          disabled={sendDisabled}
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-white transition-[transform,opacity] duration-200 hover:enabled:scale-105 disabled:opacity-40"
          style={{ background: TERRA }}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M22 2 11 13" />
            <path d="M22 2 15 22l-4-9-9-4z" />
          </svg>
        </button>
      </form>
      {chips.length > 0 && (
        <div
          data-msg
          className="mt-1.5 flex flex-wrap justify-center gap-1.5 border-t border-[rgba(90,79,66,.14)] px-1 pb-1 pt-2"
        >
          {chips.map((s) => {
            const cls =
              "rounded-full bg-[rgba(90,79,66,0.07)] px-3 py-1.5 text-[12.5px] leading-snug text-[#5A4F42] no-underline transition-colors duration-200 hover:bg-[rgba(90,79,66,0.13)] disabled:opacity-50";
            return s.href ? (
              <Link key={s.label} href={s.href} className={cls} style={{ fontFamily: SERIF }}>
                {s.label}
              </Link>
            ) : (
              <button
                key={s.label}
                type="button"
                onClick={() => (s.action ? s.action() : onChip(s.send ?? s.label))}
                disabled={loading}
                aria-label={chipAria ? chipAria(s.label) : undefined}
                className={cls}
                style={{ fontFamily: SERIF }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});
