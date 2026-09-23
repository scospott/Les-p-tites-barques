"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { LOCALE_NAMES } from "@/lib/locale";

/* ------------------------------------------------------------------
   LanguageMenu — sélecteur de langue du header.
   - `layout="dropdown"` (desktop) : bouton « globe + langue courante » qui
     ouvre une liste des six langues (Français, English, Deutsch,
     Nederlands, Español, 中文). Accessible clavier : flèches ↑/↓, Home/End,
     Échap ferme, Tab sort ; fermeture au clic extérieur. Chaque entrée est
     un <Link locale=…> vers la MÊME page dans l'autre langue.
   - `layout="inline"` (menu mobile) : les six langues en pastilles, sans
     panneau flottant (le panneau mobile est en overflow:hidden).
   ------------------------------------------------------------------ */

function GlobeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.25" />
      <path d="M2.75 12h18.5" />
      <path d="M12 2.75c2.6 2.7 3.9 5.8 3.9 9.25S14.6 18.55 12 21.25c-2.6-2.7-3.9-5.8-3.9-9.25S9.4 5.45 12 2.75Z" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function LanguageMenu({
  layout = "dropdown",
  onLight = true,
  className = "",
}: {
  layout?: "dropdown" | "inline";
  /** Texte encre (fond clair) ou crème (sur photo de héros). */
  onLight?: boolean;
  className?: string;
}) {
  const t = useTranslations("nav");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const id = useId();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const close = useCallback((focusButton = false) => {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  }, []);

  // Fermeture au clic extérieur et à la navigation.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname, locale]);

  // Focus sur la langue courante à l'ouverture.
  useEffect(() => {
    if (!open) return;
    const idx = routing.locales.indexOf(locale);
    itemRefs.current[idx >= 0 ? idx : 0]?.focus();
  }, [open, locale]);

  const onListKey = (e: React.KeyboardEvent) => {
    const items = itemRefs.current.filter(Boolean) as HTMLAnchorElement[];
    const current = items.indexOf(document.activeElement as HTMLAnchorElement);
    const go = (i: number) => {
      e.preventDefault();
      items[(i + items.length) % items.length]?.focus();
    };
    switch (e.key) {
      case "ArrowDown":
        go(current + 1);
        break;
      case "ArrowUp":
        go(current - 1);
        break;
      case "Home":
        go(0);
        break;
      case "End":
        go(items.length - 1);
        break;
      case "Escape":
        e.preventDefault();
        close(true);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  if (layout === "inline") {
    return (
      <nav aria-label={t("language")} className={className}>
        <p className="kicker mb-3">{t("language")}</p>
        <ul className="lang-menu__inline">
          {routing.locales.map((loc) => (
            <li key={loc}>
              <Link
                href={pathname}
                locale={loc}
                hrefLang={loc}
                lang={loc}
                aria-current={loc === locale ? "true" : undefined}
                className="lang-menu__chip"
              >
                {LOCALE_NAMES[loc]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <div ref={rootRef} className={`lang-menu ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={`${t("languageMenu")} — ${LOCALE_NAMES[locale]}`}
        className={`lang-menu__button ${
          onLight
            ? "text-ink hover:bg-ink/[0.06]"
            : "text-paper hover:bg-paper/15"
        }`}
      >
        <GlobeIcon />
        <span>{LOCALE_NAMES[locale]}</span>
        <Chevron open={open} />
      </button>

      {open && (
        <ul
          id={`${id}-list`}
          role="menu"
          aria-label={t("languageMenu")}
          onKeyDown={onListKey}
          className="lang-menu__list"
        >
          {routing.locales.map((loc, i) => (
            <li key={loc} role="none">
              <Link
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                role="menuitem"
                href={pathname}
                locale={loc}
                hrefLang={loc}
                lang={loc}
                aria-current={loc === locale ? "true" : undefined}
                className="lang-menu__item"
                onClick={() => setOpen(false)}
              >
                <span>{LOCALE_NAMES[loc]}</span>
                {loc === locale && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
