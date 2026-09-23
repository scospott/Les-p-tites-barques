"use client";

import { useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";

import Ornament from "@/components/Ornament";
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
import type { Locale } from "@/i18n/routing";
import { useAssistantChat } from "@/hooks/useAssistantChat";
import { threadHouses } from "@/lib/assistant-houses";

/* ------------------------------------------------------------------
   AssistantCTA — l'assistante de l'accueil : carte de droite de la grille
   « L'histoire » (ancre #assistant, ciblée par le bouton flottant). La
   conversation se déroule ici même (streaming /api/chat via le hook
   partagé useAssistantChat) ; AUCUN panneau ne s'ouvre sur cette page.

   Deux états :
   A. Sélecteur — titre, puis « De quel logement parle-t-on ? » : grille 2×2
      des logements et lien « Ou posez une question générale ». Pas de champ
      de saisie tant que le sujet n'est pas choisi.
   B. Conversation — badge « Vous parlez de … · changer » sous le titre, fil
      à défilement maison (flèches à droite, desktop), puis le champ et les
      4 questions suggérées du logement. « Changer » revient à A sans perdre
      la conversation.

   Hauteur : desktop = celle de la rangée (800 px), contenu en absolu, le fil
   scrolle dedans. Mobile = 4:5,6 minimum (×1,4 de la largeur), la carte
   grandit avec la conversation jusqu'à 85vh. Hauteurs posées en CSS : zéro CLS.
   ------------------------------------------------------------------ */

/** Photo de fond de la carte. */
const WAVES = "/images/accueil/vagues-vue-aerienne.jpg";
const WAVES_SIZES = "(min-width: 900px) 562px, calc(100vw - 40px)";

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
    apartment,
    chosen,
    chooseApartment,
    changeApartment,
    messages,
    input,
    setInput,
    loading,
    disabled,
    sendMessage,
    awaitingFirstToken,
    starters,
    followUps,
  } = useAssistantChat(enabled);

  const picking = apartment === undefined;
  // Amorces du logement avant la première question, suites ensuite.
  const chips = starters.length ? starters : followUps;

  // Auto-scroll interne du fil à chaque nouveau contenu.
  const threadRef = useRef<ThreadHandle>(null);
  useEffect(() => {
    const el = threadRef.current?.el;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, picking]);

  /* Mobile : à l'ENVOI d'un message (jamais au chargement ni à la
     réception), si le champ de saisie est sous le pli, on fait glisser le
     bas de la carte dans la vue. */
  const cardRef = useRef<HTMLElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const submit = useCallback(
    (text: string) => {
      sendMessage(text);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (window.innerWidth >= 900) return;
          const box = composerRef.current?.getBoundingClientRect();
          if (box && box.bottom > window.innerHeight) {
            cardRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
          }
        }),
      );
    },
    [sendMessage],
  );

  const hasThread = messages.length > 0;

  return (
    <article
      ref={cardRef}
      id="assistant"
      aria-labelledby="assistant-title"
      className="assistant relative flex max-h-[85vh] min-h-[calc((100vw-40px)*1.4)] scroll-mt-24 flex-col overflow-hidden rounded-[22px] bg-ink text-center shadow-[0_8px_32px_rgba(0,0,0,.08)] min-[900px]:block min-[900px]:max-h-none min-[900px]:min-h-[800px]"
    >
      <Image
        src={WAVES}
        alt={t("photoAlt")}
        fill
        sizes={WAVES_SIZES}
        className="z-0 object-cover object-center"
      />
      {/* Voile : léger en haut, plus marqué en bas (champ et pastilles). */}
      <div aria-hidden className="assistant-veil absolute inset-0 z-0" />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-6 py-8 min-[900px]:absolute min-[900px]:inset-0 min-[900px]:p-12">
        <div className="flex-none">
          <p className="kicker on-photo-kicker justify-center text-[12px] text-[#F1ECE3]">
            {t("kicker")}
          </p>
          <h2
            id="assistant-title"
            className="section-title on-photo-title mt-3 text-[32px] text-[#F1ECE3] min-[900px]:text-[40px]"
          >
            {t("title")}
          </h2>
          <Ornament tone="photo" className="mt-4 justify-center" />
        </div>

        {picking ? (
          /* ÉTAT A — choisir le logement avant de parler */
          <ApartmentPicker
            tone="photo"
            onPick={chooseApartment}
            className="my-auto pt-6"
          />
        ) : (
          /* ÉTAT B — conversation */
          <>
            <div className="mt-4 flex-none">
              <ContextBadge chosen={chosen} onChange={changeApartment} />
            </div>

            <Thread
              ref={threadRef}
              tone="photo"
              className="mt-4 flex-1"
              innerClassName="flex flex-col gap-4 px-1 py-1 text-left"
            >
              {messages.map((m, i) =>
                m.content === "" ? null : m.role === "user" ? (
                  <UserBubble key={i} tone="photo" time={fmtTime(m.at)}>
                    {m.content}
                  </UserBubble>
                ) : (
                  <BotBubble
                    key={i}
                    tone="photo"
                    time={fmtTime(m.at)}
                    houses={threadHouses(m.content, locale, apartment)}
                    pageAria={(name) => tc("housePageAria", { name })}
                  >
                    {m.content}
                  </BotBubble>
                ),
              )}
              {awaitingFirstToken && <TypingBubble tone="photo" />}
              {/* Assistant non connecté (clé absente) → note calme ; le champ
                  reste saisissable, le serveur répond par le repli. */}
              {disabled && !hasThread && (
                <p className="on-photo-kicker mx-auto mt-auto max-w-md text-center text-[14px] italic leading-relaxed text-[#FFFAF2]">
                  {tc("disabled")}
                </p>
              )}
            </Thread>

            <Composer
              ref={composerRef}
              className="mt-4 flex-none"
              input={input}
              setInput={setInput}
              onSubmit={() => submit(input)}
              onChip={submit}
              chips={chips}
              chipAria={(question) => t("suggestionAria", { question })}
              loading={loading}
              inputAria={t("inputAria")}
            />
          </>
        )}
      </div>
    </article>
  );
}
