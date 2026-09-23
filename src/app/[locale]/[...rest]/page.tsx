import { notFound } from "next/navigation";

// Toute URL inconnue sous une locale affiche la page 404 localisée.
export default function CatchAllPage() {
  notFound();
}
