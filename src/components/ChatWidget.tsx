"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import AssistantAvatar from "@/components/AssistantAvatar";
import {
  ApartmentPicker,
  BotBubble,
  Composer,
  ContextBadge,
  Thread,
  TypingBubble,
  UserBubble,
  type ThreadHandle,
} from "@/components/assistant-ui";
import { usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { useAssistantChat } from "@/hooks/useAssistantChat";
import { threadHouses } from "@/lib/assistant-houses";
import { useLenisRef } from "@/components/LenisProvider";
import { scrollToAnchor } from "@/lib/anchor-scroll";
import type Lenis from "lenis";

/* ------------------------------------------------------------------
   Gwenaëlle — bouton rond CAMEL (bulle de conversation, point « en
   ligne ») qui ouvre un panneau CHALEUREUX : fond crème, en-tête taupe
   portant l'identité de l'hôtesse (sa photo en cercle + « Gwenaëlle ·
   Votre hôtesse »). Mêmes briques que la carte de l'accueil
   (assistant-ui.tsx), en ton « crème » : sélecteur de logement tant que
   le sujet n'est pas choisi (présélection automatique sur une page
   logement), puis badge « Vous parlez de … · changer », fil à défilement
   maison, bulles terracotta / crème, champ + questions suggérées.

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

const TERRA = "#A8603C"; // CAMEL — bouton flottant + bouton envoyer (boutons d'action)
const INK = "#4F4A44"; // taupe doux — en-tête du panneau
const PAPER = "#F1ECE3";
const CREAM = "#F8F5F0"; // fond du panneau
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
    apartment,
    chosen,
    chooseApartment,
    changeApartment,
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

  const picking = apartment === undefined;
  // Amorces du logement avant la première question, suites ensuite.
  const chips = starters.length ? starters : followUps;

  const threadRef = useRef<ThreadHandle>(null);
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
    if (open && !closing && !picking) inputRef.current?.focus();
  }, [open, closing, picking]);

  // Auto-scroll du fil vers le bas à chaque nouveau contenu.
  useEffect(() => {
    const el = threadRef.current?.el;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, open, picking]);

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

          {picking ? (
            /* ÉTAT A — choisir le logement avant de parler */
            <div
              data-body
              data-lenis-prevent
              style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "20px 16px 18px" }}
            >
              <ApartmentPicker tone="cream" onPick={chooseApartment} />
            </div>
          ) : (
            /* ÉTAT B — conversation */
            <>
              <div style={{ flex: "none", padding: "12px 14px 0", textAlign: "center" }}>
                <ContextBadge chosen={chosen} onChange={changeApartment} />
              </div>

              <Thread
                ref={threadRef}
                tone="cream"
                className="pr-2"
                innerClassName="flex flex-col gap-3.5 px-3.5 py-4"
                style={{ flex: "1 1 auto", height: "min(560px, 58vh)" }}
              >
                <BotBubble tone="cream">{t("greeting")}</BotBubble>

                {messages.map((m, i) =>
                  m.content === "" ? null : m.role === "user" ? (
                    <UserBubble key={i} tone="cream" time={fmtTime(m.at)}>
                      {m.content}
                    </UserBubble>
                  ) : (
                    <BotBubble
                      key={i}
                      tone="cream"
                      time={fmtTime(m.at)}
                      houses={threadHouses(m.content, locale, apartment)}
                      pageAria={(name) => t("housePageAria", { name })}
                    >
                      {m.content}
                    </BotBubble>
                  ),
                )}

                {awaitingFirstToken && <TypingBubble tone="cream" />}

                {/* Assistant non connecté (clé absente) → note calme, pas
                    d'erreur ; on peut quand même écrire, le serveur répond
                    par le repli. */}
                {disabled && messages.length === 0 && (
                  <BotBubble tone="cream">{t("disabled")}</BotBubble>
                )}
              </Thread>

              {/* Saisie + questions suggérées (sous le champ) */}
              <div style={{ flex: "none", padding: "4px 12px 12px" }}>
                <Composer
                  input={input}
                  setInput={setInput}
                  onSubmit={send}
                  onChip={sendMessage}
                  chips={chips}
                  loading={loading}
                  inputAria={t("placeholder")}
                  inputRef={inputRef}
                />
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
