/* ============================================================
   Source FIGÉE de la migration vers Sanity (scripts/migrate-to-sanity.ts).

   Le site ne lit plus que Sanity : ce dossier conserve le contenu tel qu'il
   était dans le code au moment de la migration finale, pour que
   `--logement=<slug>` reste possible. Il n'est importé par AUCUN fichier de
   src/ — le modifier ne change pas le site.
   ============================================================ */

import { apartments, pick, type Apartment } from "../../src/lib/appartements";
import {
  buildSystemPrompt,
  extrasLine,
  realPlaces,
} from "../../src/lib/assistant-knowledge";
import { destinationPageList } from "../../src/lib/destination-pages";
import { site } from "../../src/lib/site";
import { DIRECT_DISCOUNT } from "../../src/lib/booking-extras";

export { apartments, pick, site };
export type SourceApartment = Apartment;

/** Pages destination : ce qui ne se traduit pas (le texte est dans messages/). */
export const destinationSources = destinationPageList.map((d) => ({
  id: d.id,
  label: d.label,
  placeName: d.placeName,
  region: d.region,
  messagesKey: d.messagesKey,
}));

/** Jetons remplis à chaque requête par src/lib/assistant-prompt.ts. */
export const ASSISTANT_TOKENS = {
  logements: "{{logements}}",
  lieux: "{{lieux}}",
  remise: "{{remise}}",
  extras: "{{extras}}",
  versionSite: "{{versionSite}}",
  langueSite: "{{langueSite}}",
} as const;

/**
 * Prompt système FRANÇAIS de la version code, dont les parties calculées
 * deviennent des jetons. Chaque remplacement est vérifié : un texte source
 * qui aurait changé fait échouer la migration plutôt que de figer un prompt
 * à moitié calculé.
 */
export function buildLegacySystemPrompt(t: typeof ASSISTANT_TOKENS): string {
  let p = buildSystemPrompt("fr");
  const swap = (from: string | RegExp, to: string) => {
    const next = p.replace(from, to);
    if (next === p) throw new Error(`Jeton non posé : ${String(from)}`);
    p = next;
  };
  swap(/# Mes logements\n[\s\S]*?\n\n# Réservation et tarifs/, `# Mes logements\n${t.logements}\n\n# Réservation et tarifs`);
  swap(`: ${realPlaces()}. Rien`, `: ${t.lieux}. Rien`);
  swap(`−${Math.round(DIRECT_DISCOUNT * 100)} % sur le prix`, `−${t.remise} % sur le prix`);
  swap(extrasLine("fr"), t.extras);
  swap(
    "la version française du site : si sa langue n'est pas évidente, réponds en français.",
    `la version ${t.versionSite} du site : si sa langue n'est pas évidente, réponds en ${t.langueSite}.`,
  );
  return p;
}
