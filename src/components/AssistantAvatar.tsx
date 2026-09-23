import Image from "next/image";

/* ------------------------------------------------------------------
   Pastille de Gwenaëlle — le visage de l'assistante : sa photo
   (public/images/accueil/gwenaelle.jpg, la même que la section « L'histoire »)
   recadrée en cercle, visage centré. Partagée par le bouton flottant, le
   panneau (ChatWidget) et la section inline de l'accueil (AssistantCTA)
   pour que l'assistante ait exactement le même visage partout.
   Point « en ligne » vert conservé, liseré à la couleur du fond.
   ------------------------------------------------------------------ */

export const GWENAELLE_PHOTO = "/images/accueil/gwenaelle.jpg";
const ONLINE = "#6E9C6A";

export default function AssistantAvatar({
  size = 30,
  /** Couleur du fond derrière la pastille — liseré du point « en ligne ». */
  ringColor,
  online = false,
  /** Halo qui respire (bouton flottant). */
  breathe = false,
}: {
  size?: number;
  ringColor: string;
  online?: boolean;
  breathe?: boolean;
}) {
  const dot = Math.max(9, Math.round(size * 0.24));
  return (
    <span
      style={{
        position: "relative",
        flex: "none",
        width: size,
        height: size,
        display: "inline-block",
      }}
      aria-hidden="true"
    >
      <span
        {...(breathe ? { "data-breathe": "avatar" } : {})}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          display: "block",
          background: "#DED7C8",
          boxShadow: "inset 0 0 0 1px rgba(79, 74, 68, .12)",
        }}
      >
        <Image
          src={GWENAELLE_PHOTO}
          alt=""
          width={size * 2}
          height={size * 2}
          sizes={`${size * 2}px`}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            // Portrait 3:4 → le visage est dans le tiers haut : on cadre dessus.
            objectPosition: "50% 22%",
            transform: "scale(1.12)",
            transformOrigin: "50% 30%",
          }}
        />
      </span>
      {online && (
        <span
          style={{
            position: "absolute",
            right: -1,
            bottom: -1,
            width: dot,
            height: dot,
            borderRadius: "50%",
            background: ONLINE,
            border: `2px solid ${ringColor}`,
          }}
        />
      )}
    </span>
  );
}
