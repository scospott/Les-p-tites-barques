"use client";

import { useCallback, useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import AssistantHouseCard from "@/components/AssistantHouseCard";
import AssistantAvatar from "@/components/AssistantAvatar";
import Reveal from "@/components/Reveal";
import Ornament from "@/components/Ornament";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cleanMarkdown, useAssistantChat } from "@/hooks/useAssistantChat";
import { housesIn } from "@/lib/assistant-houses";

/* ------------------------------------------------------------------
   AssistantCTA — chat assistant INLINE de l'accueil (dernière section
   avant le footer, ancre #assistant ciblée par le pill flottant).
   Bande anthracite : titre + ornement, puis un encadré de chat crème qui
   réunit le champ de saisie et, dessous, les questions suggérées. La
   conversation se déroule ici même (streaming /api/chat via le hook
   partagé useAssistantChat), AUCUN panneau ne s'ouvre sur cette page.

   Mêmes bulles que le panneau flottant : la photo de Gwenaëlle devant
   chaque réponse, bulles blanc cassé côté Gwenaëlle, kaki foncé côté
   voyageur, suggestions issues du même hook (amorces puis suites
   contextuelles). Le fil prend la largeur disponible (max ~720 px),
   bulles jusqu'à 85 %.
   ------------------------------------------------------------------ */

const TERRA = "#A8603C"; // CAMEL — bouton d'envoi (bouton d'action)
const KAKI_DEEP = "#545A48"; // bulles voyageur
const CREAM = "#F1ECE3";
const CREAM_SOFT = "rgba(241,236,227,.7)";
const BUBBLE = "#FFFDFA"; // bulles de l'assistant
const INK = "#4F4A44"; // taupe doux
const SERIF = "var(--font-display)"; // une seule serif (Fraunces)

export default function AssistantCTA({
  enabled = true,
}: {
  enabled?: boolean;
}) {
  const t = useTranslations("assistantCta");
  const tc = useTranslations("chat");
  const locale = useLocale() as Locale;
  const fmtTime = useCallback(
    (ms: number) =>
      new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(ms),
    [locale],
  );

  const {
    messages,
    input,
    setInput,
    loading,
    disabled,
    send,
    sendMessage,
    awaitingFirstToken,
    starters,
    followUps,
  } = useAssistantChat(enabled);

  // Amorces avant la première question, suites contextuelles ensuite.
  const chips = starters.length ? starters : followUps;

  // Auto-scroll interne du fil à chaque nouveau contenu.
  const threadRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const hasThread = messages.length > 0;

  return (
    <section id="assistant" className="scroll-mt-20 bg-offwhite">
      <div className="shell-wide pb-20 sm:pb-28">
        <Reveal>
          <div className="assistant rounded-[22px] bg-ink px-5 py-12 text-center sm:px-12 sm:py-16">
            <h2
              className="section-title mx-auto max-w-2xl"
              style={{ color: CREAM }}
            >
              {t("title")}
            </h2>

            <Ornament tone="dark" className="mt-5 justify-center" />

            {/* Fil de conversation inline — apparaît dès le premier message */}
            {hasThread && (
              <div
                ref={threadRef}
                data-lenis-prevent
                className="mx-auto mt-10 flex max-h-[min(560px,60vh)] w-full max-w-[720px] flex-col gap-4 overflow-y-auto px-1 py-1 text-left"
                style={{ fontFamily: SERIF }}
                aria-live="polite"
              >
                {messages.map((m, i) =>
                  m.content === "" ? null : m.role === "user" ? (
                    <div key={i} data-msg className="max-w-[85%] self-end">
                      <div
                        className="whitespace-pre-wrap rounded-[16px_16px_5px_16px] px-4 py-3 text-body leading-[1.55]"
                        style={{ backgroundColor: KAKI_DEEP, color: CREAM }}
                      >
                        {m.content}
                      </div>
                      <span className="mt-1 block text-right text-body tracking-[0.02em] text-[rgba(241,236,227,.5)]">
                        {fmtTime(m.at)}
                      </span>
                    </div>
                  ) : (
                    <div
                      key={i}
                      data-msg
                      className="flex max-w-[94%] items-start gap-2 self-start"
                    >
                      <AssistantAvatar size={28} ringColor={INK} />
                      <div className="min-w-0">
                        <div
                          className="whitespace-pre-wrap rounded-[16px_16px_16px_5px] px-4 py-3 text-body leading-[1.55] text-ink"
                          style={{ backgroundColor: BUBBLE }}
                        >
                          {cleanMarkdown(m.content)}
                        </div>

                        {/* Action riche : le logement cité devient cliquable */}
                        {housesIn(m.content, locale).map((h) => (
                          <AssistantHouseCard
                            key={h.slug}
                            house={h}
                            aria={tc("housePageAria", { name: h.name })}
                          />
                        ))}

                        <span className="mt-1 block text-body tracking-[0.02em] text-[rgba(241,236,227,.5)]">
                          {fmtTime(m.at)}
                        </span>
                      </div>
                    </div>
                  ),
                )}

                {awaitingFirstToken && (
                  <div data-msg className="flex items-end gap-2 self-start">
                    <AssistantAvatar size={28} ringColor={INK} />
                    <div
                      data-typing
                      className="inline-flex items-center gap-1.5 rounded-[16px_16px_16px_5px] px-4 py-3.5"
                      style={{ backgroundColor: BUBBLE }}
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
                )}
              </div>
            )}

            {/* Assistant non connecté (clé absente) → note calme, pas d'erreur.
                Le champ reste saisissable : le serveur répond par le repli. */}
            {disabled && !hasThread && (
              <p
                className="mx-auto mt-8 max-w-md text-body italic leading-relaxed"
                style={{ color: CREAM_SOFT }}
              >
                {tc("disabled")}
              </p>
            )}

            {/* Encadré de chat — champ de saisie puis suggestions, dans le même
                bloc. Le fil de conversation se déroule juste au-dessus. */}
            <div
              className={`mx-auto w-full max-w-[680px] rounded-[26px] p-2 transition-shadow duration-300 focus-within:ring-2 focus-within:ring-[#B3B49A]/70 ${
                hasThread ? "mt-5" : "mt-8"
              }`}
              style={{
                backgroundColor: BUBBLE,
                boxShadow:
                  "0 2px 6px rgba(79, 74, 68,.2), 0 16px 38px rgba(79, 74, 68,.28)",
              }}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="flex items-center gap-3 pl-4"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={tc("placeholder")}
                  aria-label={t("inputAria")}
                  className="min-w-0 flex-1 bg-transparent py-1 text-body text-ink outline-none placeholder:text-[rgba(79,74,68,.5)] disabled:cursor-not-allowed disabled:opacity-55"
                />
                <button
                  type="submit"
                  aria-label={tc("send")}
                  disabled={!input.trim() || loading}
                  className="flex h-12 w-12 flex-none cursor-pointer items-center justify-center rounded-full text-white transition-[transform,opacity,background-color] duration-200 hover:enabled:scale-105 hover:enabled:bg-terra-deep active:enabled:bg-terra-press focus-visible:outline-terra disabled:cursor-default disabled:opacity-40"
                  style={{ backgroundColor: TERRA }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M22 2 11 13" />
                    <path d="M22 2 15 22l-4-9-9-4z" />
                  </svg>
                </button>
              </form>

              {/* Suggestions — amorces, puis suites contextuelles après chaque
                réponse. Même source que le panneau flottant (le hook). */}
              {chips.length > 0 && (
                <div
                  data-msg
                  className="mt-2 grid grid-cols-2 gap-1.5 border-t border-[rgba(79,74,68,.1)] px-1 pb-1 pt-2.5 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-2"
                >
                  {chips.map((s) => {
                    const cls =
                      "flex cursor-pointer items-center justify-center rounded-[14px] border-[0.5px] border-[rgba(79,74,68,.22)] px-2.5 py-1 text-[0.75rem] leading-snug sm:rounded-full text-ink/80 no-underline transition-colors duration-300 hover:border-[rgba(79,74,68,.45)] hover:bg-[rgba(79,74,68,.06)] hover:text-ink sm:px-3.5 sm:py-1.5 sm:text-sm disabled:cursor-default disabled:opacity-50 disabled:hover:border-[rgba(79,74,68,.22)] disabled:hover:bg-transparent";
                    return s.href ? (
                      <Link key={s.label} href={s.href} className={cls}>
                        {s.label}
                      </Link>
                    ) : (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => sendMessage(s.send ?? s.label)}
                        disabled={loading}
                        aria-label={t("suggestionAria", { question: s.label })}
                        className={cls}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
