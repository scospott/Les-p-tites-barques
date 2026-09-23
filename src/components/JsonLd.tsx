/** Données structurées d'une page — un seul script JSON-LD (`@graph`). */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // `<` échappé : une chaîne de contenu ne peut pas fermer la balise.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
