import { Link } from "@/i18n/navigation";
import SafeImage from "./SafeImage";
import { pick, type ApartmentSummary } from "@/lib/appartements";
import type { Locale } from "@/i18n/routing";

interface Props {
  apartment: ApartmentSummary;
  locale: Locale;
  /** Étiquette de statut déjà traduite (« Nouveau », « Bientôt »…). */
  statusLabel?: string;
  discoverLabel: string;
  /** `sizes` de la photo (grille 2 colonnes par défaut). */
  sizes?: string;
}

export default function ApartmentCard({
  apartment,
  locale,
  statusLabel,
  discoverLabel,
  sizes = "(min-width:640px) 45vw, 100vw",
}: Props) {
  const name = pick(apartment.name, locale);
  const locality = pick(apartment.locality, locale);
  const tagline = pick(apartment.tagline, locale);

  return (
    <Link
      href={`/appartements/${apartment.slug}`}
      className="group block"
      aria-label={`${name}, ${locality}`}
    >
      {/* Photo en 3/2, object-cover : elle remplit le cadre arrondi (coins 16px
          nets et uniformes sur les 4 cartes, quel que soit le ratio source —
          sans « cover », un ratio différent donnerait du lettrage et des coins
          invisibles). */}
      <div className="relative overflow-hidden rounded-[16px] bg-offwhite">
        <SafeImage
          src={apartment.mainImage}
          alt={name}
          ratio="3/2"
          fit="cover"
          sizes={sizes}
          imgClassName="transition-transform duration-[1200ms] ease-out group-hover:scale-[1.03]"
        />
        {statusLabel && (
          <span className="kicker absolute right-3 top-3 rounded-full border border-line bg-paper/90 px-3.5 py-1.5 text-ink backdrop-blur-sm">
            {statusLabel}
          </span>
        )}
      </div>

      <div className="mt-5 flex items-start justify-between gap-4">
        <div>
          <p className="kicker text-ink-faint">{locality}</p>
          <h3 className="subtitle mt-2 text-ink">{name}</h3>
        </div>
        <span
          className="mt-1 inline-flex translate-x-0 items-center text-ink-soft transition-all duration-500 group-hover:translate-x-1 group-hover:text-kaki"
          aria-hidden="true"
        >
          <svg width="22" height="12" viewBox="0 0 22 12" fill="none">
            <path
              d="M0 6h20M15 1l5 5-5 5"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
      <p className="lede mt-2.5 max-w-md">{tagline}</p>
      <span className="sr-only">{discoverLabel}</span>
    </Link>
  );
}
