import type { Locale } from "@/i18n/routing";
import { apartments, pick } from "./appartements";

/* ============================================================
   Détection des logements cités par l'assistant dans une réponse.

   Sert à deux choses : afficher une mini-carte cliquable sous sa bulle
   (photo + nom + lien) et proposer des suites d'actions ciblées sur la
   maison dont on vient de parler.

   Comparaison insensible à la casse ET aux accents : le modèle écrit
   parfois « Parame ». Les noms sont identiques en FR et EN (noms
   propres), mais on passe la locale pour le libellé affiché.
   ============================================================ */

export interface HouseRef {
  slug: string;
  name: string;
  /** Localité affichée sous le nom dans la mini-carte. */
  place: string;
  photo: string;
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2019']/g, "'")
    .toLowerCase();

/**
 * Maisons nommées dans `text`, dans l'ordre de la première mention.
 * Limité à 2 : au-delà, une réponse qui les cite toutes n'a pas besoin
 * d'une pile de cartes — les suggestions de suite prennent le relais.
 */
export function housesIn(text: string, locale: Locale): HouseRef[] {
  if (!text) return [];
  const hay = fold(text);
  return apartments
    .map((a) => ({ a, at: hay.indexOf(fold(pick(a.name, locale))) }))
    .filter((m) => m.at >= 0)
    .sort((x, y) => x.at - y.at)
    .slice(0, 2)
    .map(({ a }) => ({
      slug: a.slug,
      name: pick(a.name, locale),
      place: pick(a.locality, locale),
      photo: a.mainImage,
    }));
}
