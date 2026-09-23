import type { StructureResolver } from "sanity/structure";

/** Documents uniques : un seul exemplaire, à l'`_id` fixe. */
const SINGLETONS = [
  { id: "site", type: "site", title: "Site" },
  { id: "assistante", type: "assistante", title: "Assistante" },
];

export const singletonIds = SINGLETONS.map((s) => s.id);
export const singletonTypes = SINGLETONS.map((s) => s.type);

/**
 * Menu du back-office : Site · Assistante · Logements · Lieux · Avis.
 * Les deux premiers ouvrent DIRECTEMENT leur document — pas de liste, pas de
 * bouton « créer » : il n'y en a qu'un, et il existe déjà.
 */
export const structure: StructureResolver = (S) =>
  S.list()
    .title("Back-office")
    .items([
      ...SINGLETONS.map((s) =>
        S.listItem()
          .title(s.title)
          .id(s.id)
          .child(S.document().schemaType(s.type).documentId(s.id).title(s.title)),
      ),
      S.divider(),
      S.documentTypeListItem("logement").title("Logements"),
      S.documentTypeListItem("lieu").title("Lieux"),
      S.documentTypeListItem("avis").title("Avis"),
    ]);
