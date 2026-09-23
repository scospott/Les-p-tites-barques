"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import DestinationFallback from "@/components/DestinationFallback";
import SafeImage from "@/components/SafeImage";
import type { Destination, PoiIcon } from "@/lib/destinations";

/* ============================================================
   DestinationMap — carte vectorielle 2D d'une destination, dans la
   même DA que le globe : océan très clair, terres sable, trait de côte
   encre fin. SVG (pas de three.js) : net à tout zoom, léger, robuste.

   Le tracé vient d'un GeoJSON vendoré (public/geo/*.json, trait de côte
   OpenStreetMap recollé et simplifié hors ligne) ; le `bbox` du fichier
   donne le cadre. Projection équirectangulaire corrigée en cos(latitude)
   — sans distorsion visible à cette échelle.

   Trois couches de DOM par-dessus le SVG, replacées à chaque
   redimensionnement en reproduisant la transformation `meet` / `slice` :
   - toponymes discrets (labels du GeoJSON, italique) ;
   - POINTS D'INTÉRÊT réels (plages, gares, aéroport — lib/destinations.ts) :
     petit picto rond + label serif droit, style discret, distinct des pins ;
   - pins-logements : vignette SafeImage, nom, cible tactile confortable.
   ============================================================ */

export interface MapPin {
  slug: string;
  name: string;
  /** Quartier / commune — sous le nom, en petites capitales. */
  place: string;
  lat: number;
  lng: number;
  photo?: string;
  /**
   * Côté de la vignette par rapport au point (défaut : au-dessus).
   * `bottom-left` : sous le point, décalée à gauche — libère la zone
   * située juste sous le pin (ex. la gare maritime sous l'intra-muros).
   */
  card?: MapCardSide;
  /** Côté de la vignette sur la carte COMPACTE (mobile) si différent. */
  compactCard?: MapCardSide;
}

export type MapCardSide = "top" | "bottom" | "bottom-left";

/** Point d'intérêt résolu (libellé déjà traduit). */
export interface MapPoi {
  id: string;
  name: string;
  icon: PoiIcon;
  lat: number;
  lng: number;
  anchor?: "start" | "end" | "below";
  compactAnchor?: "start" | "end" | "below";
  compactHidden?: boolean;
}

interface Props {
  destination: Destination;
  pins: MapPin[];
  pois?: MapPoi[];
  backLabel: string;
  onBack: () => void;
  onSelect: (slug: string) => void;
  className?: string;
}

/** Toponyme discret posé sur la carte (quartier, plage, commune). */
export interface MapLabel {
  name: string;
  lat: number;
  lng: number;
  /** `district` : petites capitales espacées (nom d'un quartier détouré). */
  kind?: "district" | "place";
  /**
   * Ancrage horizontal : `middle` (défaut) centre le texte sur le point ;
   * `end` le fait finir au point (label posé À GAUCHE, ex. sur l'eau contre
   * un rempart) ; `start` le fait commencer au point.
   */
  anchor?: "start" | "middle" | "end";
  /** Ancrage sur la carte COMPACTE (mobile) si différent. */
  compactAnchor?: "start" | "middle" | "end";
  /** Masqué sur la carte compacte (déjà dit par une vignette, ou hors cadre). */
  compactHidden?: boolean;
}

interface Geo {
  /** Chemin SVG de toutes les terres (fill-rule evenodd). */
  d: string;
  /**
   * Chemin SVG des quartiers mis en évidence (features `kind: "district"`
   * du GeoJSON — ex. l'intra-muros de Saint-Malo) : fin trait encre + très
   * léger aplat, par-dessus les terres.
   */
  districtD: string;
  /**
   * Chemin SVG des plans d'eau INTÉRIEURS (features `kind: "water"` : bassins
   * du port, étangs) — dessinés dans la teinte de l'océan, par-dessus les
   * terres, sous les quartiers détourés.
   */
  waterD: string;
  /** Toponymes (`labels` du GeoJSON), placés comme les pins. */
  labels: MapLabel[];
  /** Dimensions du viewBox, en unités de projection. */
  vw: number;
  vh: number;
  /** Projection lat/lng → unités du viewBox. */
  x: (lng: number) => number;
  y: (lat: number) => number;
}

const OCEAN = "#EAEEF1";
const LAND = "#E7DFCE";
const COAST = "#4F4A44";

/** Pictos des points d'intérêt (style lucide, 24×24, trait 2). */
const POI_ICONS: Record<PoiIcon, ReactNode> = {
  // Plage — soleil bas sur une ligne d'horizon.
  beach: (
    <>
      <path d="M3 19h18" />
      <path d="M6 15a6 6 0 0 1 12 0" />
      <path d="M12 5v2M5.5 8.5l1.4 1.4M18.5 8.5l-1.4 1.4" />
    </>
  ),
  // Gare — locomotive de face.
  train: (
    <>
      <rect x="5" y="3" width="14" height="14" rx="3" />
      <path d="M5 10h14" />
      <path d="M9 14h.01M15 14h.01" />
      <path d="M8 21l1.5-4M16 21l-1.5-4" />
    </>
  ),
  // Gare maritime — coque de navire.
  ferry: (
    <>
      <path d="M3 17c1.5 1.2 3 1.2 4.5 0s3 -1.2 4.5 0 3 1.2 4.5 0 3 -1.2 4.5 0" />
      <path d="M4 14l1.5-5h13L20 14" />
      <path d="M8 9V5h8v4" />
      <path d="M12 3v2" />
    </>
  ),
  // Aéroport — avion.
  plane: (
    <path d="M2 14l8-1 2-7 2 0-1 7 7 1 0 2-7-1-1 5 2 1v1l-3-.5-3 .5v-1l2-1-1-5-7 1z" />
  ),
  town: (
    <>
      <path d="M4 21V9l6-4 6 4v12" />
      <path d="M16 13h4v8" />
      <path d="M9 21v-5h2v5" />
    </>
  ),
};

export default function DestinationMap({
  destination,
  pins,
  pois = [],
  backLabel,
  onBack,
  onSelect,
  className = "",
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });

  /* ---- GeoJSON → chemin SVG (une fois par destination) ---- */
  useEffect(() => {
    const ac = new AbortController();
    setGeo(null);
    setFailed(false);
    fetch(destination.geo, { signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw new Error("geo");
        return r.json();
      })
      .then((fc) => {
        const [w, s, e, n] = fc.bbox as [number, number, number, number];
        const kx = Math.cos((((s + n) / 2) * Math.PI) / 180);
        // ×1000 : des nombres lisibles dans le viewBox, pas de notation exp.
        const x = (lng: number) => (lng - w) * kx * 1000;
        const y = (lat: number) => (n - lat) * 1000;
        const parts: string[] = [];
        const districtParts: string[] = [];
        const waterParts: string[] = [];
        for (const f of fc.features ?? []) {
          const g = f.geometry;
          if (!g) continue;
          const polys: number[][][][] =
            g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
          // Un quartier détouré (`kind: "district"`) se dessine PAR-DESSUS les
          // terres, il ne participe pas au trait de côte.
          const kind = f.properties?.kind;
          const target =
            kind === "district" ? districtParts : kind === "water" ? waterParts : parts;
          for (const poly of polys) {
            for (const ring of poly) {
              target.push(
                "M" +
                  ring.map((p) => `${x(p[0]).toFixed(2)},${y(p[1]).toFixed(2)}`).join("L") +
                  "Z",
              );
            }
          }
        }
        const labels: MapLabel[] = Array.isArray(fc.labels)
          ? (fc.labels as MapLabel[]).filter(
              (l) => l && typeof l.lat === "number" && typeof l.lng === "number" && l.name,
            )
          : [];
        setGeo({
          d: parts.join(""),
          districtD: districtParts.join(""),
          waterD: waterParts.join(""),
          labels,
          vw: (e - w) * kx * 1000,
          vh: (n - s) * 1000,
          x,
          y,
        });
      })
      .catch((err) => {
        // Trait de côte illisible (réseau, 404, JSON cassé, bbox absente) :
        // on bascule sur le repli cliquable — jamais une carte vide.
        if (ac.signal.aborted) return;
        console.error("[DestinationMap]", destination.geo, err);
        setFailed(true);
      });
    return () => ac.abort();
  }, [destination.geo]);

  /* ---- taille du conteneur : replacement des pins ---- */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---- Cadre affiché : le bbox du GeoJSON, ou le cadre COMPACT resserré
          quand le conteneur est en portrait (mobile) — montré en entier. ---- */
  const compact = size.w > 0 && size.h > size.w && !!destination.compactView;
  const view = useMemo(() => {
    if (!geo) return null;
    if (compact && destination.compactView) {
      const [w, s, e, n] = destination.compactView;
      const vx = geo.x(w);
      const vy = geo.y(n);
      return { vx, vy, vw: geo.x(e) - vx, vh: geo.y(s) - vy, fit: "contain" as const };
    }
    return { vx: 0, vy: 0, vw: geo.vw, vh: geo.vh, fit: destination.fit };
  }, [geo, compact, destination.compactView, destination.fit]);

  /* ---- position écran des pins, POI et toponymes (même transformation
          que le SVG : `meet` / `slice` reproduits à la main) ---- */
  const project = useMemo(() => {
    if (!geo || !view || !size.w || !size.h) return null;
    const scale =
      view.fit === "cover"
        ? Math.max(size.w / view.vw, size.h / view.vh)
        : Math.min(size.w / view.vw, size.h / view.vh);
    const ox = (size.w - view.vw * scale) / 2 - view.vx * scale;
    const oy = (size.h - view.vh * scale) / 2 - view.vy * scale;
    return (lat: number, lng: number) => ({
      left: ox + geo.x(lng) * scale,
      top: oy + geo.y(lat) * scale,
    });
  }, [geo, view, size]);

  const placed = useMemo(
    () => (project ? pins.map((p) => ({ pin: p, ...project(p.lat, p.lng) })) : []),
    [project, pins],
  );
  const placedLabels = useMemo(
    () =>
      project && geo
        ? geo.labels
            .filter((l) => !(compact && l.compactHidden))
            .map((l) => ({
              label: l,
              anchor: (compact ? l.compactAnchor : undefined) ?? l.anchor ?? "middle",
              ...project(l.lat, l.lng),
            }))
        : [],
    [project, geo, compact],
  );
  // POI : hors cadre → non rendus ; sur la carte compacte, ancrage dédié et
  // repères trop proches masqués.
  const placedPois = useMemo(
    () =>
      project
        ? pois
            .filter((p) => !(compact && p.compactHidden))
            .map((p) => ({
              poi: p,
              anchor: (compact ? p.compactAnchor : undefined) ?? p.anchor ?? "below",
              ...project(p.lat, p.lng),
            }))
            .filter((p) => p.left >= 0 && p.left <= size.w && p.top >= 0 && p.top <= size.h)
        : [],
    [project, pois, compact, size],
  );

  if (failed) {
    return (
      <DestinationFallback
        title={destination.label}
        pins={pins}
        backLabel={backLabel}
        onBack={onBack}
        onSelect={onSelect}
        className={className}
      />
    );
  }

  return (
    <div
      className={`destination-map ${className}`}
      style={{ backgroundColor: OCEAN }}
      role="group"
      aria-label={destination.label}
    >
      <div ref={stageRef} className="dm-stage">
        {geo && view && (
          <svg
            className="dm-svg"
            viewBox={`${view.vx.toFixed(2)} ${view.vy.toFixed(2)} ${view.vw.toFixed(2)} ${view.vh.toFixed(2)}`}
            preserveAspectRatio={
              view.fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"
            }
            aria-hidden="true"
          >
            <path
              d={geo.d}
              fill={LAND}
              fillRule="evenodd"
              stroke={COAST}
              strokeOpacity={0.55}
              strokeWidth={0.9}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {/* Plans d'eau intérieurs (bassins à flot, étangs) — même teinte que
                l'océan : la presqu'île se lit entourée d'eau, ses bassins derrière. */}
            {geo.waterD && (
              <path d={geo.waterD} className="dm-water" fillRule="evenodd" />
            )}
            {/* Quartier détouré (ex. intra-muros) : trait encre fin + aplat léger */}
            {geo.districtD && (
              <path d={geo.districtD} className="dm-district" fillRule="evenodd" />
            )}
          </svg>
        )}

        {/* Toponymes discrets — sous les pins dans l'ordre de peinture */}
        {placedLabels.map(({ label, anchor, left, top }) => (
          <span
            key={label.name}
            className={`dm-label${label.kind === "district" ? " dm-label--district" : ""}`}
            data-anchor={anchor}
            style={{ left, top }}
            aria-hidden="true"
          >
            {label.name}
          </span>
        ))}

        {/* Points d'intérêt réels — picto + label, non interactifs (repères).
            Annoncés aux lecteurs d'écran par une liste hors écran. */}
        {placedPois.map(({ poi, anchor, left, top }) => (
          <span
            key={poi.id}
            className="dm-poi"
            data-anchor={anchor}
            style={{ left, top }}
            aria-hidden="true"
          >
            <span className="dm-poi-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {POI_ICONS[poi.icon]}
              </svg>
            </span>
            <span className="dm-poi-label">{poi.name}</span>
          </span>
        ))}
        {pois.length > 0 && (
          <ul className="sr-only">
            {pois.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
        )}

        {placed.map(({ pin, left, top }) => (
          <button
            key={pin.slug}
            type="button"
            className="dm-pin"
            data-card={(compact ? pin.compactCard : undefined) ?? pin.card ?? "top"}
            style={{ left, top }}
            onClick={() => onSelect(pin.slug)}
            aria-label={`${pin.name} — ${pin.place}`}
          >
            <span className="dm-card">
              <span className="dm-thumb">
                <SafeImage
                  src={pin.photo}
                  alt=""
                  label=" "
                  className="h-full w-full"
                  sizes="120px"
                />
              </span>
              <span className="dm-name">{pin.name}</span>
              <span className="dm-place">{pin.place}</span>
            </span>
            <span className="dm-dot" aria-hidden="true" />
          </button>
        ))}
      </div>

      <button type="button" className="dm-back" onClick={onBack}>
        ←&nbsp;&nbsp;{backLabel}
      </button>
      <p className="dm-title">{destination.label}</p>
    </div>
  );
}
