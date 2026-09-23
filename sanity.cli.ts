/**
 * Configuration de la CLI Sanity (`npx sanity …`). Elle ne sert PAS au site :
 * le Studio embarqué lit `sanity.config.ts`. Celle-ci donne juste à la ligne
 * de commande de quoi parler au bon projet (validation de schéma, origines
 * CORS, déploiement du dataset…).
 */
import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
  api: {
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  },
});
