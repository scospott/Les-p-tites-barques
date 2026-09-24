import type { StructureBuilder, StructureResolver } from "sanity/structure";

import { apiVersion } from "./env";

/** Documents uniques : un seul exemplaire, à l'`_id` fixe. */
const SINGLETONS = [
  { id: "site", type: "site", title: "Site" },
  { id: "assistante", type: "assistante", title: "Assistante" },
];

export const singletonIds = SINGLETONS.map((s) => s.id);
export const singletonTypes = SINGLETONS.map((s) => s.type);

/**
 * Menu du back-office : Site · Assistante · Logements · Destinations · Lieux · Avis.
 * « Avis » s'ouvre sur un sous-menu par logement (+ « Sans logement »).
 * Les deux premiers ouvrent DIRECTEMENT leur document — pas de liste, pas de
 * bouton « créer » : il n'y en a qu'un, et il existe déjà.
 */
export const structure: StructureResolver = (S, context) =>
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
      S.documentTypeListItem("destination").title("Destinations"),
      S.documentTypeListItem("lieu").title("Lieux"),
      S.listItem()
        .title("Avis")
        .id("avis")
        .schemaType("avis")
        .child(async () => {
          // Un sous-menu par logement, lu à l'ouverture : un logement ajouté
          // dans le Studio y apparaît sans toucher au code.
          const logements = await context
            .getClient({ apiVersion })
            .fetch<{ _id: string; nom: string }[]>(
              `*[_type == "logement" && !(_id in path("drafts.**"))] | order(ordre asc){ _id, nom }`,
            );
          return S.list()
            .title("Avis")
            .items([
              ...logements.map((l) =>
                S.listItem()
                  .title(l.nom)
                  .id(l._id)
                  .schemaType("avis")
                  .child(
                    avisList(S, l.nom, `logement._ref == $logement`, { logement: l._id })
                      // « Créer » depuis ce sous-menu pré-remplit le logement.
                      .initialValueTemplates([
                        S.initialValueTemplateItem("avis-par-logement", { logementId: l._id }),
                      ]),
                  ),
              ),
              S.divider(),
              S.listItem()
                .title("Sans logement")
                .id("avis-sans-logement")
                .schemaType("avis")
                .child(avisList(S, "Sans logement", "!defined(logement)")),
            ]);
        }),
    ]);

/** Avis filtrés, du plus récent au plus ancien (puis ordre d'affichage). */
function avisList(
  S: StructureBuilder,
  title: string,
  filter: string,
  params: Record<string, string> = {},
) {
  return S.documentList()
    .title(title)
    .schemaType("avis")
    .apiVersion(apiVersion)
    .filter(`_type == "avis" && ${filter}`)
    .params(params)
    .defaultOrdering([
      { field: "date", direction: "desc" },
      { field: "ordre", direction: "asc" },
    ]);
}
