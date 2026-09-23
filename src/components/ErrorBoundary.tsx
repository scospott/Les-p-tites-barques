"use client";

import { Component, type ReactNode } from "react";

/* ------------------------------------------------------------------
   Filet de sécurité générique. React n'offre les error boundaries qu'en
   composant de classe — c'est la seule raison de cette classe dans une
   base 100 % fonctionnelle.

   Utilisé pour la carte de destination : si son rendu lève, on montre le
   repli cliquable au lieu de laisser un trou dans la page. Remonter la
   `key` (ex. l'id de la destination) réarme le filet.
   ------------------------------------------------------------------ */

interface Props {
  fallback: ReactNode;
  children: ReactNode;
  /** Étiquette du contexte dans le message de console. */
  label?: string;
}

export default class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`[${this.props.label ?? "ErrorBoundary"}]`, error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
