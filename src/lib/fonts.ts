import { Fraunces, Noto_Serif_SC } from "next/font/google";

/* ============================================================
   UNE SEULE FAMILLE : Fraunces — celle du titre « Les P'tites Barques ».
   Titres, sous-titres, corps, nav, boutons, labels : tout est en Fraunces
   (axes optiques réglés dans globals.css : opsz bas pour le corps, haut
   pour les grands titres). Inter et Libre Baskerville ont été retirées.

   Exception CJK : Noto Serif SC vient EN REPLI de Fraunces sur la locale
   zh (les sinogrammes n'existent pas dans une serif latine). La classe
   n'est posée sur <html> que pour /zh (cf. layout) — aucune autre locale
   ne charge ce fichier.
   ============================================================ */

export const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT", "WONK"],
});

// Serif chinoise (simplifié) — variable, chargée uniquement sur /zh. Pas de
// préchargement : Google découpe la fonte en tranches unicode-range, le
// navigateur ne télécharge que celles que la page utilise.
export const notoSerifSC = Noto_Serif_SC({
  subsets: ["latin"],
  preload: false,
  display: "swap",
  variable: "--font-noto-sc",
});
