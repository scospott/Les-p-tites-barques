import "server-only";

import type { Locale } from "@/i18n/routing";
import { pick, type Apartment } from "./appartements";
import { BOOKING_EXTRAS, DIRECT_DISCOUNT } from "./booking-extras";
import { getApartments, getAssistante, has, localise } from "@/sanity/adapters";

/* ============================================================
   Prompt système de l'assistante (Claude Haiku) — /api/chat.

   Le TEXTE des consignes vient de Sanity (Assistante › Consignes
   générales, rédigées en français, lues quelle que soit la langue du
   visiteur : l'assistante répond dans la sienne). Les jetons qu'il
   contient sont remplis ici, à chaque requête :
     {{logements}}  fiches des logements publiés (Sanity), détaillée et
                    stricte si le voyageur a choisi un logement
     {{lieux}}      lieux réels des itinéraires proposés sur les pages
     {{remise}}     remise réservation directe (lib/booking-extras)
     {{extras}}     extras de réservation et leurs prix
     {{versionSite}} / {{langueSite}}  langue de la page consultée
   S'y ajoutent, s'ils sont remplis dans le Studio, la FAQ, les règles de
   la maison et les recommandations.

   Cache : les lectures Sanity passent par le Data Cache (5 min +
   webhook, cf. src/sanity/fetch.ts).

   Garde-fous inchangés : jamais de prix ni de disponibilité inventés ;
   logement choisi → consigne PRIORITAIRE en tête et SA fiche seule.
   ============================================================ */

/** Remise directe en pourcentage entier (« −10 % »). */
const DISCOUNT_PCT = Math.round(DIRECT_DISCOUNT * 100);

/** Langue de la page, pour la consigne de repli (« la version française… »). */
const SITE_LANGUAGE: Record<Locale, { version: string; langue: string }> = {
  fr: { version: "française", langue: "français" },
  en: { version: "anglaise", langue: "anglais" },
  de: { version: "allemande", langue: "allemand" },
  nl: { version: "néerlandaise", langue: "néerlandais" },
  es: { version: "espagnole", langue: "espagnol" },
  zh: { version: "chinoise", langue: "chinois simplifié" },
};

/** Les lieux dont l'assistant a le droit de parler (itinéraires des pages). */
function realPlaces(apartments: Apartment[]): string {
  const set = new Set<string>();
  for (const a of apartments) {
    for (const point of a.mapPoints ?? []) set.add(point.label);
  }
  return [...set].join(", ");
}

/** Les extras, prêts à réciter : « bouteille de champagne (45 €) ». */
function extrasLine(): string {
  return BOOKING_EXTRAS.map((e) => {
    const per = e.perGuest ? " / personne" : "";
    return `${e.label.fr} (${e.price} €${per})`;
  }).join(", ");
}

function apartmentBlock(a: Apartment, locale: Locale, detailed = false): string {
  const fr = locale === "fr";
  const lines: string[] = [];
  lines.push(`### ${pick(a.name, locale)} (slug: ${a.slug})`);
  lines.push(`- ${fr ? "Localisation" : "Location"}: ${pick(a.locality, locale)}`);
  lines.push(`- ${fr ? "En bref" : "In short"}: ${pick(a.tagline, locale)}`);

  if (a.address) {
    lines.push(`- ${fr ? "Adresse" : "Address"}: ${a.address}`);
  }
  if (a.capacity) {
    const max = a.maxGuests
      ? fr
        ? ` (maximum ${a.maxGuests} voyageurs)`
        : ` (maximum ${a.maxGuests} guests)`
      : "";
    lines.push(
      `- ${fr ? "Capacité" : "Capacity"}: ${pick(a.capacity, locale)}${max}`,
    );
  }
  if (a.facts?.length) {
    for (const f of a.facts) {
      lines.push(`- ${pick(f.label, locale)}: ${pick(f.value, locale)}`);
    }
  }
  // Équipements : catégories (modèle actuel) ou liste simple (ancien champ).
  if (a.equipements?.length) {
    const cats = a.equipements
      .map((c) => `${c.title} (${c.items.join(", ")})`)
      .join(" ; ");
    lines.push(`- ${fr ? "Équipements" : "Amenities"}: ${cats}`);
  } else if (a.amenities) {
    lines.push(`- ${fr ? "Équipements" : "Amenities"}: ${pick(a.amenities, locale).join(", ")}`);
  }
  if (a.highlights) {
    lines.push(`- ${fr ? "Atouts" : "Highlights"}: ${pick(a.highlights, locale).join(" ; ")}`);
  }
  if (a.signature) {
    lines.push(
      `- ${fr ? "Détail signature" : "Signature detail"}: ${pick(a.signature, locale)}`,
    );
  }
  if (a.locationNote) {
    lines.push(`- ${fr ? "Situation" : "Setting"}: ${pick(a.locationNote, locale)}`);
  }
  if (a.mapPoints?.length) {
    // Le mode de déplacement est une info utile au voyageur (« c'est à pied ? »)
    // et il est déjà affiché sur la page : on le donne tel quel.
    const points = a.mapPoints
      .map((point) => {
        const walk = (point.mode ?? "driving") === "walking";
        return `${point.label} (${
          fr ? (walk ? "à pied" : "en voiture") : walk ? "on foot" : "by car"
        })`;
      })
      .join(", ");
    lines.push(
      `- ${fr ? "Itinéraires proposés sur la page" : "Routes offered on the page"}: ${points}`,
    );
  }
  if (a.gallery?.length) {
    lines.push(
      fr
        ? `- Galerie: ${a.gallery.length} photos réelles du logement (carrousel + plein écran au clic, en bas de la page).`
        : `- Gallery: ${a.gallery.length} real photos of the home (carousel + full screen on click, near the bottom of the page).`,
    );
  }
  if (typeof a.rating === "number") {
    const scale = a.ratingScale ?? 5;
    const count = a.reviewCount
      ? ` (${a.reviewCount} ${fr ? "avis" : "reviews"})`
      : "";
    lines.push(`- ${fr ? "Note voyageurs" : "Guest rating"}: ${a.rating}/${scale}${count}`);
  }
  if (a.reviewBadge) {
    lines.push(`- ${fr ? "Distinction" : "Distinction"}: ${pick(a.reviewBadge, locale)}`);
  }
  if (a.description) {
    lines.push(`- ${fr ? "Description" : "Description"}: ${pick(a.description, locale).join(" ")}`);
  }
  // Tarifs : ceux du bloc réservation sont des placeholders en attente de
  // validation par la cliente → l'assistant ne les récite JAMAIS. Il renvoie
  // vers le bloc « Réserver en direct » de la page ou vers Gwenaëlle.
  if (a.pricing) {
    lines.push(
      fr
        ? `- Tarifs: NE DONNE AUCUN CHIFFRE. Ils s'affichent dans le calendrier de réservation de la page (bloc « Réserver en direct », sélection des dates), avec la remise de −${DISCOUNT_PCT} % réservation directe appliquée sur les nuits. Ne calcule jamais un total de séjour.`
        : `- Rates: NEVER QUOTE A FIGURE. They are shown in the booking calendar on the page ("Book directly" section, once dates are picked), with the −${DISCOUNT_PCT}% direct-booking discount applied to the nights. Never work out a stay total.`,
    );
  }
  // Avis : uniquement pour le logement consulté (évite un prompt trop long).
  if (detailed && a.reviews?.length) {
    const quotes = a.reviews
      .slice(0, 6)
      .map((r) => `« ${r.text} » (${r.name}${r.country ? `, ${r.country}` : ""})`)
      .join(" ");
    lines.push(`- ${fr ? "Avis voyageurs" : "Guest reviews"}: ${quotes}`);
  }

  if (a.status === "placeholder") {
    lines.push(
      locale === "fr"
        ? "- ⚠️ Détails (surface, composition, équipements, prix) NON CONNUS — ne rien inventer, inviter à consulter la page ou à m'écrire via le formulaire de contact."
        : "- ⚠️ Details (surface, layout, amenities, price) NOT KNOWN — do not invent anything, invite the guest to check the page or to write to me through the contact form.",
    );
  } else if (a.status === "partial") {
    lines.push(
      locale === "fr"
        ? "- ⚠️ Surface, composition et capacité NON CONNUES pour l'instant — ne pas inventer."
        : "- ⚠️ Surface, layout and capacity NOT KNOWN yet — do not invent.",
    );
  }
  return lines.join("\n");
}

/**
 * Consigne PRIORITAIRE, posée en tête du prompt quand un logement est choisi :
 * on ne parle que de lui. (Une simple mise en avant ne suffisait pas : avec les
 * quatre fiches dans le prompt, le modèle décrivait parfois un autre logement.)
 */
export function strictInstruction(a: Apartment, locale: Locale): string {
  const name = pick(a.name, locale);
  return locale !== "fr"
    ? `# PRIORITY INSTRUCTION — ${name} only\nYou answer ONLY about "${name}". Never describe another home and never recommend one, unless the guest explicitly asks for an alternative. Do not invent any amenity: only cite what is in the "${name}" sheet below.\n\n`
    : `# CONSIGNE PRIORITAIRE — ${name} uniquement\nTu réponds uniquement sur « ${name} ». Ne décris jamais un autre logement et ne le recommande pas, sauf demande explicite du voyageur. N'invente aucun équipement : ne cite que ce qui figure dans la fiche « ${name} » ci-dessous.\n\n`;
}

/**
 * Ligne « Autres logements » : nom + ville + capacité maximale, sans fiche. Elle ne sert qu'à
 * répondre « je ne sais pas, mais j'ai aussi… » si le voyageur demande une
 * alternative, ou si sa demande est incompatible (capacité, destination).
 */
function otherHomesLine(
  apartments: Apartment[],
  current: Apartment,
  locale: Locale,
): string {
  const others = apartments
    .filter((a) => a.slug !== current.slug)
    // Capacité maximale incluse : sans elle, le modèle inventait qu'un autre
    // logement accueillait « plus de monde » (aucun ne dépasse 3 voyageurs).
    .map((a) => {
      const max = a.maxGuests
        ? locale !== "fr"
          ? ` — ${a.maxGuests} guests max`
          : ` — ${a.maxGuests} voyageurs max`
        : "";
      return `${pick(a.name, locale)} (${pick(a.locality, locale)}${max})`;
    })
    .join(", ");
  // Capacité maximale, tous logements confondus : un fait simple que le
  // modèle ne peut pas contourner (il affirmait sinon « plus grande capacité »).
  const top = Math.max(...apartments.map((a) => a.maxGuests ?? 0));
  return locale !== "fr"
    ? `\n\n### My other homes (no details — mention them ONLY if the guest explicitly asks for an alternative, or if their request cannot work at "${pick(current.name, locale)}": capacity, destination)\n${others}\nNone of my homes sleeps more than ${top} guests. Never suggest another home without checking its capacity above; if none fits, say so simply and invite the guest to write to me through the contact form.`
    : `\n\n### Mes autres logements (sans détail — à mentionner UNIQUEMENT si le voyageur demande explicitement une alternative, ou si sa demande est incompatible avec « ${pick(current.name, locale)} » : capacité, destination)\n${others}\nAucun de mes logements n'accueille plus de ${top} voyageurs. Ne propose jamais un autre logement sans vérifier sa capacité ci-dessus ; si aucun ne convient, dis-le simplement et invite à m'écrire via le formulaire de contact.`;
}

/**
 * Logement dont le voyageur a choisi de parler (sélecteur de l'assistante, ou
 * page logement consultée). Slug inconnu → question générale.
 */
export async function focusApartment(slug?: string | null): Promise<Apartment | undefined> {
  return slug ? (await getApartments()).find((a) => a.slug === slug) : undefined;
}

/** Remplit les jetons `{{…}}` des consignes. Un jeton inconnu reste visible. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (all, key: string) => values[key] ?? all);
}

export async function buildSystemPrompt(
  locale: Locale,
  apartmentSlug?: string | null,
): Promise<string> {
  const [apartments, assistante] = await Promise.all([getApartments(), getAssistante()]);
  const current = apartmentSlug ? apartments.find((a) => a.slug === apartmentSlug) : undefined;

  // Logement choisi : SA fiche détaillée seule, plus une ligne « autres
  // logements ». Question générale : toutes les fiches.
  const logements = current
    ? apartmentBlock(current, locale, true) + otherHomesLine(apartments, current, locale)
    : apartments.map((a) => apartmentBlock(a, locale)).join("\n\n");

  const consignes = fill(assistante.consignesGenerales ?? "", {
    logements,
    lieux: realPlaces(current ? [current] : apartments),
    remise: String(DISCOUNT_PCT),
    extras: extrasLine(),
    versionSite: SITE_LANGUAGE[locale].version,
    langueSite: SITE_LANGUAGE[locale].langue,
  });

  // Compléments éditables dans le Studio (vides aujourd'hui).
  const extra: string[] = [];
  const faq = (assistante.faq ?? []).filter((f) => has(f, "question") && has(f, "reponse"));
  if (faq.length) {
    extra.push(
      "# Questions fréquentes (réponses à reprendre fidèlement)\n" +
        faq.map((f) => `- ${localise(f, "question", locale)} → ${localise(f, "reponse", locale)}`).join("\n"),
    );
  }
  const rules = localise(assistante, "reglesMaison", locale);
  if (rules) extra.push(`# Règles de la maison\n${rules}`);
  const tips = localise(assistante, "recommandations", locale);
  if (tips) extra.push(`# Mes recommandations\n${tips}`);

  const strict = current ? strictInstruction(current, locale) : "";
  return [strict + consignes, ...extra].join("\n\n");
}
