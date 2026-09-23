"use client";

import { NextStudio } from "next-sanity/studio";

import config from "../../../../sanity.config";

/* Frontière client explicite. Le Studio est une application React à part
   entière : ses fournisseurs de contexte s'initialisent au chargement du
   module. Importé depuis un composant serveur, ce module serait évalué
   pendant la collecte des pages, là où React.createContext n'existe pas. */
export default function Studio() {
  return <NextStudio config={config} />;
}
