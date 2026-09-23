"use client";

import { useState, type ReactNode } from "react";

import Reveal from "@/components/Reveal";
import Ornament from "@/components/Ornament";
import type { EquipCategory } from "@/lib/appartements";

/* ------------------------------------------------------------------
   Équipements (« What this place offers ») — accordéon data-driven.
   Les catégories viennent de lib/appartements.ts (`equipements`). Chaque
   catégorie est une ligne cliquable (icône + nom + chevron) qui déroule
   ses items. État local React (useState), pas de localStorage.
   Si aucune catégorie → bloc placeholder « à renseigner ».
   Icônes fines (style lucide) mappées par `id` de catégorie.
   Version AGRANDIE (demande cliente) : typo plus grande, plus d'air entre
   les lignes, items plus lisibles ; pas de compteur « · 7 » (se lisait
   comme un prix).
   Deux colonnes INDÉPENDANTES sur desktop (première moitié à gauche,
   seconde à droite) : ouvrir une catégorie n'allonge que SA colonne —
   avec une grille commune par rangée, la colonne d'à côté descendait
   aussi. Mobile : une colonne, dans l'ordre.
   ------------------------------------------------------------------ */

/** Icônes lucide (inline) par identifiant de catégorie. */
const ICONS: Record<string, ReactNode> = {
  bain: (
    <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7z" />
  ),
  chambre: (
    <>
      <path d="M2 4v16" />
      <path d="M2 8h18a2 2 0 0 1 2 2v10" />
      <path d="M2 17h20" />
      <path d="M6 8v9" />
    </>
  ),
  multimedia: (
    <>
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </>
  ),
  chauffage: <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />,
  vue: (
    <>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  divertissement: (
    <>
      <rect width="20" height="15" x="2" y="3" rx="2" />
      <path d="m8 21 4-4 4 4" />
    </>
  ),
  famille: (
    <>
      <circle cx="9" cy="7" r="3" />
      <path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2" />
      <circle cx="18" cy="8" r="2.5" />
      <path d="M22 21v-1a4 4 0 0 0-3-3.87" />
    </>
  ),
  securite: (
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  ),
  exterieur: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </>
  ),
  internet: (
    <>
      <path d="M12 20h.01" />
      <path d="M2 8.82a15 15 0 0 1 20 0" />
      <path d="M5 12.86a10 10 0 0 1 14 0" />
      <path d="M8.5 16.43a5 5 0 0 1 7 0" />
    </>
  ),
  cuisine: (
    <>
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </>
  ),
  emplacement: (
    <>
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  stationnement: (
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
    </>
  ),
  services: (
    <>
      <path d="M3 20a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1Z" />
      <path d="M20 16a8 8 0 1 0-16 0" />
      <path d="M12 4v4" />
      <path d="M10 4h4" />
    </>
  ),
  salon: (
    <>
      <path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3" />
      <path d="M3 11v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H7v-2a2 2 0 0 0-4 0Z" />
      <path d="M5 18v2" />
      <path d="M19 18v2" />
    </>
  ),
  divers: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </>
  ),
  langues: (
    <>
      <path d="m5 8 6 6" />
      <path d="m4 14 6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="m22 22-5-10-5 10" />
      <path d="M14 18h6" />
    </>
  ),
};

/** Icône générique (repli si l'id n'a pas d'icône dédiée). */
const FALLBACK_ICON = (
  <>
    <path d="M20 6 9 17l-5-5" />
  </>
);

/** Wrapper SVG commun (icône de catégorie, style lucide). */
function CategoryIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-kaki"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Section « Équipements » — accordéon par catégorie (2 colonnes desktop). */
export default function Equipements({
  categories,
  kicker = "Équipements",
  title = "Ce que propose ce logement",
  placeholder = "[ÉQUIPEMENTS À RENSEIGNER]",
}: {
  categories?: EquipCategory[] | null;
  kicker?: string;
  title?: string;
  placeholder?: string;
}) {
  // Tout replié par défaut (la liste dépliée était trop longue).
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const hasData = !!categories && categories.length > 0;
  // Répartition en deux moitiés : l'ordre de lecture reste celui des
  // données (haut → bas, puis colonne de droite) et, empilées sur mobile,
  // les catégories gardent leur ordre.
  const half = hasData ? Math.ceil(categories!.length / 2) : 0;
  const columns = hasData
    ? [categories!.slice(0, half), categories!.slice(half)].filter((c) => c.length)
    : [];

  return (
    <section className="bg-paper">
      <div className="shell py-20 sm:py-28">
        <Reveal className="text-center">
          <p className="kicker justify-center">{kicker}</p>
          <h2 className="section-title mt-4">{title}</h2>
          <Ornament className="mt-5 justify-center" />
        </Reveal>

        {hasData ? (
          <Reveal className="mt-14 grid gap-x-16 sm:grid-cols-2 sm:items-start">
            {columns.map((column, ci) => (
              <div key={ci}>
                {column.map((cat) => {
                  const isOpen = open.has(cat.id);
                  const panelId = `equip-panel-${cat.id}`;
                  return (
                    <div key={cat.id} className="border-t border-line">
                      <button
                        type="button"
                        onClick={() => toggle(cat.id)}
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        className="flex w-full items-center gap-5 py-6 text-left outline-none transition-colors hover:text-ink focus-visible:text-ink"
                      >
                        <CategoryIcon>{ICONS[cat.id] ?? FALLBACK_ICON}</CategoryIcon>
                        {/* Titre de catégorie SEUL : le compteur « · 7 » se lisait
                            comme un prix ou une note — retiré (audit Scott). */}
                        <span className="subtitle flex-1 text-ink">
                          {cat.title}
                        </span>
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

                      {/* Panneau dépliable — animation via grid-rows 0fr→1fr. */}
                      <div
                        id={panelId}
                        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                        }`}
                      >
                        <div className="overflow-hidden">
                          <ul className="pb-7 pl-[46px]">
                            {cat.items.map((item, i) => (
                              <li
                                key={i}
                                className="pb-3.5 text-body leading-relaxed text-ink-soft last:pb-0"
                              >
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </Reveal>
        ) : (
          <Reveal className="mt-10 rounded-[3px] border border-dashed border-sand/60 bg-offwhite/70 p-8">
            <p className="kicker text-ink-faint">
              {placeholder}
            </p>
          </Reveal>
        )}
      </div>
    </section>
  );
}
