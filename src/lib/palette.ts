/* ============================================================
   Palette — Les P'tites Barques, alignée sur le logo officiel.
   SOURCE UNIQUE côté TypeScript (styles inline, canvas, three.js). Les
   MÊMES valeurs vivent dans les tokens CSS de src/app/globals.css
   (`@theme` : --color-ink, --color-kaki, --color-terra…) — modifier les
   deux ensemble.

   Le logo vit en kaki brossé (#676155), brun-roux (herbes, toit) et taupe :
   - `ink`   : taupe DOUX (gris chaud) — remplace l'ancien gris-brun profond
               jugé trop noir. Crème #F1ECE3 dessus ≈ 7,3:1 (AA/AAA texte),
               ink sur blanc ≈ 8:1 ;
   - `kaki`  : olive brossé, entre le vert-de-gris d'origine et le cercle du
               logo — blanc sur kaki ≥ 5:1 ;
   - `terra` : brun-roux / camel du logo — TOUS les boutons d'action
               (Réserver, envoi du chat, parcours résa) + marqueurs, étoiles.
   ============================================================ */
export const PALETTE = {
  /** Taupe doux — fond du footer, en-tête du chat, cartes récap. */
  ink: "#4F4A44",
  /** Taupe plus profond — hover des surfaces sombres (jamais de noir pur). */
  inkDeep: "#3F3B36",
  inkSoft: "#6B6864",
  inkFaint: "#736F69",
  paper: "#FFFFFF",
  offwhite: "#F5F4F2",
  /** Crème — texte sur fonds sombres, fonds de l'assistant. */
  cream: "#F1ECE3",
  creamSoft: "#F8F5F0",
  /** Accent kaki (olive brossé du logo) — sélection, focus, pictos. */
  kaki: "#656B57",
  kakiDeep: "#545A48",
  kakiLight: "#B3B49A",
  /** Camel / brun-roux du logo — boutons d'action, pills actives, étoiles. */
  terra: "#A8603C",
  /** Camel foncé — hover des boutons camel. */
  terraDeep: "#8F4F30",
  /** Camel très foncé — état pressé. */
  terraPress: "#7A4228",
  /** Océan des cartes (inchangé, bleu-gris très clair). */
  ocean: "#EAEEF1",
} as const;

/** Composante RGB « r, g, b » d'une couleur de la palette (pour rgba()). */
export function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
