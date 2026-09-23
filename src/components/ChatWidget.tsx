"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import AssistantHouseCard from "@/components/AssistantHouseCard";
import AssistantAvatar from "@/components/AssistantAvatar";
import { Link, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  cleanMarkdown,
  useAssistantChat,
  type Suggestion,
} from "@/hooks/useAssistantChat";
import { housesIn, type HouseRef } from "@/lib/assistant-houses";
import { useLenisRef } from "@/components/LenisProvider";
import { scrollToAnchor } from "@/lib/anchor-scroll";
import type Lenis from "lenis";

/* ------------------------------------------------------------------
   Gwenaëlle — bouton rond CAMEL (bulle de conversation, point « en
   ligne ») qui ouvre un panneau CHALEUREUX : fond crème, en-tête taupe
   portant l'identité de l'hôtesse (sa photo en cercle + « Gwenaëlle ·
   Votre hôtesse »), bulles blanc cassé côté Gwenaëlle (sa photo devant
   chacune) et kaki foncé côté voyageur, suggestions cliquables dès
   l'ouverture puis suites contextuelles après chaque réponse.

   Espace : panneau ~450 px sur desktop, fil de conversation ~64 vh,
   bulles jusqu'à 85 % ; sur mobile le panneau prend quasi tout l'écran
   (safe-areas respectées — règles dans globals.css).

   La logique /api/chat (streaming, suggestions) vit dans le hook
   partagé useAssistantChat — la section inline de l'accueil
   (AssistantCTA) affiche exactement les mêmes contenus.

   Sur une page qui porte la section inline (#assistant, accueil), le
   panneau ne s'ouvre JAMAIS : le bouton glisse vers la section — un seul
   point de conversation par page.

   Les :hover / keyframes / reduced-motion vivent dans globals.css
   (.assistant).
   ------------------------------------------------------------------ */

const KAKI_DEEP = "#545A48"; // bulles voyageur
const TERRA = "#A8603C"; // CAMEL — bouton flottant + bouton envoyer (boutons d'action)
const INK = "#4F4A44"; // taupe doux — en-tête du panneau
const PAPER = "#F1ECE3";
const CREAM = "#F8F5F0"; // fond du panneau
const BUBBLE = "#FFFDFA"; // bulles de Gwenaëlle
const ONLINE = "#6E9C6A"; // point « en ligne »
const SERIF = "var(--font-display)"; // une seule serif (Fraunces)
const BODY = "var(--text-body)"; // aucun texte sous la taille du corps

/** Durée de la fermeture du panneau — à garder en phase avec globals.css. */
const CLOSE_MS = 240;

/** Boutons discrets de l'en-tête (effacer, fermer). */
const headerIconStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "rgba(241,236,227,.6)",
  cursor: "pointer",
  padding: 4,
  display: "inline-flex",
  borderRadius: 8,
  transition: "color .2s ease",
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Glisse en douceur (Lenis, même courbe que la navigation) vers le chat
 * inline de l'accueil s'il est présent dans le DOM. Renvoie true si la
 * section existe (→ ne pas ouvrir le panneau).
 */
function scrollToInlineAssistant(lenis: Lenis | null | undefined): boolean {
  return scrollToAnchor(lenis, "#assistant");
}

/**
 * `enabled` = clé Anthropic présente côté serveur (booléen passé par le layout,
 * jamais la clé elle-même). Si false → état désactivé propre, aucune requête.
 */
export default function ChatWidget({ enabled = true }: { enabled?: boolean }) {
  const t = useTranslations("chat");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const lenisRef = useLenisRef();
  const fmtTime = useCallback(
    (ms: number) =>
      new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(ms),
    [locale],
  );

  const [open, setOpen] = useState(false);
  // Le panneau reste monté le temps de l'animation de fermeture.
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    messages,
    input,
    setInput,
    loading,
    disabled,
    send,
    sendMessage,
    reset,
    awaitingFirstToken,
    starters,
    followUps,
  } = useAssistantChat(enabled);

  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const openPanel = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setClosing(false);
    setOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (prefersReducedMotion()) {
      setOpen(false);
      setClosing(false);
      return;
    }
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, CLOSE_MS);
  }, []);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (open && !closing) inputRef.current?.focus();
  }, [open, closing]);

  // Auto-scroll du fil vers le bas à chaque nouveau contenu (y compris
  // l'arrivée des suggestions de suite, qui allongent le fil).
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, followUps, open]);

  // Une seule conversation par page : si la page affiche le chat inline
  // (accueil), le panneau reste fermé — y compris s'il était ouvert avant
  // une navigation SPA vers l'accueil.
  useEffect(() => {
    if (document.getElementById("assistant")) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setOpen(false);
      setClosing(false);
    }
  }, [pathname]);

  // Le listener d'ouverture est enregistré une seule fois : il passe par ces
  // refs (réassignées à chaque rendu) pour lire le state à jour.
  const sendMessageRef = useRef<(text: string) => void>(() => {});
  const openRef = useRef<() => void>(() => {});
  const closeRef = useRef<() => void>(() => {});
  useEffect(() => {
    sendMessageRef.current = sendMessage;
    openRef.current = openPanel;
    closeRef.current = closePanel;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    // `lesptitesbarques:open-chat` — ouvre le panneau (ou scrolle vers le chat
    // inline si la page en a un) ; detail.message optionnel → envoyé direct.
    const onOpen = (e: Event) => {
      if (scrollToInlineAssistant(lenisRef?.current)) return;
      openRef.current();
      const message = (e as CustomEvent<{ message?: string } | undefined>)
        .detail?.message;
      if (message) sendMessageRef.current(message);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("lesptitesbarques:open-chat", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("lesptitesbarques:open-chat", onOpen);
    };
  }, [lenisRef]);

  /* Le champ reste TOUJOURS saisissable : sans clé Anthropic côté serveur
     (`disabled`), /api/chat répond lui-même par un message de repli courtois
     (« écrivez-moi via le formulaire de contact »). Un champ grisé donnait l'impression d'un
     assistant cassé — c'était le bug « impossible d'écrire » constaté sur la
     preview déployée sans variables d'environnement. */
  const sendDisabled = !input.trim() || loading;

  return (
    <div
      className="assistant"
      style={{
        position: "fixed",
        right: "max(24px, env(safe-area-inset-right))",
        bottom: "max(24px, env(safe-area-inset-bottom))",
        zIndex: 50,
        fontFamily: SERIF,
      }}
    >
      {/* ÉTAT FERMÉ — bouton rond camel : bulle de conversation + point vert */}
      {!open && (
        <button
          type="button"
          data-fab
          data-anim
          data-motion
          onClick={() => {
            // Accueil → scroll vers le chat inline ; ailleurs → panneau.
            if (!scrollToInlineAssistant(lenisRef?.current)) openPanel();
          }}
          aria-label={t("open")}
          title={t("open")}
          style={{
            position: "relative",
            width: 58,
            height: 58,
            border: "none",
            borderRadius: "50%",
            cursor: "pointer",
            background: TERRA,
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow:
              "0 2px 4px rgba(79, 74, 68,.16), 0 10px 26px rgba(79, 74, 68,.22)",
            transition:
              "transform .32s cubic-bezier(.22,.61,.36,1), box-shadow .32s cubic-bezier(.22,.61,.36,1), background-color .2s ease",
          }}
        >
          {/* Bulle de conversation fine (trait 1.5, style lucide, cohérent
              avec les pictos du site) */}
          <svg
            width="27"
            height="27"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
            <path d="M8 12h.01M12 12h.01M16 12h.01" />
          </svg>
          <span
            data-online
            aria-hidden="true"
            style={{
              position: "absolute",
              right: 2,
              top: 2,
              width: 13,
              height: 13,
              borderRadius: "50%",
              background: ONLINE,
              border: `2px solid ${CREAM}`,
            }}
          />
        </button>
      )}

      {/* ÉTAT OUVERT — le panneau */}
      {open && (
        <section
          data-panel
          data-anim
          data-leaving={closing ? "" : undefined}
          role="dialog"
          aria-label={t("title")}
          style={{
            width: "min(450px, calc(100vw - 32px))",
            // Jamais plus haut que l'écran : le fil (flex 1 1 auto, min 0)
            // se resserre sous sa hauteur nominale quand il le faut.
            maxHeight: "calc(100dvh - 48px)",
            background: CREAM,
            borderRadius: 22,
            overflow: "hidden",
            boxShadow:
              "0 2px 6px rgba(79, 74, 68,.12), 0 20px 48px rgba(79, 74, 68,.22)",
            transformOrigin: "bottom right",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* En-tête taupe — il porte l'identité : photo de Gwenaëlle + nom */}
          <header
            data-header
            style={{
              background: INK,
              color: PAPER,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              flex: "none",
            }}
          >
            <AssistantAvatar size={46} ringColor={INK} online />

            <div style={{ minWidth: 0, flex: 1 }}>
              <h2
                style={{
                  margin: 0,
                  fontFamily: "inherit",
                  fontSize: "var(--text-subtitle)",
                  fontWeight: 500,
                  letterSpacing: ".01em",
                  lineHeight: 1.2,
                  color: PAPER,
                }}
              >
                {t("name")}
              </h2>
              <p
                style={{
                  margin: "3px 0 0",
                  fontFamily: "inherit",
                  fontSize: BODY,
                  letterSpacing: ".01em",
                  color: "rgba(241,236,227,.7)",
                  lineHeight: 1.35,
                }}
              >
                {t("subtitle")}
              </p>
            </div>

            <div
              style={{ display: "flex", gap: 2, alignSelf: "flex-start", margin: "-4px -6px 0 0" }}
            >
              {/* Effacer — discret, n'apparaît qu'une fois le fil entamé */}
              {messages.length > 0 && (
                <button
                  type="button"
                  data-close
                  data-motion
                  onClick={reset}
                  aria-label={t("clear")}
                  title={t("clear")}
                  style={headerIconStyle}
                >
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                  </svg>
                </button>
              )}

              <button
                type="button"
                data-close
                data-motion
                onClick={closePanel}
                aria-label={t("close")}
                style={headerIconStyle}
              >
                <svg
                  width="18"
                  height="18"
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
          </header>

          {/* Fil de conversation */}
          <div
            ref={bodyRef}
            data-body
            data-lenis-prevent
            aria-live="polite"
            style={{
              flex: "1 1 auto",
              minHeight: 0,
              height: "min(620px, 64vh)",
              overflowY: "auto",
              padding: "18px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <BotBubble>{t("greeting")}</BotBubble>

            {messages.map((m, i) =>
              m.content === "" ? null : m.role === "user" ? (
                <UserBubble key={i} time={fmtTime(m.at)}>
                  {m.content}
                </UserBubble>
              ) : (
                <BotBubble
                  key={i}
                  time={fmtTime(m.at)}
                  houses={housesIn(m.content, locale)}
                  pageAria={(name) => t("housePageAria", { name })}
                >
                  {m.content}
                </BotBubble>
              ),
            )}

            {awaitingFirstToken && <TypingBubble />}

            {/* Suites contextuelles — sous la dernière réponse de l'assistant */}
            {followUps.length > 0 && (
              <Chips
                items={followUps}
                disabled={loading}
                onSend={sendMessage}
                style={{ paddingLeft: 36 }}
              />
            )}

            {/* Assistant non connecté (clé absente) → note calme, pas d'erreur ;
                on peut quand même écrire, le serveur répond par le repli. */}
            {disabled && messages.length === 0 && (
              <BotBubble>{t("disabled")}</BotBubble>
            )}
          </div>

          {/* Amorces — épinglées sous le fil tant que rien n'a été écrit,
              pour qu'elles restent visibles même si le fil défile. */}
          {starters.length > 0 && (
            <div
              data-starters
              style={{
                flex: "none",
                padding: "0 14px 12px",
                borderTop: "1px solid rgba(79, 74, 68,.06)",
                paddingTop: 12,
              }}
            >
              <Chips items={starters} disabled={loading} onSend={sendMessage} />
            </div>
          )}

          {/* Barre de saisie */}
          <footer
            style={{
              flex: "none",
              padding: "12px 14px 14px",
              borderTop: "1px solid rgba(79, 74, 68,.07)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <input
              ref={inputRef}
              data-msginput
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={t("placeholder")}
              style={{
                flex: 1,
                minWidth: 0,
                border: "1px solid rgba(79, 74, 68,.12)",
                background: BUBBLE,
                borderRadius: 999,
                padding: "13px 18px",
                fontFamily: "inherit",
                fontSize: BODY,
                lineHeight: 1.3,
                color: INK,
                transition: "border-color .2s ease, box-shadow .2s ease",
              }}
            />
            <button
              type="button"
              data-send
              data-motion
              onClick={send}
              disabled={sendDisabled}
              aria-label={t("send")}
              style={{
                flex: "none",
                width: 46,
                height: 46,
                border: "none",
                borderRadius: "50%",
                background: TERRA,
                color: "#fff",
                cursor: sendDisabled ? "default" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: sendDisabled ? 0.4 : 1,
                boxShadow: sendDisabled
                  ? "none"
                  : "0 2px 8px rgba(168, 96, 60,.36)",
                transition: "transform .2s ease, filter .2s ease",
              }}
            >
              <svg
                width="19"
                height="19"
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
          </footer>
        </section>
      )}
    </div>
  );
}

/* ---- Puces cliquables ---- */

/**
 * Rangée de puces. Une puce pose une question à l'assistant (`send`) ou
 * emmène sur une page du site (`href`) — même habillage dans les deux cas,
 * l'intention se lit dans le libellé.
 */
export function Chips({
  items,
  disabled,
  onSend,
  style,
}: {
  items: Suggestion[];
  disabled: boolean;
  onSend: (text: string) => void;
  style?: React.CSSProperties;
}) {
  const base: React.CSSProperties = {
    border: "1px solid rgba(101, 107, 87,.34)",
    background: BUBBLE,
    color: KAKI_DEEP,
    borderRadius: 999,
    padding: "8px 14px",
    fontFamily: "inherit",
    fontSize: BODY,
    lineHeight: 1.3,
    textDecoration: "none",
    display: "inline-block",
    transition:
      "background-color .22s ease, border-color .22s ease, transform .22s ease",
  };

  return (
    <div
      data-msg
      style={{ display: "flex", flexWrap: "wrap", gap: 8, ...style }}
    >
      {items.map((s) =>
        s.href ? (
          <Link
            key={s.label}
            href={s.href}
            data-chip
            data-motion
            style={{ ...base, cursor: "pointer" }}
          >
            {s.label}
          </Link>
        ) : (
          <button
            key={s.label}
            type="button"
            data-chip
            data-motion
            onClick={() => onSend(s.send ?? s.label)}
            disabled={disabled}
            style={{
              ...base,
              cursor: disabled ? "default" : "pointer",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {s.label}
          </button>
        ),
      )}
    </div>
  );
}

/* ---- Bulles ---- */

/** Heure discrète sous une bulle. */
function Stamp({ time, align }: { time?: string; align: "left" | "right" }) {
  if (!time) return null;
  return (
    <span
      style={{
        display: "block",
        marginTop: 4,
        fontFamily: "inherit",
        fontSize: BODY,
        letterSpacing: ".02em",
        color: "rgba(79, 74, 68,.34)",
        textAlign: align === "right" ? "right" : "left",
      }}
    >
      {time}
    </span>
  );
}

function BotBubble({
  children,
  time,
  houses = [],
  pageAria,
}: {
  children: React.ReactNode;
  time?: string;
  houses?: HouseRef[];
  pageAria?: (name: string) => string;
}) {
  const content =
    typeof children === "string" ? cleanMarkdown(children) : children;
  return (
    <div
      data-msg
      style={{
        display: "flex",
        // flex-start : la pastille reste au niveau de la 1re ligne de la
        // bulle, même quand une mini-carte et l'heure s'empilent dessous.
        alignItems: "flex-start",
        gap: 8,
        alignSelf: "flex-start",
        // Photo (28) + espace + bulle : la bulle elle-même monte à ~85 %.
        maxWidth: "94%",
      }}
    >
      <AssistantAvatar size={28} ringColor={CREAM} />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            background: BUBBLE,
            color: INK,
            border: "1px solid rgba(79, 74, 68,.06)",
            borderRadius: "16px 16px 16px 5px",
            padding: "12px 15px",
            fontSize: BODY,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            boxShadow: "0 1px 3px rgba(79, 74, 68,.05)",
          }}
        >
          {content}
        </div>

        {/* Action riche : le logement cité devient cliquable */}
        {houses.map((h) => (
          <AssistantHouseCard
            key={h.slug}
            house={h}
            aria={pageAria ? pageAria(h.name) : h.name}
          />
        ))}

        <Stamp time={time} align="left" />
      </div>
    </div>
  );
}

function UserBubble({
  children,
  time,
}: {
  children: React.ReactNode;
  time?: string;
}) {
  return (
    <div data-msg style={{ alignSelf: "flex-end", maxWidth: "85%" }}>
      <div
        style={{
          background: KAKI_DEEP,
          color: CREAM,
          borderRadius: "16px 16px 5px 16px",
          padding: "12px 15px",
          fontSize: BODY,
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
        }}
      >
        {children}
      </div>
      <Stamp time={time} align="right" />
    </div>
  );
}

function TypingBubble() {
  return (
    <div
      data-msg
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        alignSelf: "flex-start",
      }}
    >
      <AssistantAvatar size={28} ringColor={CREAM} />
      <div
        data-typing
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          background: BUBBLE,
          border: "1px solid rgba(79, 74, 68,.06)",
          borderRadius: "16px 16px 16px 5px",
          padding: "14px 16px",
          boxShadow: "0 1px 3px rgba(79, 74, 68,.05)",
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "rgba(101, 107, 87,.65)",
              display: "inline-block",
            }}
          />
        ))}
      </div>
    </div>
  );
}
