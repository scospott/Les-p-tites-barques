"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import Reveal from "@/components/Reveal";
import type { Locale } from "@/i18n/routing";
import type { Pricing } from "@/lib/appartements";
import { BOOKING_EXTRAS, DIRECT_DISCOUNT } from "@/lib/booking-extras";
import Ornament from "@/components/Ornament";
import { LOCALE_TAGS, WEEKDAYS, formatRating } from "@/lib/locale";

/* ------------------------------------------------------------------
   PARCOURS DE RÉSERVATION DE DÉMONSTRATION — 4 étapes, 100 % en state local.
   (Brancher Smoobu ici plus tard : dispos réelles, empreinte de caution,
   contrat, fiche de police — hors périmètre de cette maquette.)
     1. Dates (calendrier réellement cliquable) + voyageurs (stepper)
     2. Extras cochables (champagne, roses, gâteau, petit-déjeuner, transfert)
     3. Coordonnées + récapitulatif complet
     4. Écran de confirmation « démonstration »

   RIEN N'EST ENVOYÉ NULLE PART : aucun fetch, aucun stockage, aucun moteur
   de résa. Les tarifs viennent du logement affiché (lib/appartements.ts) et
   sont des PLACEHOLDERS — TODO tarifs réels à confirmer avec la cliente.

   Déterminisme SSR : le calendrier démarre sur un mois FIXE (juillet 2026) et
   les dates « occupées » sortent d'un PRNG semé par le mois — serveur et
   client calculent donc exactement la même grille (pas d'écart d'hydratation).

   DA : blanc / taupe (token ink) / kaki #656B57 (sélection), crème #F1ECE3,
   CAMEL (token terra) pour les boutons d'action, une seule serif (Fraunces),
   radius 18px, filets 0.5px. Chiffres du calendrier et du récap en
   tabulaires (`.tabular`).
   ------------------------------------------------------------------ */

const KAKI = "#656B57";
const KAKI_LIGHT = "#B3B49A";
const RANGE_BG = "#e8ece7"; // plage arrivée→départ
const OCCUPIED_BG = "#e3e6e1"; // gris-vert « occupé »
const CREAM = "#F1ECE3";
const SERIF = "var(--font-display)";

/** Mois d'ouverture du calendrier (0-indexé) et fenêtre navigable. */
const START_YEAR = 2026;
const START_MONTH = 6; // juillet
const MONTHS_AHEAD = 11;
/** Séjour minimum affiché sur les 4 fiches. */
const MIN_NIGHTS = 2;
/** Haute saison : juillet, août, décembre. */
const HIGH_SEASON = new Set([6, 7, 11]);

const MS_PER_DAY = 86_400_000;

/** Tarifs de repli si le logement n'en déclare pas (ne devrait pas arriver). */
const FALLBACK_PRICING: Pricing = { high: 150, low: 120, cleaning: 45 };

/* Options payantes de l'étape 2 — prix depuis lib/booking-extras.ts (source
   partagée avec l'assistant), libellés depuis les fichiers de messages. */
const EXTRAS = BOOKING_EXTRAS;

type ExtraId = string;

/* ---------------------------- utilitaires date ---------------------------- */

/** Numéro de jour absolu (UTC) — comparable, soustrayable : nuits = b - a. */
const dayNum = (y: number, m: number, d: number) =>
  Date.UTC(y, m, d) / MS_PER_DAY;

const toDate = (n: number) => new Date(n * MS_PER_DAY);

const daysInMonth = (y: number, m: number) =>
  new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/** Jour de semaine du 1er du mois, lundi = 0 (grille européenne). */
const firstWeekdayIndex = (y: number, m: number) =>
  (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;

/**
 * Dates « occupées » du mois — deux séjours de 3 à 4 nuits, tirés d'un PRNG
 * (Lehmer) semé par le mois. Déterministe : même résultat au SSR et au client,
 * et le calendrier ne change pas d'un rendu à l'autre.
 */
const occupiedCache = new Map<number, Set<number>>();

function occupiedSet(y: number, m: number): Set<number> {
  const key = y * 12 + m;
  const cached = occupiedCache.get(key);
  if (cached) return cached;

  let s = (key * 7919) % 2_147_483_647 || 1;
  const rnd = () => (s = (s * 48_271) % 2_147_483_647) / 2_147_483_647;

  const total = daysInMonth(y, m);
  const out = new Set<number>();
  for (let k = 0; k < 2; k += 1) {
    const start = 2 + Math.floor(rnd() * (total - 9));
    const len = 3 + Math.floor(rnd() * 2);
    for (let d = start; d < start + len && d <= total; d += 1) out.add(d);
  }
  occupiedCache.set(key, out);
  return out;
}

function isOccupied(n: number): boolean {
  const dt = toDate(n);
  return occupiedSet(dt.getUTCFullYear(), dt.getUTCMonth()).has(
    dt.getUTCDate(),
  );
}

/** Une nuit occupée entre l'arrivée (incluse) et le départ (exclu) ? */
function rangeBlocked(from: number, to: number): boolean {
  for (let n = from; n < to; n += 1) if (isOccupied(n)) return true;
  return false;
}

/* --------------------------------- pictos --------------------------------- */

function Check({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function LegendSwatch({ style }: { style: React.CSSProperties }) {
  return (
    <span
      aria-hidden
      className="inline-block h-3 w-3 shrink-0 rounded-[4px]"
      style={style}
    />
  );
}

/* ------------------------------- composant -------------------------------- */

export default function BookingBlock({
  kicker = "Réservation",
  title = "Réserver en direct",
  ctaLabel = "Réserver en direct",
  apartmentName,
  pricing,
  rating,
  badge,
  maxGuests = 4,
}: {
  kicker?: string;
  /** Gros titre de section (« Réserver en direct »). */
  title?: string;
  /** Conservé pour la compatibilité d'appel ; sert de repli au CTA d'étape 1. */
  ctaLabel?: string;
  /** Nom du logement, rappelé dans le récapitulatif et la confirmation. */
  apartmentName?: string;
  /** Tarifs du logement affiché (placeholders). */
  pricing?: Pricing | null;
  /** Note voyageurs du logement (affichée sous le prix). */
  rating?: number | null;
  /** Badge générique (« Coup de cœur des voyageurs »). */
  badge?: string | null;
  /** Borne haute du stepper voyageurs. */
  maxGuests?: number;
}) {
  const t = useTranslations("booking");
  const locale = useLocale() as Locale;

  const p = pricing ?? FALLBACK_PRICING;

  /* ------------------------------- state ------------------------------- */
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [cursor, setCursor] = useState(0); // décalage en mois depuis START
  const [arrival, setArrival] = useState<number | null>(null);
  const [departure, setDeparture] = useState<number | null>(null);
  // Le couple est le cas par défaut, borné par la capacité du logement.
  const defaultGuests = Math.min(2, maxGuests);
  const [guests, setGuests] = useState(defaultGuests);
  const [extras, setExtras] = useState<ExtraId[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [showErrors, setShowErrors] = useState(false);

  /* Changement d'étape : on ramène le focus et la vue en haut du panneau.
     Sans cela, en mobile, le bouton « Continuer » est SOUS le panneau : on
     resterait en bas de page devant l'étape suivante déjà défilée.
     Garde sur l'étape PRÉCÉDENTE (et non un simple drapeau « monté ») : en
     StrictMode (dev) l'effet est exécuté deux fois au montage, et un drapeau
     déjà levé faisait sauter la page au bloc réservation à l'arrivée — ce qui
     annulait le scroll-to-top de la navigation. */
  const panelRef = useRef<HTMLDivElement>(null);
  const prevStep = useRef(step);
  useEffect(() => {
    if (prevStep.current === step) return;
    prevStep.current = step;
    const el = panelRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "start" });
  }, [step]);

  /* ------------------------------ formats ------------------------------ */
  const tag = LOCALE_TAGS[locale];

  const money = useCallback(
    (value: number) =>
      new Intl.NumberFormat(tag, {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(value),
    [tag],
  );

  const monthLabel = useMemo(() => {
    const d = new Date(Date.UTC(START_YEAR, START_MONTH + cursor, 1));
    return new Intl.DateTimeFormat(tag, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(d);
  }, [tag, cursor]);

  const longDate = useCallback(
    (n: number | null) =>
      n === null
        ? null
        : new Intl.DateTimeFormat(tag, {
            day: "numeric",
            month: "long",
            timeZone: "UTC",
          }).format(toDate(n)),
    [tag],
  );

  const fullDate = useCallback(
    (n: number) =>
      new Intl.DateTimeFormat(tag, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(toDate(n)),
    [tag],
  );

  /* ------------------------------- calculs ------------------------------ */
  const nights = arrival !== null && departure !== null ? departure - arrival : 0;
  const datesValid = nights >= MIN_NIGHTS;

  const nightlyRate =
    arrival !== null && HIGH_SEASON.has(toDate(arrival).getUTCMonth())
      ? p.high
      : p.low;

  const accommodation = nightlyRate * nights;
  const discount = Math.round(accommodation * DIRECT_DISCOUNT);

  const extrasLines = useMemo(
    () =>
      EXTRAS.filter((e) => extras.includes(e.id)).map((e) => ({
        id: e.id,
        amount: e.perGuest ? e.price * guests : e.price,
      })),
    [extras, guests],
  );
  const extrasTotal = extrasLines.reduce((sum, l) => sum + l.amount, 0);

  const total = nights
    ? accommodation - discount + p.cleaning + extrasTotal
    : 0;

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim());
  const formValid = form.name.trim().length > 1 && emailOk && form.phone.trim().length > 4;

  const ratingStr =
    typeof rating === "number" ? formatRating(rating, locale) : null;

  /* ------------------------------- actions ------------------------------ */
  const pickDay = useCallback(
    (n: number) => {
      if (isOccupied(n)) return;
      // Un départ n'est possible qu'après une arrivée déjà posée, et si aucune
      // nuit occupée ne coupe la plage. Sinon, le clic repose une arrivée.
      if (
        arrival !== null &&
        departure === null &&
        n > arrival &&
        !rangeBlocked(arrival, n)
      ) {
        setDeparture(n);
        return;
      }
      setArrival(n);
      setDeparture(null);
    },
    [arrival, departure],
  );

  const clearDates = useCallback(() => {
    setArrival(null);
    setDeparture(null);
  }, []);

  const toggleExtra = useCallback((id: ExtraId) => {
    setExtras((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const restart = useCallback(() => {
    setStep(1);
    setCursor(0);
    setArrival(null);
    setDeparture(null);
    setGuests(defaultGuests);
    setExtras([]);
    setForm({ name: "", email: "", phone: "", message: "" });
    setShowErrors(false);
  }, [defaultGuests]);

  const submitContact = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      // Aucune donnée ne quitte le navigateur : on passe simplement à l'écran
      // de confirmation (cf. en-tête de fichier).
      if (!formValid) {
        setShowErrors(true);
        return;
      }
      setStep(4);
    },
    [formValid],
  );

  /* ----------------------------- sous-rendus ----------------------------
     Ce sont des FONCTIONS DE RENDU, pas des composants imbriqués : un
     `<ContactStep />` défini dans le corps du composant serait une nouvelle
     identité de type à chaque rendu, donc démonté/remonté à chaque frappe —
     et le champ perdrait le focus lettre après lettre.
     ---------------------------------------------------------------------- */

  const stepNames = [t("steps.dates"), t("steps.extras"), t("steps.contact")];

  /* Rappel « réservation directe » — ce que le voyageur économise sur ce
     séjour (−10 % sur les nuits). Affiché dès qu'un séjour est chiffrable, aux
     quatre étapes. Site client : aucun comparatif de plateformes nommées. */
  const renderDirectPitch = (centered = false) =>
    nights > 0 ? (
      <div
        className={`mt-5 space-y-1 text-body leading-snug ${
          centered ? "mx-auto max-w-md text-center" : ""
        }`}
        style={{ color: KAKI_LIGHT }}
      >
        <p>{t("directSaving", { amount: money(discount) })}</p>
      </div>
    ) : null;

  /* Fil d'étapes. En mobile, les trois libellés (« Dates · Extras ·
     Coordonnées ») mesuraient 391 px pour 288 px disponibles : le troisième
     passait seul à la ligne, ce qui donnait un fil bancal. Sous `sm`, seul le
     libellé de l'étape COURANTE reste visible, les autres se réduisent à leur
     pastille numérotée — une ligne nette, et le repère « où j'en suis » reste
     lisible. Les libellés masqués passent en `sr-only` (et non `hidden`) :
     ils restent annoncés aux lecteurs d'écran. */
  const renderStepper = () => (
    <ol className="flex flex-wrap items-center gap-x-2.5 gap-y-2 sm:gap-x-3">
      {stepNames.map((label, i) => {
        const index = i + 1;
        const done = step > index;
        const current = step === index;
        return (
          <li key={label} className="flex items-center gap-2.5 sm:gap-3">
            <span
              className="inline-flex items-center text-body"
              style={{ color: current || done ? "#4F4A44" : "#736F69" }}
            >
              <span
                aria-hidden
                className="tabular grid h-8 w-8 place-items-center rounded-full text-body font-semibold"
                style={
                  done
                    ? { backgroundColor: KAKI, color: "#fff" }
                    : current
                      ? { backgroundColor: "#4F4A44", color: "#fff" }
                      : {
                          border: "0.5px solid var(--color-line)",
                          color: "#736F69",
                        }
                }
              >
                {done ? <Check size={14} /> : index}
              </span>
              <span
                className={
                  current
                    ? "ml-2.5"
                    : "sr-only sm:not-sr-only sm:ml-2.5"
                }
              >
                {label}
              </span>
            </span>
            {i < stepNames.length - 1 && (
              <span aria-hidden className="h-px w-4 bg-line sm:w-10" />
            )}
          </li>
        );
      })}
    </ol>
  );

  /* --------- Étape 1 : calendrier interactif + stepper voyageurs -------- */
  const renderCalendarStep = () => {
    const y = START_YEAR + Math.floor((START_MONTH + cursor) / 12);
    const m = (START_MONTH + cursor) % 12;
    const lead = firstWeekdayIndex(y, m);
    const total = daysInMonth(y, m);

    return (
      <>
        <div className="flex items-center justify-between gap-4">
          <p className="subtitle text-ink">{monthLabel}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCursor((c) => Math.max(0, c - 1))}
              disabled={cursor === 0}
              aria-label={t("prevMonth")}
              className="flex h-10 w-10 items-center justify-center rounded-full border-[0.5px] border-line text-ink transition-colors hover:bg-offwhite disabled:cursor-default disabled:text-ink-faint disabled:opacity-40 disabled:hover:bg-transparent"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setCursor((c) => Math.min(MONTHS_AHEAD, c + 1))}
              disabled={cursor === MONTHS_AHEAD}
              aria-label={t("nextMonth")}
              className="flex h-10 w-10 items-center justify-center rounded-full border-[0.5px] border-line text-ink transition-colors hover:bg-offwhite disabled:cursor-default disabled:text-ink-faint disabled:opacity-40 disabled:hover:bg-transparent"
            >
              ›
            </button>
          </div>
        </div>

        <p className="mt-2 text-body text-ink-soft">
          {arrival === null || departure !== null
            ? t("pickArrival")
            : t("pickDeparture")}
        </p>

        <div className="mt-5 grid grid-cols-7 gap-0.5 sm:gap-1">
          {WEEKDAYS[locale].map((d, i) => (
            <span
              key={i}
              aria-hidden
              className="flex h-9 items-center justify-center text-eyebrow font-medium uppercase tracking-[0.12em] text-ink-faint"
            >
              {d}
            </span>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <span key={`e${i}`} />
          ))}
          {Array.from({ length: total }, (_, i) => {
            const day = i + 1;
            const n = dayNum(y, m, day);
            const busy = isOccupied(n);
            const isArrival = n === arrival;
            const isDeparture = n === departure;
            const selected = isArrival || isDeparture;
            const inRange =
              arrival !== null &&
              departure !== null &&
              n > arrival &&
              n < departure;

            return (
              <button
                key={day}
                type="button"
                onClick={() => pickDay(n)}
                disabled={busy}
                aria-pressed={selected}
                aria-label={fullDate(n)}
                className={`tabular flex h-11 items-center justify-center rounded-[10px] text-body transition-colors ${
                  selected
                    ? "font-semibold text-white"
                    : busy
                      ? "cursor-not-allowed text-ink-faint line-through"
                      : "text-ink hover:bg-offwhite"
                }`}
                style={
                  selected
                    ? { backgroundColor: KAKI }
                    : inRange
                      ? { backgroundColor: RANGE_BG }
                      : busy
                        ? { backgroundColor: OCCUPIED_BG }
                        : undefined
                }
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Légende */}
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t-[0.5px] border-line pt-5 text-body text-ink-soft">
          <span className="inline-flex items-center gap-2">
            <LegendSwatch style={{ backgroundColor: KAKI }} />
            {t("legendSelected")}
          </span>
          <span className="inline-flex items-center gap-2">
            <LegendSwatch
              style={{
                backgroundColor: "#ffffff",
                border: "0.5px solid var(--color-line)",
              }}
            />
            {t("legendAvailable")}
          </span>
          <span className="inline-flex items-center gap-2">
            <LegendSwatch style={{ backgroundColor: OCCUPIED_BG }} />
            {t("legendBusy")}
          </span>
          {arrival !== null && (
            <button
              type="button"
              onClick={clearDates}
              className="link-underline ml-auto text-body text-ink-soft"
            >
              {t("clearDates")}
            </button>
          )}
        </div>

        {/* Voyageurs — stepper */}
        <div className="mt-7 flex flex-wrap items-center justify-between gap-4 rounded-[14px] border-[0.5px] border-line px-5 py-4">
          <div>
            <p className="text-body font-medium text-ink">{t("guests")}</p>
            <p className="mt-0.5 text-body text-ink-faint">
              {t("maxGuests", { count: maxGuests })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setGuests((g) => Math.max(1, g - 1))}
              disabled={guests <= 1}
              aria-label={t("removeGuest")}
              className="grid h-11 w-11 place-items-center rounded-full border-[0.5px] border-line text-subtitle text-ink transition-colors hover:bg-offwhite disabled:opacity-35 disabled:hover:bg-transparent"
            >
              −
            </button>
            <span
              aria-live="polite"
              className="tabular min-w-[2.5rem] text-center text-body font-medium text-ink"
            >
              {guests}
            </span>
            <button
              type="button"
              onClick={() => setGuests((g) => Math.min(maxGuests, g + 1))}
              disabled={guests >= maxGuests}
              aria-label={t("addGuest")}
              className="grid h-11 w-11 place-items-center rounded-full border-[0.5px] border-line text-subtitle text-ink transition-colors hover:bg-offwhite disabled:opacity-35 disabled:hover:bg-transparent"
            >
              +
            </button>
          </div>
        </div>

        {arrival !== null && departure !== null && !datesValid && (
          <p className="mt-4 text-body" style={{ color: KAKI }}>
            {t("minStay", { count: MIN_NIGHTS })}
          </p>
        )}
      </>
    );
  };

  /* ---------------------- Étape 2 : extras cochables -------------------- */
  const renderExtrasStep = () => (
    <>
      <h3 className="subtitle text-ink">{t("extrasTitle")}</h3>
      <p className="mt-2 text-body text-ink-soft">
        {t("extrasSubtitle")}
      </p>

      <ul className="mt-6 space-y-3">
        {EXTRAS.map((e) => {
          const checked = extras.includes(e.id);
          const perGuest = !!e.perGuest;
          return (
            <li key={e.id}>
              <label
                className={`flex cursor-pointer items-center gap-4 rounded-[14px] border-[0.5px] px-5 py-4 transition-colors ${
                  checked ? "bg-offwhite" : "border-line hover:bg-offwhite/60"
                }`}
                style={checked ? { borderColor: KAKI } : undefined}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleExtra(e.id)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-[7px] border-[0.5px] text-white transition-colors"
                  style={
                    checked
                      ? { backgroundColor: KAKI, borderColor: KAKI }
                      : { borderColor: "var(--color-line)" }
                  }
                >
                  {checked && <Check size={14} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body text-ink">
                    {t(`extras.${e.id}.label`)}
                  </span>
                  <span className="mt-0.5 block text-body leading-snug text-ink-faint">
                    {t(`extras.${e.id}.note`)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="tabular block text-body text-ink">
                    {money(e.price)}
                  </span>
                  {perGuest && (
                    <span className="block text-body leading-snug text-ink-faint">
                      {t("perPerson")}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </>
  );

  /* -------------------- Étape 3 : coordonnées + récap ------------------- */
  const fieldCls =
    "mt-2 w-full rounded-[12px] border-[0.5px] border-line bg-paper px-4 py-3.5 text-body text-ink outline-none transition-colors focus:border-kaki";
  const labelCls = "kicker block text-ink-faint";

  const renderContactStep = () => (
    <>
      <h3 className="subtitle text-ink">{t("contactTitle")}</h3>

      <form id="gc-booking-form" onSubmit={submitContact} noValidate className="mt-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="gc-name">
              {t("name")}
            </label>
            <input
              id="gc-name"
              name="name"
              autoComplete="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={fieldCls}
              aria-invalid={showErrors && form.name.trim().length <= 1}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="gc-email">
              {t("email")}
            </label>
            <input
              id="gc-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className={fieldCls}
              aria-invalid={showErrors && !emailOk}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="gc-phone">
              {t("phone")}
            </label>
            <input
              id="gc-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className={fieldCls}
              aria-invalid={showErrors && form.phone.trim().length <= 4}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="gc-message">
              {t("message")}
            </label>
            <textarea
              id="gc-message"
              name="message"
              rows={4}
              placeholder={t("messagePlaceholder")}
              value={form.message}
              onChange={(e) =>
                setForm((f) => ({ ...f, message: e.target.value }))
              }
              className={`${fieldCls} resize-y`}
            />
          </div>
        </div>

        {showErrors && !formValid && (
          <p
            role="alert"
            className="mt-4 text-body"
            style={{ color: "#A8603C" }}
          >
            {t("formError")}
          </p>
        )}

        <p className="mt-5 text-body italic text-ink-faint">
          {t("privacyNote")}
        </p>
      </form>
    </>
  );

  /* -------------------------- récapitulatif droite ---------------------- */
  const renderRecapCard = () => (
    <div
      className="rounded-[18px] bg-ink p-6 sm:p-8 lg:sticky lg:top-24"
      style={{ color: CREAM }}
    >
      <div className="flex items-baseline gap-2">
        <span className="tabular text-[2rem]" style={{ fontFamily: SERIF }}>
          {money(p.high)}
        </span>
        <span className="text-body opacity-70">
          {t("perNight")}
        </span>
      </div>
      {(ratingStr || badge) && (
        <p
          className="mt-2 text-body"
          style={{ color: KAKI_LIGHT }}
        >
          {ratingStr && `★ ${ratingStr}`}
          {ratingStr && badge ? " · " : ""}
          {badge}
        </p>
      )}
      <p className="mt-1.5 text-body opacity-60">
        {t("lowSeason", { price: money(p.low) })}
      </p>

      {/* Dates + voyageurs — reflètent la sélection en direct */}
      <div className="mt-7 overflow-hidden rounded-[12px] border-[0.5px] border-[#F1ECE3]/25">
        <div className="grid grid-cols-2">
          <div className="border-r-[0.5px] border-[#F1ECE3]/25 px-4 py-3">
            <p className="text-eyebrow uppercase tracking-[0.18em] opacity-55">
              {t("arrival")}
            </p>
            <p className="tabular mt-1 text-body">
              {longDate(arrival) ?? "—"}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-eyebrow uppercase tracking-[0.18em] opacity-55">
              {t("departure")}
            </p>
            <p className="tabular mt-1 text-body">
              {longDate(departure) ?? "—"}
            </p>
          </div>
        </div>
        <div className="border-t-[0.5px] border-[#F1ECE3]/25 px-4 py-3">
          <p className="text-eyebrow uppercase tracking-[0.18em] opacity-55">
            {t("guests")}
          </p>
          <p className="tabular mt-1 text-body">{guests}</p>
        </div>
      </div>

      {/* Détail du prix — mis à jour à chaque changement */}
      {nights > 0 ? (
        <dl className="tabular mt-7 space-y-3 text-body">
          <div className="flex items-baseline justify-between gap-4 opacity-80">
            <dt>{t("nights", { price: money(nightlyRate), count: nights })}</dt>
            <dd className="shrink-0">{money(accommodation)}</dd>
          </div>
          <div
            className="flex items-baseline justify-between gap-4"
            style={{ color: KAKI_LIGHT }}
          >
            <dt>{t("directDiscount")}</dt>
            <dd className="shrink-0">−{money(discount)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 opacity-80">
            <dt>{t("cleaning")}</dt>
            <dd className="shrink-0">{money(p.cleaning)}</dd>
          </div>
          {extrasLines.map((l) => (
            <div
              key={l.id}
              className="flex items-baseline justify-between gap-4 opacity-80"
            >
              <dt>{t(`extras.${l.id}.label`)}</dt>
              <dd className="shrink-0">{money(l.amount)}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-4 border-t-[0.5px] border-[#F1ECE3]/25 pt-3.5 text-body font-medium">
            <dt>{t("total")}</dt>
            <dd className="shrink-0">{money(total)}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-7 text-body opacity-60">
          {t("noDatesYet")}
        </p>
      )}

      {/* Rappel de l'argument, à l'endroit où il compte : sous le détail du
          prix, chiffré sur le séjour en cours. */}
      {renderDirectPitch()}

      {/* CTA de l'étape courante */}
      {step === 1 && (
        <button
          type="button"
          onClick={() => setStep(2)}
          disabled={!datesValid}
          className="btn btn-primary mt-7 w-full"
        >
          {datesValid ? t("continue") : ctaLabel}
        </button>
      )}
      {step === 2 && (
        <button
          type="button"
          onClick={() => setStep(3)}
          className="btn btn-primary mt-7 w-full"
        >
          {t("continue")}
        </button>
      )}
      {step === 3 && (
        <button
          type="submit"
          form="gc-booking-form"
          className="btn btn-primary mt-7 w-full"
        >
          {t("confirm")}
        </button>
      )}

      {step > 1 && (
        <button
          type="button"
          onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
          className="mt-3.5 block w-full rounded-full border-[0.5px] border-[#F1ECE3]/30 py-3.5 text-center text-body transition-colors hover:border-[#F1ECE3]/60"
        >
          {t("back")}
        </button>
      )}
    </div>
  );

  /* ------------------------ Étape 4 : confirmation ---------------------- */
  const renderConfirmation = () => (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="status"
      className="mx-auto max-w-2xl scroll-mt-28 rounded-[18px] bg-ink px-7 py-12 text-center outline-none sm:px-14 sm:py-16"
      style={{ color: CREAM }}
    >
      <span
        aria-hidden
        className="mx-auto grid h-16 w-16 place-items-center rounded-full text-white"
        style={{ backgroundColor: KAKI }}
      >
        <Check size={30} />
      </span>

      <h3 className="section-title mt-7" style={{ color: CREAM }}>
        {t("doneTitle")}
      </h3>

      <p className="mx-auto mt-4 max-w-lg text-body leading-relaxed opacity-75">
        {t("doneBody")}
      </p>

      {/* Récapitulatif complet de la demande (démonstration) */}
      <dl className="tabular mx-auto mt-9 max-w-md space-y-3 border-t-[0.5px] border-[#F1ECE3]/20 pt-7 text-left text-body">
        {apartmentName && (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="opacity-60">{t("summaryHouse")}</dt>
            <dd className="text-right">{apartmentName}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-4">
          <dt className="opacity-60">{t("summaryDates")}</dt>
          <dd className="text-right">
            {longDate(arrival)} → {longDate(departure)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="opacity-60">{t("summaryGuests")}</dt>
          <dd className="text-right">{guests}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="opacity-60">{t("summaryExtras")}</dt>
          <dd className="text-right">
            {extrasLines.length
              ? extrasLines.map((l) => t(`extras.${l.id}.label`)).join(", ")
              : t("summaryNone")}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t-[0.5px] border-[#F1ECE3]/20 pt-3.5 text-body font-medium">
          <dt>{t("total")}</dt>
          <dd>{money(total)}</dd>
        </div>
      </dl>

      {renderDirectPitch(true)}

      <div className="mt-8">
        <button
          type="button"
          onClick={restart}
          className="rounded-full border-[0.5px] border-[#F1ECE3]/35 px-7 py-3.5 text-body transition-colors hover:border-[#F1ECE3]/70"
        >
          {t("restart")}
        </button>
      </div>
    </div>
  );

  /* --------------------------------- rendu ------------------------------ */
  return (
    <section id="reserver" className="bg-paper">
      <div className="shell py-20 sm:py-28">
        <Reveal className="text-center">
          <p className="kicker justify-center">{kicker}</p>
          <h2 className="section-title mt-4">{title}</h2>
          <Ornament className="mt-5 justify-center" />
        </Reveal>

        {step === 4 ? (
          <Reveal className="mt-10">{renderConfirmation()}</Reveal>
        ) : (
          <Reveal className="mt-10 grid items-start gap-6 lg:grid-cols-[1.35fr_1fr] lg:gap-8">
            {/* GAUCHE — panneau de l'étape courante */}
            <div
              ref={panelRef}
              tabIndex={-1}
              /* Padding horizontal réduit en mobile : les 25,5 px de chaque
                 côté volaient 51 px à la grille du calendrier, dont les
                 cellules tombaient à 34,8 px de large (sous les 44 px d'une
                 cible tactile confortable). */
              className="scroll-mt-28 rounded-[18px] border-[0.5px] border-line bg-paper px-4 py-6 shadow-[0_2px_14px_rgba(79, 74, 68,0.05)] outline-none sm:p-8"
            >
              {renderStepper()}
              <p className="sr-only" aria-live="polite">
                {t("stepOf", { current: step, total: 3 })}
              </p>

              <div className="mt-7">
                {step === 1 && renderCalendarStep()}
                {step === 2 && renderExtrasStep()}
                {step === 3 && renderContactStep()}
              </div>

              <p className="mt-7 border-t-[0.5px] border-line pt-5 text-body italic text-ink-faint">
                {t("mockNote")}
              </p>
            </div>

            {/* DROITE — récapitulatif vivant + CTA de l'étape */}
            {renderRecapCard()}
          </Reveal>
        )}
      </div>
    </section>
  );
}
