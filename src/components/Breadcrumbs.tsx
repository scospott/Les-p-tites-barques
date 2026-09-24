import { Link } from "@/i18n/navigation";

/* ------------------------------------------------------------------
   Fil d'Ariane visible — « Accueil › Saint-Malo › Les Remparts Mer ».
   Mêmes libellés et mêmes chemins que le BreadcrumbList JSON-LD de la
   page (les deux sont construits depuis la même liste `items`). Discret :
   petites capitales de l'eyebrow, encre atténuée ; le dernier maillon est
   la page courante (texte, `aria-current`).
   ------------------------------------------------------------------ */

export default function Breadcrumbs({
  items,
  label,
  className = "",
}: {
  /** [libellé, chemin] du plus général au plus précis. */
  items: [string, string][];
  /** Nom accessible du <nav> (« Fil d'Ariane »). */
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={className}>
      <ol className="kicker flex flex-wrap items-center gap-x-2.5 gap-y-1 text-ink-faint">
        {items.map(([name, href], i) => {
          const last = i === items.length - 1;
          return (
            <li key={href} className="inline-flex items-center gap-2.5">
              {last ? (
                <span aria-current="page" className="text-ink-soft">
                  {name}
                </span>
              ) : (
                <>
                  <Link
                    href={href}
                    className="transition-colors duration-200 hover:text-ink"
                  >
                    {name}
                  </Link>
                  <span aria-hidden="true">›</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
