"use client";

import { useState } from "react";
import Reveal from "@/components/Reveal";
import Ornament from "@/components/Ornament";
import type { MapPoint } from "@/lib/appartements";

/* ------------------------------------------------------------------
   Alentours — section pleine largeur, centrée. Les 5 points deviennent un
   SÉLECTEUR (state React) : l'actif est en terre cuite, les autres en boutons
   Material blancs. Au clic, l'itinéraire se recharge dans l'iframe via la
   Google Maps Embed API (directions), à pied ou en voiture selon le `mode`
   du point (cf. MapPoint dans lib/appartements.ts) — un itinéraire piéton
   jusqu'au Mont Saint-Michel n'aurait aucun sens. Clé :
   NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY — absente → repli carte simple
   (q=destination), sans casser la page. Data-driven depuis lib/appartements.ts.
   ------------------------------------------------------------------ */

const PIN = "#A8603C"; // terre cuite (accent des marqueurs / bouton actif)
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;

/** Pictos du mode de déplacement — piéton / voiture (lucide). */
const MODE_ICON = {
  walking: (
    <>
      <circle cx="12" cy="5" r="1" />
      <path d="m9 20 3-6 3 6" />
      <path d="m6 8 6 2 6-2" />
      <path d="M12 10v4" />
    </>
  ),
  driving: (
    <>
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
} as const;

export default function Alentours({
  kicker,
  title,
  address,
  points,
  note,
  openLabel,
  walkLabel,
  driveLabel,
}: {
  /** Eyebrow au-dessus du titre (« Alentours »). */
  kicker: string;
  title: string;
  address: string;
  points: MapPoint[];
  note?: string | null;
  openLabel: string;
  /** « Itinéraire à pied » / « On foot ». */
  walkLabel: string;
  /** « Itinéraire en voiture » / « By car ». */
  driveLabel: string;
}) {
  const [active, setActive] = useState(0);
  const point = points[active] ?? points[0];
  // Voiture par défaut : c'est le repli sûr pour un point lointain.
  const mode = point.mode ?? "driving";

  // Itinéraire intégré (Embed API) si clé dispo ; sinon repli carte simple.
  const embedSrc = MAPS_KEY
    ? `https://www.google.com/maps/embed/v1/directions?key=${MAPS_KEY}&origin=${encodeURIComponent(
        address,
      )}&destination=${encodeURIComponent(point.query)}&mode=${mode}`
    : `https://maps.google.com/maps?q=${encodeURIComponent(
        point.query,
      )}&z=14&output=embed`;

  // Lien externe classique (ouvre l'itinéraire complet dans Google Maps).
  const externalHref = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    address,
  )}&destination=${encodeURIComponent(point.query)}&travelmode=${mode}`;

  return (
    <section className="bg-paper">
      <div className="shell-wide py-20 text-center sm:py-28">
        <Reveal>
          <p className="kicker justify-center">{kicker}</p>
          <h2 className="section-title mt-4">{title}</h2>
          <Ornament className="mt-5 justify-center" />
          {/* Adresse du logement — origine des itinéraires ci-dessous */}
          <p className="mt-5 inline-flex items-center justify-center gap-2 text-body text-ink-soft">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke={PIN}
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
              aria-hidden="true"
            >
              <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {address}
          </p>
        </Reveal>

        {/* Sélecteur d'itinéraires — gros boutons espacés, un seul actif.
            Le picto dit le mode : à pied depuis le pas de la porte, en
            voiture pour les excursions. */}
        <Reveal className="mt-10 flex flex-wrap justify-center gap-4">
          {points.map((p, i) => {
            const isActive = i === active;
            const pMode = p.mode ?? "driving";
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => setActive(i)}
                aria-pressed={isActive}
                className={`inline-flex items-center gap-2.5 rounded-full px-6 py-4 text-button font-medium transition-all duration-200 ${
                  isActive
                    ? "text-white shadow-[0_6px_16px_rgba(168, 96, 60,0.32),0_2px_6px_rgba(168, 96, 60,0.24)]"
                    : "bg-white text-ink shadow-[0_1px_3px_rgba(40, 36, 32,0.12),0_1px_2px_rgba(40, 36, 32,0.08)] hover:-translate-y-px hover:shadow-[0_6px_16px_rgba(40, 36, 32,0.16),0_2px_6px_rgba(40, 36, 32,0.10)]"
                }`}
                style={isActive ? { backgroundColor: PIN } : undefined}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={isActive ? "#ffffff" : PIN}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                  aria-hidden="true"
                >
                  {MODE_ICON[pMode]}
                </svg>
                {p.label}
              </button>
            );
          })}
        </Reveal>

        {/* Itinéraire intégré — recharge à chaque changement de destination */}
        <Reveal className="mt-12">
          <div className="overflow-hidden rounded-[16px] bg-offwhite shadow-[0_2px_14px_rgba(40, 36, 32,0.09)]">
            <iframe
              key={embedSrc}
              src={embedSrc}
              title={`${title} — ${point.label}`}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              className="block h-[450px] w-full border-0"
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <span className="inline-flex items-center gap-2 text-body text-ink-faint">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0"
                aria-hidden="true"
              >
                {MODE_ICON[mode]}
              </svg>
              {mode === "walking" ? walkLabel : driveLabel}
            </span>
            <a
              href={externalHref}
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline inline-flex items-center gap-1.5 text-body text-ink-soft"
            >
              {openLabel}
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M7 17 17 7M8 7h9v9" />
              </svg>
            </a>
          </div>
        </Reveal>

        {note && (
          <p className="lede mx-auto mt-8 max-w-3xl text-balance">{note}</p>
        )}
      </div>
    </section>
  );
}
