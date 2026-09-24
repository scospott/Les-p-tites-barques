import Image from "next/image";
import { Fragment } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { site } from "@/lib/site";
import { destinationConfig } from "@/lib/destination-config";
import type { Locale } from "@/i18n/routing";
import { getDestinationSummaries, getSite } from "@/sanity/adapters";
import FooterFadeFrom from "./FooterFadeFrom";

/* ------------------------------------------------------------------
   Footer sombre — la vue aérienne des barques en texture sous un voile
   taupe doux (token `ink`, 70 %), texte crème #FFFAF2 avec ombre portée
   douce (titre de colonne compris), accents kaki clair #B3B49A (hovers).

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

   Sous le copyright : liens vers les deux pages destination.

   Colonne Contact : e-mail, puis les deux boutons réseaux « 3D » aux
   couleurs officielles (Instagram dégradé, Facebook bleu — styles dans
   globals.css, `.social-3d`), puis la ligne des langues. Les URL vivent
   dans Sanity › Site (contact, réseaux, baseline).

   ------------------------------------------------------------------ */

const CREAM = "#FFFAF2";

/* Fondu d'entrée du footer. `--fade` = hauteur de la zone de transition
   (160 px mobile, 280 px desktop, cf. classes du <footer>) ; toutes les
   cotes en découlent, calées sur le desktop (120 / 240 / 330 px pour 280).
   BORD HAUT : les `--lead` (60 px) premiers pixels sont STRICTEMENT la
   couleur de la section précédente — masque à 0, ni photo ni voile — pour
   qu'aucune démarcation ne se voie ; le fondu démarre ensuite.
   MASQUE (photo + voile) : courbe douce, pas linéaire — la photo sort
   lentement de la couleur de la page, puis s'affirme. */
const LEAD = "60px";
const fadeAt = (k: number) => `calc(${LEAD} + (var(--fade) - ${LEAD}) * ${k})`;
const FADE_MASK = `linear-gradient(to bottom, transparent 0, transparent ${LEAD}, rgba(0,0,0,.18) ${fadeAt(0.25)}, rgba(0,0,0,.55) ${fadeAt(0.55)}, rgba(0,0,0,.9) ${fadeAt(0.82)}, #000 var(--fade))`;
/* VOILE : il ne monte qu'une fois la photo installée — le haut de la zone
   reste turquoise et lumineux, les 70 % n'arrivent qu'au début du texte. */
const INK = "79 74 68"; // --color-ink #4F4A44
/* Ombre portée du texte, plus appuyée que celle de .footer-on-photo : le
   footer, plus haut, recadre la photo et place des bateaux blancs sous le
   texte. Pire pixel au contact des lettres ≥ 4,5:1 (ombre comprise) à 1905,
   1440 et 390 px ; les boutons réseaux gardent leur rendu (text-shadow: none). */
const TEXT_SHADOW =
  "0 1px 2px rgb(0 0 0 / .75), 0 0 6px rgb(0 0 0 / .6), 0 1px 16px rgb(0 0 0 / .5)";
const FADE_VEIL = `linear-gradient(to bottom, rgb(${INK} / 0) 0, rgb(${INK} / .12) calc(var(--fade) * 120 / 280), rgb(${INK} / .45) calc(var(--fade) * 240 / 280), rgb(${INK} / .7) calc(var(--fade) * 330 / 280), rgb(${INK} / .7) 100%)`;

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

export default async function Footer() {
  const t = await getTranslations("footer");
  const tn = await getTranslations("nav");
  const locale = (await getLocale()) as Locale;
  const [content, destinations] = await Promise.all([getSite(), getDestinationSummaries()]);
  const year = new Date().getFullYear();

  /* Liens traités en boutons : -mx-3 px-3 → le padding déborde vers
     l'extérieur, la colonne de texte reste alignée sur la grille. */
  const linkCls =
    "-mx-3 inline-flex rounded-full px-3 py-2 text-body text-[#FFFAF2] transition-colors duration-200 hover:bg-[#F1ECE3]/[0.06] hover:text-[#B3B49A]";

  const colTitleCls = "kicker";

  const bottomLinkCls =
    "underline-offset-4 transition-colors duration-200 hover:text-[#B3B49A] hover:underline";

  return (
    <footer
      id="site-footer"
      className="relative overflow-hidden [--fade:160px] min-[900px]:[--fade:280px]"
      // Couleur de départ du fondu = fond réel du bas de la page, relu par
      // <FooterFadeFrom> ; blanc (fond du body) avant hydratation.
      style={{ backgroundColor: "var(--footer-from, var(--color-paper))" }}
    >
      <FooterFadeFrom targetId="site-footer" />
      {/* Fond : la vue aérienne des barques, réduite à une texture sous un
          voile dans la teinte du footer (70 % : le minimum qui tient 4,5:1 mesuré
          sur tout le texte, ombre comprise — 62 % laissait le crédit à 3,9:1).
          Le reste de la lisibilité vient du texte crème #FFFAF2 et de son
          ombre portée (.footer-on-photo). Image lazy (le footer est
          toujours sous la ligne de flottaison), calques absolus : zéro CLS.
          Décorative : alt vide.
          Entrée en fondu (FADE_MASK, FADE_VEIL) depuis la couleur de la
          page ; le contenu commence SOUS la zone de transition, là où le
          voile est à 70 % (padding haut 200 px mobile, 340 px desktop). */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }}
      >
        <Image
          src="/images/accueil/barques-vue-aerienne.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[50%_40%]"
        />
        <div className="absolute inset-0" style={{ backgroundImage: FADE_VEIL }} />
      </div>
      <div
        className="footer-on-photo shell-wide relative pb-8 pt-[200px] sm:pb-9 min-[900px]:pt-[340px]"
        style={{ textShadow: TEXT_SHADOW }}
      >
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
            <p className="mt-3 max-w-sm text-body leading-relaxed text-[#FFFAF2]">
              {content.baseline[locale]}
            </p>
          </div>

          {/* Contact — e-mail, boutons réseaux 3D, langues, alignés à gauche
              comme la colonne marque. Vaut à toutes les largeurs, empilé
              comme côte à côte. */}
          <div>
            {/* Crème et non kaki : sur la photo, le kaki clair plafonnait à
                ~3,8:1. */}
            <p className={colTitleCls} style={{ color: CREAM }}>
              {t("contactTitle")}
            </p>
            <ul className="mt-4 space-y-1">
              <li>
                <a href={`mailto:${content.email}`} className={linkCls}>
                  {content.email}
                </a>
              </li>
              <li className="pt-4">
                {/* Instagram + Facebook côte à côte (empilés quand la colonne
                    est étroite), mêmes dimensions, couleurs officielles. */}
                <div className="flex flex-wrap gap-x-4 gap-y-5">
                  {content.instagram && (
                    <a
                      href={content.instagram}
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
                  )}
                  {content.facebook && (
                    <a
                      href={content.facebook}
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
                  )}
                </div>
              </li>
              <li className="px-0 pt-4 text-body text-[#FFFAF2]">
                {t("languages")}
              </li>
            </ul>
          </div>
        </div>

        {/* Bas de page — copyright + mentions légales */}
        <div className="mt-8 border-t border-[#F1ECE3]/12 pt-5 text-center text-body text-[#FFFAF2]">
          <p className="leading-relaxed">
            © {year} {site.name}. {t("rights")}
            {" · "}
            <Link href="/mentions-legales" className={bottomLinkCls}>
              {t("legal")}
            </Link>
          </p>
          {/* Pages destination (SEO local) — discret, sous le copyright. */}
          <nav aria-label={t("destinations")} className="mt-1.5 leading-relaxed">
            {destinations.map((d, i) => (
              <Fragment key={d.id}>
                {i > 0 && " · "}
                <Link href={destinationConfig[d.id].path} className={bottomLinkCls}>
                  {d.label}
                </Link>
              </Fragment>
            ))}
          </nav>
          <p className="mt-1.5 text-[11px] text-[#FFFAF2]">
            {t("photoCredit")}
          </p>
        </div>
      </div>
    </footer>
  );
}
