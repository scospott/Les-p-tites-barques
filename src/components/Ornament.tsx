/* ------------------------------------------------------------------
   Ornament — séparateur décoratif « trait · point · trait » placé entre
   l'eyebrow et le titre des sections. Purement visuel (aria-hidden),
   point kaki (4e accent), filets stone. `tone="dark"` pour les bandes
   anthracite (crème translucide + kaki clair).
   ------------------------------------------------------------------ */

export default function Ornament({
  className = "",
  tone = "light",
}: {
  className?: string;
  tone?: "light" | "dark";
}) {
  const line = tone === "dark" ? "bg-[#F1ECE3]/20" : "bg-sand-soft";
  const dot = tone === "dark" ? "bg-[#B3B49A]" : "bg-kaki";
  return (
    <span aria-hidden className={`flex items-center gap-2.5 ${className}`}>
      <span className={`h-px w-7 ${line}`} />
      <span className={`h-[5px] w-[5px] rounded-full ${dot}`} />
      <span className={`h-px w-7 ${line}`} />
    </span>
  );
}
