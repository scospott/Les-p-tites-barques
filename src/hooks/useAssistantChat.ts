"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { housesIn } from "@/lib/assistant-houses";
import { apartments, pick } from "@/lib/appartements";

/* ------------------------------------------------------------------
   useAssistantChat — logique partagée de l'assistant : fil de messages,
   envoi à /api/chat (Claude Haiku, contexte du logement consulté),
   réponse en streaming. Un seul endroit pour la logique, deux habillages :
   le panneau flottant (ChatWidget) et le chat inline de l'accueil
   (AssistantCTA). Chaque appel du hook porte sa propre conversation —
   il n'y a qu'un point de conversation par page.

   LOGEMENT CHOISI (`apartment`) — de quoi parle le voyageur :
   - `undefined` : pas encore choisi → l'interface affiche le sélecteur ;
   - `null`      : question générale (les quatre logements) ;
   - un slug     : ce logement — envoyé à /api/chat (`apartmentSlug`), il
                   passe en tête du prompt, et ses questions suggérées
                   remplacent les amorces générales.
   Sur une page logement, ce logement est présélectionné. « Changer » revient
   au sélecteur SANS effacer la conversation.
   ------------------------------------------------------------------ */

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
  /** Horodatage d'émission (ms), affiché en discret sous la bulle. */
  at: number;
}

/**
 * Puce cliquable sous le fil. Soit elle pose une question à l'assistant
 * (`send`), soit elle emmène sur une page du site (`href`).
 */
export interface Suggestion {
  label: string;
  send?: string;
  href?: string;
}

/**
 * Filet de sécurité : le prompt demande déjà de ne pas produire de markdown,
 * mais si le modèle en renvoie malgré tout (**gras**, listes, titres…), on le
 * rend proprement plutôt que d'afficher les symboles bruts dans la bulle.
 */
export function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1") // **gras** → gras
    .replace(/__(.+?)__/g, "$1") // __gras__ → gras
    .replace(/`([^`]+?)`/g, "$1") // `code` → code
    .replace(/\[([^\]]+?)\]\([^)]*\)/g, "$1") // [texte](url) → texte
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, "") // titres markdown → texte
    .replace(/^[ \t]*[-*+][ \t]+/gm, "• ") // puces markdown → puce typographique
    .replace(/[ \t]+$/gm, ""); // espaces de fin de ligne
}

/** Suggestion de suite : `id` pilote l'enchaînement, `label` est affiché. */
interface FollowUp {
  id: string;
  label: string;
}

/**
 * Sujet du dernier échange, déduit de mots-clés FR + EN. Sert uniquement à
 * choisir les deux suggestions de suite les plus naturelles — jamais à
 * modifier la réponse elle-même.
 */
const TOPIC_PATTERNS: [string, RegExp][] = [
  ["booking", /r[ée]serv|booking|book\b|tarif|prix|price|rate|dispo|availab/i],
  ["arrival", /arriv|check.?in|cl[ée]s?\b|key|d[ée]part|check.?out/i],
  ["capacity", /voyageur|personne|guest|sleep|couchage|chambre|bedroom|famille|family|enfant|child/i],
  ["amenities", /[ée]quipement|amenit|cuisine|kitchen|wifi|clim|piscine|pool|baignoire|linge|linen/i],
  ["around", /alentour|autour|nearby|around|plage|beach|visit|faire|do\b|restaurant|balade|walk/i],
  ["houses", /maison|logement|house|adresse|address|param[ée]|rempart|guadeloupe|deshaies|studio|tiny/i],
];

/**
 * Enchaînements naturels : après avoir parlé de X, on propose Y puis Z.
 * L'ordre compte — la première suggestion est la plus probable.
 */
const NEXT_BY_TOPIC: Record<string, string[]> = {
  houses: ["amenities", "around", "capacity"],
  amenities: ["capacity", "around", "booking"],
  around: ["houses", "amenities", "booking"],
  capacity: ["amenities", "arrival", "booking"],
  arrival: ["booking", "amenities", "around"],
  booking: ["arrival", "capacity", "houses"],
};

/** Ordre de repli quand le sujet n'est pas identifiable. */
const FALLBACK_ORDER = ["houses", "around", "amenities", "booking"];

function detectTopic(text: string): string | null {
  for (const [topic, re] of TOPIC_PATTERNS) if (re.test(text)) return topic;
  return null;
}

/**
 * `enabled` = clé Anthropic présente côté serveur (booléen passé depuis un
 * composant serveur, jamais la clé elle-même). Si false → aucune requête.
 */
export function useAssistantChat(enabled = true) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const pathname = usePathname();

  // Slug du logement dont la page est consultée : présélection.
  const currentSlug =
    pathname.match(/^\/appartements\/([^/]+)\/?$/)?.[1] ?? undefined;

  const [apartment, setApartment] = useState<string | null | undefined>(
    currentSlug,
  );
  // Navigation SPA vers une autre page logement : on suit la page.
  useEffect(() => {
    if (currentSlug) setApartment(currentSlug);
  }, [currentSlug]);

  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // Suggestions déjà cliquées — on ne les repropose pas.
  const [usedSuggestions, setUsedSuggestions] = useState<string[]>([]);

  const disabled = !enabled;

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    // `disabled` (pas de clé) ne bloque pas l'envoi : /api/chat renvoie alors
    // un message de repli courtois — le voyageur n'est jamais face à un champ mort.
    if (!trimmed || loading) return;

    const next: AssistantMessage[] = [
      ...messages,
      { role: "user", content: trimmed, at: Date.now() },
    ];
    setMessages(next);
    setUsedSuggestions((s) => (s.includes(trimmed) ? s : [...s, trimmed]));
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          locale,
          apartmentSlug: apartment ?? null,
        }),
      });

      if (!res.ok || !res.body) throw new Error("Network error");

      const at = Date.now();
      setMessages((m) => [...m, { role: "assistant", content: "", at }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: acc, at };
          return copy;
        });
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: t("error"), at: Date.now() },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function send() {
    sendMessage(input);
  }

  /** Repart d'un fil vierge (bouton discret de l'en-tête). */
  const reset = useCallback(() => {
    setMessages([]);
    setUsedSuggestions([]);
    setInput("");
  }, []);

  const awaitingFirstToken =
    loading &&
    (messages.length === 0 ||
      messages[messages.length - 1].role === "user" ||
      messages[messages.length - 1].content === "");

  /** Logement choisi (données), pour le badge et les suggestions. */
  const chosen = apartment
    ? apartments.find((a) => a.slug === apartment)
    : undefined;

  /**
   * Amorces affichées tant que le voyageur n'a rien écrit : les 4 questions
   * du logement choisi, ou les 4 questions générales. Rien au sélecteur.
   */
  const starters: Suggestion[] = useMemo(() => {
    if (messages.length > 0 || apartment === undefined) return [];
    const list = chosen?.chatSuggestions
      ? pick(chosen.chatSuggestions, locale as Locale)
      : (t.raw("suggestions") as string[]);
    return list
      .filter((s) => !usedSuggestions.includes(s))
      .map((s) => ({ label: s, send: s }));
  }, [messages.length, apartment, chosen, locale, usedSuggestions, t]);

  const changeApartment = useCallback(() => setApartment(undefined), []);

  /**
   * Suites proposées après une réponse terminée :
   * - si l'assistant vient de citer un logement → actions ciblées sur ELLE
   *   (voir la page, ses équipements, la réserver) ;
   * - sinon → 3 relances génériques classées par sujet ;
   * - pendant la frappe → rien, on ne coupe pas la réponse.
   */
  const followUps: Suggestion[] = useMemo(() => {
    if (!messages.length) return [];

    const last = messages[messages.length - 1];
    if (loading || last.role !== "assistant" || !last.content) return [];

    const houses = housesIn(last.content, locale as Locale);
    if (houses.length === 1) {
      const h = houses[0];
      return [
        { label: t("houseActions.view"), href: `/appartements/${h.slug}` },
        {
          label: t("houseActions.amenities"),
          send: t("houseAsk.amenities", { name: h.name }),
        },
        {
          label: t("houseActions.book"),
          send: t("houseAsk.book", { name: h.name }),
        },
      ].filter((s) => !s.send || !usedSuggestions.includes(s.send));
    }

    const pool = (t.raw("followUps") as FollowUp[]).filter(
      (f) => !usedSuggestions.includes(f.label),
    );
    if (!pool.length) return [];

    // Le sujet se lit d'abord dans la question du voyageur, à défaut dans
    // la réponse — c'est la question qui porte l'intention.
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const topic =
      detectTopic(lastUser?.content ?? "") ?? detectTopic(last.content);
    const order = [...(topic ? NEXT_BY_TOPIC[topic] ?? [] : []), ...FALLBACK_ORDER];

    const ranked = [
      ...order.flatMap((id) => pool.filter((f) => f.id === id)),
      ...pool,
    ];
    // Dédoublonnage en gardant l'ordre de pertinence.
    const seen = new Set<string>();
    return ranked
      .filter((f) => !seen.has(f.label) && seen.add(f.label))
      .slice(0, 3)
      .map((f) => ({ label: f.label, send: f.label }));
  }, [messages, loading, usedSuggestions, locale, t]);

  return {
    apartment,
    chosen,
    /** Choisit le logement (slug) ou la question générale (`null`). */
    chooseApartment: setApartment as (slug: string | null) => void,
    /** Retour au sélecteur ; la conversation est conservée. */
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
  };
}
