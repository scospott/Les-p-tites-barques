"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import AnchorLink from "@/components/AnchorLink";
import BookingModal from "@/components/BookingModal";
import LanguageMenu from "@/components/LanguageMenu";
import { site } from "@/lib/site";

export default function Header() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  // « Réserver » → modal de choix du logement (BookingModal).
  const [bookingOpen, setBookingOpen] = useState(false);
  const closeBooking = useCallback(() => setBookingOpen(false), []);

  const [open, setOpen] = useState(false);
  // Header transparent tant qu'un hero couvre le haut du viewport (y compris
  // pendant un hero épinglé / scroll-scrub), opaque ensuite. Sur une page sans
  // hero (ex. 404), il reste opaque (texte blanc sinon invisible sur fond clair).
  const [atHero, setAtHero] = useState(true);

  // Referme le menu mobile et (ré)observe le hero à chaque changement de page.
  useEffect(() => {
    setOpen(false);
    const hero = document.querySelector("[data-hero]");
    if (!hero) {
      setAtHero(false);
      return;
    }
    setAtHero(true);
    const io = new IntersectionObserver(
      ([entry]) => setAtHero(entry.isIntersecting),
      { rootMargin: "-72px 0px 0px 0px" },
    );
    io.observe(hero);
    return () => io.disconnect();
  }, [pathname]);

  // Liens de section : glissement doux vers l'ancre (sur l'accueil) ou
  // navigation vers l'accueil puis glissement (cf. AnchorLink).
  const sections = [
    { href: "/#logements", label: t("apartments") },
    { href: "/#histoire", label: t("story") },
  ];

  const solid = open || !atHero;
  const onLight = solid; // texte encre sur fond clair

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${
        solid
          ? "border-b border-line bg-paper/85 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div
        className={`shell-wide flex items-center justify-between gap-6 transition-[padding] duration-500 ${
          solid ? "py-3.5" : "py-5 sm:py-7"
        }`}
      >
        {/* Marque : logo officiel (pastille crème, lisible sur photo comme sur
            fond clair) + nom en serif. Sur mobile, le nom se réduit d'un cran
            pour laisser la place au burger. */}
        <Link
          href="/"
          aria-label={t("brandHome")}
          className={`flex items-center gap-3 font-display tracking-tight transition-colors duration-500 ${
            onLight ? "text-ink" : "text-paper"
          }`}
        >
          <span className="brand-logo-disc h-11 w-11 sm:h-12 sm:w-12">
            <Image
              src="/images/logo/logo.png"
              // Le lien porte déjà un aria-label : ce texte sert aux moteurs.
              alt={`Logo ${site.name}`}
              width={48}
              height={48}
              priority
              className="h-[88%] w-[88%] object-contain"
            />
          </span>
          <span className="text-[1.2rem] leading-tight sm:text-2xl">
            Les P&apos;tites Barques
          </span>
        </Link>

        {/* Navigation desktop — libellés à la taille du corps (jamais plus
            petits), cible de clic généreuse. */}
        <nav className="hidden items-center gap-6 md:flex lg:gap-8">
          {sections.map((l) => (
            <AnchorLink
              key={l.href}
              href={l.href}
              className={`link-underline py-2 text-body transition-colors duration-500 ${
                onLight ? "text-ink" : "text-paper"
              }`}
            >
              {l.label}
            </AnchorLink>
          ))}
          <LanguageMenu onLight={onLight} />
          {/* Réserver — CAMEL partout, sur photo comme sur fond clair. */}
          <button
            type="button"
            onClick={() => setBookingOpen(true)}
            className="btn btn-primary px-7 py-3"
          >
            {t("book")}
          </button>
        </nav>

        {/* Burger mobile */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? t("close") : t("openMenu")}
          aria-expanded={open}
          // h-11/w-11 : 46,75 px, au-dessus des 44 px d'une cible tactile
          // confortable (h-10 tombait à 43 px).
          className={`-mr-1.5 flex h-11 w-11 items-center justify-center md:hidden ${
            onLight ? "text-ink" : "text-paper"
          }`}
        >
          <span className="relative block h-3 w-6">
            <span
              className={`absolute left-0 block h-px w-6 bg-current transition-all duration-300 ${
                open ? "top-1.5 rotate-45" : "top-0"
              }`}
            />
            <span
              className={`absolute left-0 top-3 block h-px w-6 bg-current transition-all duration-300 ${
                open ? "-translate-y-1.5 -rotate-45" : ""
              }`}
            />
          </span>
        </button>
      </div>

      {/* Panneau mobile */}
      <div
        inert={!open}
        className={`overflow-hidden border-t border-line bg-paper transition-[max-height,opacity] duration-500 md:hidden ${
          open ? "max-h-[36rem] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <nav className="shell flex flex-col gap-1 py-4">
          {sections.map((l) => (
            <AnchorLink
              key={l.href}
              href={l.href}
              onNavigate={() => setOpen(false)}
              className="py-3 font-display text-subtitle text-ink"
            >
              {l.label}
            </AnchorLink>
          ))}
          <div className="mt-3 border-t border-line pt-4">
            <LanguageMenu layout="inline" />
          </div>
          <div className="mt-5 flex items-center border-t border-line pt-4">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setBookingOpen(true);
              }}
              className="btn btn-primary w-full px-7 py-3"
            >
              {t("book")}
            </button>
          </div>
        </nav>
      </div>

      {/* Modal « Choisissez votre logement » (rendue en portal dans <body>) */}
      <BookingModal open={bookingOpen} onClose={closeBooking} />
    </header>
  );
}
