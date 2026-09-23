"use client";

import SafeImage from "@/components/SafeImage";
import type { MapPin } from "@/components/DestinationMap";

/* ------------------------------------------------------------------
   Repli de la carte de destination. Il sert dans deux cas :
   - le GeoJSON du trait de côte n'a pas pu être chargé ou lu ;
   - le rendu de DestinationMap a levé une exception (error boundary).

   Dans les deux cas on montre la MÊME information utile — les biens de
   la destination, cliquables — plutôt qu'un conteneur vide. Jamais
   d'écran blanc.
   ------------------------------------------------------------------ */

export default function DestinationFallback({
  title,
  pins,
  backLabel,
  onBack,
  onSelect,
  className = "",
}: {
  title: string;
  pins: MapPin[];
  backLabel: string;
  onBack: () => void;
  onSelect: (slug: string) => void;
  className?: string;
}) {
  return (
    <div
      className={`destination-map dm-fallback ${className}`}
      role="group"
      aria-label={title}
    >
      <div className="dm-fb-inner">
        <p className="dm-fb-title">{title}</p>
        <ul className="dm-fb-list">
          {pins.map((p) => (
            <li key={p.slug}>
              <button
                type="button"
                className="dm-fb-item"
                onClick={() => onSelect(p.slug)}
              >
                <span className="dm-fb-thumb">
                  <SafeImage
                    src={p.photo}
                    alt=""
                    label=" "
                    className="h-full w-full"
                    sizes="96px"
                  />
                </span>
                <span className="dm-fb-text">
                  <span className="dm-fb-name">{p.name}</span>
                  <span className="dm-fb-place">{p.place}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <button type="button" className="dm-back" onClick={onBack}>
        ←&nbsp;&nbsp;{backLabel}
      </button>
    </div>
  );
}
