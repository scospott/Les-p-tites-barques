"use client";

import { useId, useState } from "react";

import Reveal from "@/components/Reveal";
import Ornament from "@/components/Ornament";

/* ------------------------------------------------------------------
   FAQ — accordéon, même facture que <Equipements> (filets, chevron,
   dépliage grid-rows 0fr → 1fr) sur une seule colonne de lecture.
   Les réponses restent dans le DOM une fois repliées : le texte balisé
   en FAQPage (JSON-LD) est bien présent sur la page. Tout est replié par
   défaut, plusieurs questions peuvent être ouvertes à la fois.
   ------------------------------------------------------------------ */

export default function Faq({
  kicker,
  title,
  items,
  className = "bg-paper",
}: {
  kicker: string;
  title: string;
  items: { q: string; a: string }[];
  /** Fond de section (alternance avec les sections voisines). */
  className?: string;
}) {
  const baseId = useId();
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  if (!items.length) return null;

  return (
    <section className={className}>
      <div className="shell py-20 sm:py-28">
        <Reveal className="text-center">
          <p className="kicker justify-center">{kicker}</p>
          <h2 className="section-title mt-4">{title}</h2>
          <Ornament className="mt-5 justify-center" />
        </Reveal>

        <Reveal className="mx-auto mt-14 max-w-3xl border-b border-line">
          {items.map((item, i) => {
            const isOpen = open.has(i);
            const panelId = `${baseId}-faq-${i}`;
            return (
              <div key={i} className="border-t border-line">
                <h3>
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="flex w-full items-center gap-5 py-6 text-left outline-none transition-colors hover:text-ink focus-visible:text-ink"
                  >
                    <span className="subtitle flex-1 text-ink">{item.q}</span>
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`shrink-0 text-ink-soft transition-transform duration-300 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden="true"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                </h3>
                <div
                  id={panelId}
                  // Replié : hors de l'arbre d'accessibilité (le texte reste
                  // dans le DOM pour les moteurs).
                  inert={!isOpen}
                  className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="pb-7 pr-10 text-body leading-relaxed text-ink-soft">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
