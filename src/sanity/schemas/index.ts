import type { SchemaTypeDefinition } from "sanity";

import assistante from "./assistante";
import avis from "./avis";
import lieu from "./lieu";
import logement from "./logement";
import site from "./site";

export const schemaTypes: SchemaTypeDefinition[] = [
  site,
  assistante,
  logement,
  lieu,
  avis,
];
