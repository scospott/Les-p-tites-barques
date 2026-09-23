import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { site } from "@/lib/site";

/* ------------------------------------------------------------------
   Footer sombre — taupe doux (token `ink`), texte crème #F1ECE3, accents
   kaki clair #B3B49A (titre de colonne, hovers, filets). Enchaîne avec la
   section assistant taupe au-dessus.

   DEUX zones seulement — marque et Contact. La colonne « Explorer » (liens
   logements + L'histoire) a été retirée : la navigation du header couvre
   déjà ces destinations, et le footer y gagne en hauteur.

   Typo : une seule serif (Fraunces) ; tout le texte est à la taille du
   corps (jamais plus petit), titres de colonnes en eyebrow, nom de la
   marque à la taille des titres de section.

   Colonne de gauche : nom « Les P'tites Barques », LOGO OFFICIEL (carte
   crème arrondie — le logo, traits kaki / terre cuite sur fond transparent,
   manquerait de contraste posé nu sur le taupe), puis la baseline. Les trois
   sont alignés à gauche, comme la colonne Contact. SEULE la ligne de
   copyright est centrée, sur la largeur totale du footer.

   Rythme vertical resserré (paddings de section, écarts internes et taille
   de la vignette logo) : c'est un pied de page, pas une section.

   Colonne Contact : e-mail, puis les deux boutons réseaux « 3D » aux
   couleurs officielles (Instagram dégradé, Facebook bleu — styles dans
   globals.css, `.social-3d`), puis la ligne des langues. Les URL vivent
   dans lib/site.ts.

   ------------------------------------------------------------------ */

const KAKI_LIGHT = "#B3B49A";
const CREAM = "#F1ECE3";

/** Pictogramme Instagram (contour, style lucide). */
function InstagramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="5" />
      <circle cx="12" cy="12" r="3.6" />
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Pictogramme Facebook (« f » plein). */
function FacebookIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M13.5 22v-8.2h2.8l.4-3.3h-3.2V8.4c0-.95.27-1.6 1.63-1.6h1.72V3.85c-.3-.04-1.32-.13-2.5-.13-2.48 0-4.18 1.51-4.18 4.29v2.46H7.4v3.3h2.79V22h3.31z" />
    </svg>
  );
}

export default function Footer() {
  const t = useTranslations("footer");
  const tn = useTranslations("nav");
  const year = new Date().getFullYear();

  /* Liens traités en boutons : -mx-3 px-3 → le padding déborde vers
     l'extérieur, la colonne de texte reste alignée sur la grille. */
  const linkCls =
    "-mx-3 inline-flex rounded-full px-3 py-2 text-body text-[#F1ECE3]/85 transition-colors duration-200 hover:bg-[#F1ECE3]/[0.06] hover:text-[#B3B49A]";

  const colTitleCls = "kicker";

  return (
    <footer className="border-t border-[#F1ECE3]/10 bg-ink">
      <div className="shell-wide py-8 sm:py-9">
        {/* Deux zones : marque et Contact, toutes deux alignées à gauche.
            En mobile elles s'empilent, alignement inchangé. */}
        <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:gap-12">
          {/* Marque — nom serif crème, vignette logo, baseline : les trois
              alignés sur le bord gauche de la zone. */}
          <div>
            <p
              className="font-display text-title tracking-tight"
              style={{ color: CREAM }}
            >
              {site.name}
            </p>
            {/* Logo officiel — carte crème arrondie pour qu'il ressorte sur
                le taupe (traits kaki / terre cuite). Format vignette. */}
            <Link
              href="/"
              aria-label={tn("brandHome")}
              className="brand-logo-card mt-3 w-[112px] sm:w-[124px]"
            >
              <Image
                src="/images/logo/logo.png"
                alt={site.name}
                width={220}
                height={220}
                sizes="124px"
                // Eager : le footer est sur toutes les pages et le logo en est
                // l'élément d'identité — il ne doit jamais apparaître en carte vide.
                loading="eager"
                className="h-auto w-full"
              />
            </Link>
            <p className="mt-3 max-w-sm text-body leading-relaxed text-[#F1ECE3]/65">
              {t("tagline")}
            </p>
          </div>

          {/* Contact — e-mail, boutons réseaux 3D, langues, alignés à gauche
              comme la colonne marque. Vaut à toutes les largeurs, empilé
              comme côte à côte. */}
          <div>
            <p className={colTitleCls} style={{ color: KAKI_LIGHT }}>
              {t("contactTitle")}
            </p>
            <ul className="mt-4 space-y-1">
              <li>
                <a href={`mailto:${site.email}`} className={linkCls}>
                  {site.email}
                </a>
              </li>
              <li className="pt-4">
                {/* Instagram + Facebook côte à côte (empilés quand la colonne
                    est étroite), mêmes dimensions, couleurs officielles. */}
                <div className="flex flex-wrap gap-x-4 gap-y-5">
                  <a
                    href={site.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="social-3d social-3d--instagram"
                    aria-label={t("instagramAria")}
                  >
                    <span className="social-3d__face">
                      <InstagramIcon size={21} />
                      <span>{t("instagram")}</span>
                    </span>
                  </a>
                  <a
                    href={site.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="social-3d social-3d--facebook"
                    aria-label={t("facebookAria")}
                  >
                    <span className="social-3d__face">
                      <FacebookIcon size={21} />
                      <span>{t("facebook")}</span>
                    </span>
                  </a>
                </div>
              </li>
              <li className="px-0 pt-4 text-body text-[#F1ECE3]/65">
                {t("languages")}
              </li>
            </ul>
          </div>
        </div>

        {/* Bas de page — copyright + mentions légales */}
        <div className="mt-8 border-t border-[#F1ECE3]/12 pt-5 text-center text-body text-[#F1ECE3]/55">
          <p className="leading-relaxed">
            © {year} {site.name}. {t("rights")}
            {" · "}
            <Link
              href="/mentions-legales"
              className="underline-offset-4 transition-colors duration-200 hover:text-[#B3B49A] hover:underline"
            >
              {t("legal")}
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
