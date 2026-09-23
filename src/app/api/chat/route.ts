import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "@/lib/assistant-knowledge";
import type { Locale } from "@/i18n/routing";
import { toLocale } from "@/lib/locale";

/** Messages de repli (clé absente / erreur), dans la langue du site — à la
    première personne : c'est « Gwenaëlle » qui parle. */
const FALLBACK_DISABLED: Record<Locale, string> = {
  fr: "Mon assistante en ligne n’est pas encore connectée. Pour toute question, écrivez-moi via le formulaire de contact — je vous réponds vite et avec plaisir.",
  en: "My online assistant isn’t connected yet. For any question, write to me through the contact form — I reply quickly and with pleasure.",
  de: "Meine Online-Assistentin ist noch nicht verbunden. Bei Fragen schreiben Sie mir bitte über das Kontaktformular — ich antworte schnell und gern.",
  nl: "Mijn online assistente is nog niet verbonden. Schrijf mij bij vragen via het contactformulier — ik antwoord snel en met plezier.",
  es: "Mi asistente en línea aún no está conectada. Para cualquier pregunta, escríbame a través del formulario de contacto: le respondo rápido y con gusto.",
  zh: "我的在线助手尚未接入。如有任何问题，请通过联系表单给我留言——我会尽快并乐意回复您。",
};
const FALLBACK_ERROR: Record<Locale, string> = {
  fr: "Désolée, je n’ai pas pu vous répondre à l’instant. Réessayez, ou écrivez-moi via le formulaire de contact.",
  en: "Sorry, I couldn’t reply just now. Please try again, or write to me through the contact form.",
  de: "Entschuldigen Sie, ich konnte gerade nicht antworten. Versuchen Sie es erneut oder schreiben Sie mir über das Kontaktformular.",
  nl: "Sorry, ik kon zojuist niet antwoorden. Probeer het opnieuw of schrijf mij via het contactformulier.",
  es: "Lo siento, no he podido responderle ahora mismo. Inténtelo de nuevo o escríbame a través del formulario de contacto.",
  zh: "抱歉，我暂时无法回复您。请再试一次，或通过联系表单给我留言。",
};

export const runtime = "nodejs";
export const maxDuration = 30;

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

const MODEL = "claude-haiku-4-5-20251001";

function textResponse(text: string) {
  return new Response(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(req: Request) {
  let payload: { messages?: unknown; locale?: unknown; slug?: unknown };
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const locale: Locale = toLocale(payload.locale);
  // Slug du logement consulté (facultatif) — validé côté buildSystemPrompt.
  const currentSlug =
    typeof payload.slug === "string" ? payload.slug : undefined;

  // Nettoyage / garde-fous sur l'historique reçu.
  const history: IncomingMessage[] = Array.isArray(payload.messages)
    ? (payload.messages as unknown[])
        .filter(
          (m): m is IncomingMessage =>
            !!m &&
            typeof m === "object" &&
            (("role" in m && (m as IncomingMessage).role === "user") ||
              (m as IncomingMessage).role === "assistant") &&
            typeof (m as IncomingMessage).content === "string" &&
            (m as IncomingMessage).content.trim().length > 0,
        )
        .map((m) => ({
          role: m.role,
          content: m.content.slice(0, 2000),
        }))
        .slice(-12)
    : [];

  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return new Response("Bad request", { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Démo sans clé : repli chaleureux plutôt qu'une erreur.
  if (!apiKey) {
    return textResponse(FALLBACK_DISABLED[locale]);
  }

  const client = new Anthropic({ apiKey });
  const system = buildSystemPrompt(locale, currentSlug);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        const events = await client.messages.create({
          model: MODEL,
          max_tokens: 700,
          temperature: 0.4,
          system,
          messages: history.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          stream: true,
        });

        for await (const event of events) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        console.error("[chat] erreur Anthropic:", err);
        controller.enqueue(encoder.encode(FALLBACK_ERROR[locale]));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
