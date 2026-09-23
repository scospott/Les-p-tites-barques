"use client";

import { useTranslations } from "next-intl";
import SafeImage from "@/components/SafeImage";
import { destinationList, type DestinationId } from "@/lib/destinations";

/* ------------------------------------------------------------------
   Sélecteur de destination MOBILE — remplace le globe 3D sous 768 px et
   sur pointeur grossier.

   Pourquoi une bascule assumée plutôt qu'un globe corrigé : sur un écran
   de 375 px, le globe demandait au visiteur de viser un marqueur de 12 px
   au doigt, dans un canvas qui doit par ailleurs laisser passer le scroll
   vertical de la page. Même bien réglé, c'est une cible hostile. Deux
   grandes cartes tapables disent la même chose — deux rivages, on choisit —
   et elles marchent du premier coup.

   Chaque carte ouvre la MÊME carte de destination que le globe (le parent
   passe `onSelect`), donc le parcours reste identique ensuite.
   ------------------------------------------------------------------ */

/** Photo d'ambiance par destination (photos réelles déjà au dépôt). */
const COVER: Record<DestinationId, string> = {
  "saint-malo": "/images/accueil/principale-mer.jpg",
  guadeloupe: "/images/accueil/principale-antilles.jpg",
};

/** Clé de traduction du sous-titre court (capitales espacées) sous le nom. */
const KICKER_KEY: Record<DestinationId, "pickerSaintMalo" | "pickerGuadeloupe"> = {
  "saint-malo": "pickerSaintMalo",
  guadeloupe: "pickerGuadeloupe",
};

export default function DestinationPicker({
  onSelect,
  className = "",
}: {
  onSelect: (id: DestinationId) => void;
  className?: string;
}) {
  const t = useTranslations("home.globe");
  return (
    <div className={`grid gap-4 ${className}`}>
      {destinationList.map((d) => (
        <button
          key={d.id}
          type="button"
          onClick={() => onSelect(d.id)}
          // h-44 : cible largement au-dessus des 44 px recommandés, et assez
          // haute pour que la photo raconte quelque chose.
          className="group relative h-44 w-full overflow-hidden rounded-[20px] text-left sm:h-52"
        >
          <SafeImage
            src={COVER[d.id]}
            alt=""
            label=" "
            sizes="(min-width:768px) 50vw, 100vw"
            className="absolute inset-0 h-full w-full"
            imgClassName="transition-transform duration-700 ease-out group-active:scale-[1.03]"
          />
          {/* Voile : le nom crème doit rester lisible sur n'importe quelle photo. */}
          <span
            aria-hidden
            className="absolute inset-0"
            style={{
              // Renforcé après contrôle à 390 px : sur la photo claire de
              // Saint-Malo, le sous-titre crème passait tout juste.
              background:
                "linear-gradient(180deg, rgba(79, 74, 68,0.18) 0%, rgba(79, 74, 68,0.40) 48%, rgba(79, 74, 68,0.80) 100%)",
            }}
          />
          <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
            <span className="min-w-0">
              <span className="kicker block text-paper/80">
                {t(KICKER_KEY[d.id])}
              </span>
              <span className="subtitle mt-1.5 block text-paper">
                {d.label}
              </span>
            </span>
            <span
              aria-hidden
              className="mb-1.5 inline-flex shrink-0 items-center text-paper/90 transition-transform duration-300 group-active:translate-x-1"
            >
              <svg width="26" height="12" viewBox="0 0 22 12" fill="none">
                <path
                  d="M0 6h20M15 1l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
