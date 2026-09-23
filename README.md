# Les P'tites Barques — site vitrine

Site vitrine premium pour **Les P'tites Barques** : des logements de charme entre
**Saint-Malo** et la **Guadeloupe**, tenus par Gwenaëlle. Démo de vente —
contenu en dur, esthétique marque hôtelière côtière, bilingue FR/EN.

## Stack

- **Next.js 15** (App Router, `src/app/[locale]`)
- **Tailwind CSS v4** (design system dans `src/app/globals.css`)
- **next-intl v4** — FR par défaut (sans préfixe), EN sous `/en`
- **GSAP** (ScrollTrigger + SplitText) & **Lenis** (smooth scroll)
- **Assistant** : Claude **Haiku** via `src/app/api/chat/route.ts`

## Démarrage

```bash
npm install
cp .env.example .env.local   # puis renseigner les variables
npm run dev                  # http://localhost:3000
```

Build de production :

```bash
npm run build && npm run start
```

Vérifications : `npm run typecheck` (tsc) — le build doit être vert.

## Variables d'environnement

| Variable               | Rôle                                                        |
| ---------------------- | ----------------------------------------------------------- |
| `ANTHROPIC_API_KEY`    | Active l'assistant (Claude Haiku). Sans clé → repli courtois.|
| `NEXT_PUBLIC_SITE_URL` | URL canonique (sitemap, hreflang, Open Graph).              |

## Photos (drop-in, sans toucher au code)

Déposez les vraies photos dans `public/images/<dossier>/` selon la convention
décrite dans [`public/images/README.md`](public/images/README.md)
(`hero.jpg`, `01.jpg`, `02.jpg`, …). Tant qu'un fichier manque, un placeholder
élégant s'affiche au bon ratio (`<SafeImage>`). Point d'intégration du média
hero : le bloc **HERO SLOT** dans `src/components/Hero.tsx`.

## Contenu

- Les 4 logements : `src/lib/appartements.ts`.
- **Règle d'or — ne rien inventer** : Paramé est complet ; Guadeloupe partiel ;
  les deux « Les Remparts » sont des placeholders (`[CONTENU À FOURNIR]`).
- L'assistant ne répond qu'à partir de ces données
  (`src/lib/assistant-knowledge.ts`) et invite à contacter l'hôte s'il ne sait pas.
- Adresse de contact de démo dans `src/lib/site.ts` (à remplacer).

## Internationalisation

Textes d'interface dans `messages/fr.json` et `messages/en.json`
(structure de clés identique). Le sélecteur de langue conserve la page courante.

## Déploiement

Optimisé pour **Vercel** : importer le dépôt, définir `ANTHROPIC_API_KEY` et
`NEXT_PUBLIC_SITE_URL`, déployer. `robots.txt` et `sitemap.xml` sont générés
(route handlers — le chemin du projet contient une apostrophe, incompatible avec
la convention metadata `robots.ts`/`sitemap.ts`).

## Notes démo

- Pas de Sanity ni d'analytics tiers ; `@vercel/analytics` est branché (trivial).
- Pas de channel manager : « Réserver en direct » ouvre un e‑mail pré-rempli.
- Favicon (`favicon.svg`) et Open Graph (`og.png`) servis depuis `public/`.
