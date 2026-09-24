"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import DestinationFallback from "@/components/DestinationFallback";
import DestinationMap, { type MapPin, type MapPoi } from "@/components/DestinationMap";
import DestinationPicker from "@/components/DestinationPicker";
import ErrorBoundary from "@/components/ErrorBoundary";
import type { GlobeHandle } from "@/components/GlobeSelector";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { useApartments } from "@/components/ApartmentsProvider";
import { pick } from "@/lib/appartements";
import { destinations, type DestinationId } from "@/lib/destinations";
import { useNearAndIdle } from "@/hooks/useNearAndIdle";

/**
 * Îlot client du globe + cartes de destination.
 * - Le clic sur un marqueur du globe bascule en fondu sur la carte vectorielle
 *   2D de la destination (même conteneur, même DA) ; « Revenir au globe » fait
 *   le chemin inverse. En reduced-motion, la bascule est immédiate.
 * - Câble la sélection sur le routeur locale-aware (un composant serveur ne peut
 *   pas passer de fonction à un composant client).
 * - Charge <GlobeSelector> en paresseux (three.js ≈ 150 kB) via next/dynamic
 *   `ssr: false` : le bundle three.js part dans un chunk séparé, hors du JS
 *   initial de l'accueil. Le fallback réserve la hauteur (pas de saut de layout).
 * - Et ne le MONTE qu'à l'approche de la section, page chargée et fil libre
 *   (useNearAndIdle) : le globe est plusieurs écrans sous le héros épinglé,
 *   il n'a rien à faire pendant le chargement.
 */
const GlobeSelector = dynamic(() => import("./GlobeSelector"), {
  ssr: false,
  loading: () => <div aria-hidden className="h-full w-full bg-paper" />,
});

/** Durée du fondu globe ↔ carte — à garder en phase avec globals.css. */
const FADE_MS = 460;

export default function GlobeSelectorClient({
  hint,
  backLabel,
  className,
}: {
  hint?: string;
  backLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  const locale = useLocale() as Locale;
  const apartments = useApartments();
  const tm = useTranslations("map");
  const globeRef = useRef<GlobeHandle | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [active, setActive] = useState<DestinationId | null>(null);
  const [closing, setClosing] = useState(false);
  /* Bascule mobile : `null` tant qu'on n'a pas mesuré (le SSR ne connaît ni
     la largeur ni le type de pointeur). On ne rend donc NI le globe NI les
     cartes avant l'hydratation — sinon on téléchargerait three.js sur un
     téléphone qui ne l'affichera jamais. Le conteneur garde sa hauteur, donc
     aucun saut de mise en page. */
  const [compact, setCompact] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px), (pointer: coarse)");
    const apply = () => setCompact(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const globeNear = useNearAndIdle(stageRef, { enabled: compact === false });

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const reduced = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const open = useCallback((id: DestinationId) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setClosing(false);
    setActive(id);
    // Le globe finit son plongé sous le fondu, puis se met en veille.
    timerRef.current = setTimeout(
      () => globeRef.current?.setPaused(true),
      reduced() ? 0 : FADE_MS,
    );
  }, []);

  const back = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    globeRef.current?.setPaused(false);
    globeRef.current?.reset();
    if (reduced()) {
      setActive(null);
      return;
    }
    setClosing(true);
    timerRef.current = setTimeout(() => {
      setActive(null);
      setClosing(false);
    }, FADE_MS);
  }, []);

  const label = backLabel ?? "Revenir au globe";
  const go = useCallback(
    (slug: string) => router.push(`/appartements/${slug}`),
    [router],
  );

  const destination = active ? destinations[active] : null;
  const pins: MapPin[] = destination
    ? apartments
        .filter((a) => a.region === destination.id && a.mapPin)
        .map((a) => ({
          slug: a.slug,
          name: pick(a.name, locale),
          // « Intra-Muros, Saint-Malo » → « Intra-Muros », sauf libellé court
          // explicite (`mapPlace`) quand la localité déborde de la vignette.
          place: a.mapPlace
            ? pick(a.mapPlace, locale)
            : pick(a.locality, locale).split(",")[0].trim(),
          lat: a.mapPin!.lat,
          lng: a.mapPin!.lng,
          card: a.mapPin!.card,
          compactCard: a.mapPin!.compactCard,
          photo: a.mainImage,
        }))
    : [];
  // Points d'intérêt réels de la destination, libellés dans la langue du site.
  const pois: MapPoi[] = destination
    ? destination.pois.map((p) => ({ ...p, name: tm(`poi.${p.id}`) }))
    : [];

  return (
    <div ref={stageRef} className={`destination-stage relative overflow-hidden ${className ?? ""}`}>
      <div
        className="globe-layer absolute inset-0"
        data-hidden={destination && !closing ? "" : undefined}
      >
        {compact === false && !globeNear && (
          // Même fond que le chargement de <GlobeSelector> : aucune différence visible.
          <div aria-hidden className="h-full w-full bg-paper" />
        )}
        {compact === false && globeNear && (
          <GlobeSelector
            hint={hint}
            handleRef={globeRef}
            className="h-full w-full"
            onDestination={open}
          />
        )}
        {compact === true && (
          // Mobile : deux grandes cartes tapables, centrées verticalement.
          <div className="flex h-full w-full items-center px-1 py-2">
            <DestinationPicker onSelect={open} className="w-full" />
          </div>
        )}
      </div>

      {destination && (
        // La `key` réarme le filet à chaque changement de destination : une
        // carte tombée en erreur ne condamne pas l'autre.
        <ErrorBoundary
          key={destination.id}
          label="DestinationMap"
          fallback={
            <DestinationFallback
              title={destination.label}
              pins={pins}
              backLabel={label}
              onBack={back}
              onSelect={go}
              className={closing ? "is-leaving" : ""}
            />
          }
        >
          <DestinationMap
            destination={destination}
            pins={pins}
            pois={pois}
            backLabel={label}
            onBack={back}
            onSelect={go}
            className={closing ? "is-leaving" : ""}
          />
        </ErrorBoundary>
      )}
    </div>
  );
}
