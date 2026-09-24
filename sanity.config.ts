/**
 * Configuration du Studio embarqué, monté sur /studio (cf.
 * src/app/studio/[[...tool]]/page.tsx).
 */
import { frFRLocale } from "@sanity/locale-fr-fr";
import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";

import { apiVersion, dataset, projectId } from "@/sanity/env";
import { schemaTypes } from "@/sanity/schemas";
import { singletonIds, singletonTypes, structure } from "@/sanity/structure";

export default defineConfig({
  basePath: "/studio",
  title: "Les P'tites Barques — Back-office",
  projectId,
  dataset,
  schema: {
    types: schemaTypes,
    // Les singletons n'apparaissent pas dans le menu « créer » : leur unique
    // document est créé par la migration et se modifie depuis le menu.
    templates: (templates) => [
      ...templates.filter(({ schemaType }) => !singletonTypes.includes(schemaType)),
      // Avis créé depuis le sous-menu d'un logement (cf. structure.ts).
      {
        id: "avis-par-logement",
        title: "Avis pour ce logement",
        schemaType: "avis",
        parameters: [{ name: "logementId", type: "string" }],
        value: ({ logementId }: { logementId: string }) => ({
          logement: { _type: "reference", _ref: logementId },
        }),
      },
    ],
  },
  document: {
    // Le modèle « avis pour ce logement » a besoin de son logement : il
    // n'est proposé que depuis le sous-menu Avis › <logement>.
    newDocumentOptions: (prev, { creationContext }) =>
      creationContext.type === "global"
        ? prev.filter((t) => t.templateId !== "avis-par-logement")
        : prev,
    // On retire aussi « dupliquer » et « supprimer » sur les singletons :
    // deux documents `site` mettraient le site dans un état indéfini.
    actions: (actions, { schemaType, documentId }) =>
      singletonTypes.includes(schemaType) || singletonIds.includes(documentId ?? "")
        ? actions.filter(({ action }) =>
            ["publish", "discardChanges", "restore"].includes(action ?? ""),
          )
        : actions,
  },
  plugins: [structureTool({ structure }), visionTool({ defaultApiVersion: apiVersion }), frFRLocale()],
});
