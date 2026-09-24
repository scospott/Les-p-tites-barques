import NotFoundContent from "@/components/NotFoundContent";

/*
 * 404 déclenchée par une page (notFound() : slug inconnu…). Les URL
 * inconnues, elles, passent par app/global-not-found.tsx.
 */
export default function LocaleNotFound() {
  return <NotFoundContent />;
}
