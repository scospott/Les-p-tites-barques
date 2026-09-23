"use client";

import SafeImage from "@/components/SafeImage";
import { Link } from "@/i18n/navigation";
import type { HouseRef } from "@/lib/assistant-houses";

/* ------------------------------------------------------------------
   Mini-carte d'un logement cité par l'assistant : photo, nom, localité, et
   un lien vers la page du bien. Rendue sous sa bulle, dans le panneau
   flottant comme dans la section inline de l'accueil — quand il nomme
   une maison, on peut y aller d'un clic plutôt que de relire l'adresse.
   ------------------------------------------------------------------ */

const BUBBLE = "#FFFDFA";
const INK = "#4F4A44";

export default function AssistantHouseCard({
  house,
  aria,
}: {
  house: HouseRef;
  aria: string;
}) {
  return (
    <Link
      href={`/appartements/${house.slug}`}
      data-housecard
      data-motion
      aria-label={aria}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginTop: 8,
        padding: 8,
        background: BUBBLE,
        border: "1px solid rgba(79, 74, 68,.08)",
        borderRadius: 14,
        textDecoration: "none",
        boxShadow: "0 1px 3px rgba(79, 74, 68,.05)",
        transition: "transform .22s ease, box-shadow .22s ease",
      }}
    >
      <span
        style={{
          flex: "none",
          width: 64,
          height: 50,
          borderRadius: 9,
          overflow: "hidden",
          display: "block",
        }}
      >
        <SafeImage
          src={house.photo}
          alt=""
          label=" "
          className="h-full w-full"
          sizes="72px"
        />
      </span>
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-body)",
            lineHeight: 1.2,
            color: INK,
          }}
        >
          {house.name}
        </span>
        <span
          style={{
            display: "block",
            marginTop: 2,
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-eyebrow)",
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "#736F69",
          }}
        >
          {house.place}
        </span>
      </span>
    </Link>
  );
}
