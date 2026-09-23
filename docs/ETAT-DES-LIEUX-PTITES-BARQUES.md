# État des lieux — La P'tite Barque (branche `petites-barques`)

Date : 27 août 2026. Branche restaurée depuis le commit `89a11c5` (3 juillet 2026,
« content: 4 logements complets (6 avis defilables, superficies, adresses, infos),
correction adresse Guadeloupe, equipements Remparts Plage, assistant enrichi »),
dernier commit avant la transformation en « Granit & Corail » (`57a96a0`, 26 juillet).
`main`/`master` (Granit & Corail, en prod) n'a pas été touché. Aucune amélioration,
aucun refacto : restauration + inventaire uniquement.

Build vérifié sur la branche : `npm install` OK, `tsc --noEmit` 0 erreur,
`next build` OK (18 pages statiques + `/api/chat` dynamique). Aucune correction
de build n'a été nécessaire.

---

## 1. Ce qui existe

### Pages (Next.js 15 App Router, `src/app/[locale]/`)

| Route | Contenu |
| --- | --- |
| `/` (et `/en`) | Accueil |
| `/appartements/parame` | Paramé (tiny house) |
| `/appartements/les-remparts-mer` | Les Remparts Mer (Intra-Muros) |
| `/appartements/les-remparts-plage` | Les Remparts Plage (Intra-Muros) |
| `/appartements/guadeloupe` | Guadeloupe (Deshaies) |
| `/mentions-legales` | Mentions légales (placeholders, voir §3) |
| `/robots.txt`, `/sitemap.xml` | Générés (route handlers) |
| 404 | Page not-found dédiée |

### Sections — accueil (`src/app/[locale]/page.tsx`)

1. **Hero soudé** (`HeroWeld`) : 2 séquences scroll-scrub enchaînées avec crossfade
   (A : Saint-Malo, 118 frames → B : plage de Guadeloupe, 118 frames), titre
   « La P'tite Barque », sous-titres « De Saint-Malo » / « À la Guadeloupe ».
2. **Globe 3D** (`GlobeSelector`, three.js) : 2 destinations cliquables (Saint-Malo,
   Guadeloupe) avec vignettes photos ; texte « De Saint-Malo à la Guadeloupe ».
3. **Hôtesse** : photo ronde de Gwenaëlle (`/images/accueil/gwenaelle.jpg`) + texte
   de présentation (« Ni Français, ni Breton, Malouin suis ! »), langues FR/EN.
4. **Les 4 logements** : cartes photo/nom/localité/note (`ApartmentCard`) en quinconce.
5. **Assistant IA en avant** (`AssistantCTA`) : bande anthracite, barre de saisie +
   suggestions, déclenche le widget de chat.

### Sections — pages logement (template unifié, `appartements/[slug]/page.tsx`)

HERO 1 → DESCRIPTION → ÉQUIPEMENTS → HERO 2 → ALENTOURS → GALERIE 3D → RÉSERVATION → AVIS

- **Hero 1 / Hero 2** : scroll-scrub sur **Les Remparts Mer uniquement**
  (clips `rempart-mer` 89 frames + `parame` 89 frames, avec vidéo de repli mp4).
  Les 3 autres logements : hero image Ken Burns (photo principale) + bande image
  (1re photo de la galerie).
- **Description** : texte du logement, capacité, faits clés (surface, chambres…).
- **Équipements** : accordéon par catégories (données réelles, cf. §2).
- **Alentours / itinéraires** : adresse réelle du logement + 5 points d'intérêt en
  boutons (Gare, Intra-Muros, Le Sillon, Bon Secours, Solidor pour Saint-Malo ;
  points propres pour la Guadeloupe) ; itinéraire piéton intégré via Google Maps
  Embed API (clé `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY`, repli carte simple sans clé)
  + lien « ouvrir dans Google Maps ».
- **Galerie 3D** (`Gallery3D`, carrousel drag-only + lightbox).
- **Bloc réservation** (`BookingBlock`) : **MAQUETTE VISUELLE NON FONCTIONNELLE** —
  calendrier statique « Juillet 2026 » en dur, dates factices 10→13 juil., prix
  factice **128 €/nuit**, ménage 45 €, total 429 €, bouton « Réserver en direct »
  qui est un `<span>` (aucun handler, aucune disponibilité réelle). Commentaire dans
  le fichier : « brancher Smoobu ici plus tard ».
- **Avis** façon récap Airbnb : note globale, badge, 6 avis défilables par logement.

### Éléments transverses

- **Header** : navigation, sélecteur de langue, bouton **« Réserver »** → **modal
  `BookingModal`** « Choisissez votre logement » (4 cartes photo/note/localité, pas de
  prix) → navigation vers la page du logement. Pas de réservation réelle.
- **Footer** : liens logements, « Son histoire », contact e-mail
  (`contact@laptitebarque.com` — **adresse de démo**, à remplacer), bouton Instagram
  (lien réel `instagram.com/lesptitesbarques`), mentions légales, crédit
  « Site démo — La P'tite Barque ».
- **i18n FR/EN** (next-intl v4) : FR sans préfixe, EN sous `/en`, textes d'interface
  dans `messages/fr.json` / `messages/en.json`. Les avis restent en langue d'origine.
- **Assistant IA** (`ChatWidget` flottant + section accueil) : Claude Haiku
  (`claude-haiku-4-5-20251001`) via `src/app/api/chat/route.ts`, streaming, prompt
  système maison, base de connaissance dérivée de `lib/appartements.ts`
  (anti-hallucination prix/dispo : renvoie vers l'hôte). Sans `ANTHROPIC_API_KEY`
  → message de repli courtois, widget désactivé.
- **Smooth scroll** Lenis, animations GSAP, `@vercel/analytics` branché.
- **SEO** : metadata, hreflang FR/EN, Open Graph (`/og.png`), sitemap, robots.
  URL canonique par défaut `https://laptitebarque.com` (via `NEXT_PUBLIC_SITE_URL`).

---

## 2. Contenus : réel vs placeholder

### Textes

- **Descriptions, capacités, faits clés, équipements** des 4 logements :
  **réels** (repris des annonces Airbnb), dans `src/lib/appartements.ts`.
  Les 4 logements sont en `status: "complete"`.
- **Adresses réelles** :
  - Paramé : 25 Rue Herbert Clos Neuf, Paramé, 35400 Saint-Malo
  - Remparts Mer & Remparts Plage : 3 Place aux Herbes, Intra-Muros, 35400 Saint-Malo
  - Guadeloupe : 25 Boulevard Vwè Moune, 97126 Deshaies
- **Capacités** : Paramé 3 voy. / 1 ch. / 2 lits ; Guadeloupe 2 voy. / studio ;
  Remparts Plage 3 voy. / 1 ch. / 2 lits ; Remparts Mer 2 voy. / 1 ch. / 1 lit.
- **Textes hôtesse / histoire** (accueil) : rédigés pour la démo à partir des infos
  de Gwenaëlle — à valider par la cliente.
- Placeholder résiduel : « note hôte : [CONTENU À FOURNIR] » en commentaire côté
  Guadeloupe (non affiché).

### Photos (`public/images/`, fournies par la cliente en juillet 2026)

| Dossier | Fichiers | Utilisation | Statut |
| --- | --- | --- | --- |
| `parame/` | 19 | galerie 19 photos | réel, complet |
| `remparts-mer/` | 19 | galerie 19 photos | réel, complet |
| `remparts-plage/` | 18 | galerie 18 photos | réel, complet |
| `guadeloupe/` | 3 | galerie 3 photos, `gallerySlots: 6` → **3 emplacements vides** (placeholder élégant) | **incomplet** |
| `accueil/` | 5 | 4 photos principales (cartes, globe, modal, heros) + photo Gwenaëlle | réel |
| `marque/` | 1 | `logo.jpg` | réel |

- Heros scrub (`public/heroes/`, 123 Mo, frames WebP desktop 2560 + mobile 720) :
  `accueil-a`, `accueil-b`, `parame`, `rempart-mer` — extraits des **vidéos réelles**
  de la cliente (`public/videos/`, 49 Mo : clipA, clipB, parame-hero, rempart-mer).
- Anomalie mineure : un fichier `lesptitesbarquesremparts-13.JPG` traîne dans
  `public/videos/` (non référencé).

### Avis

- **Vrais avis Airbnb/Booking, prénoms réels**, 6 par logement (24 au total), avec
  pays d'origine. Notes/nombre d'avis = Airbnb au moment de la saisie :
  Paramé **4,99** (135 avis), Remparts Mer **4,97** (64), Remparts Plage **4,93**
  (74), Guadeloupe **4,87** (38). Badges « Coup de cœur voyageurs · Top 5 % Airbnb ».

### Tarifs affichés

- **Aucun tarif réel.** Le seul prix visible est le **128 €/nuit factice** du bloc
  réservation maquette (identique sur les 4 pages). La modal « Réserver » n'affiche
  pas de prix. L'assistant refuse de donner des prix.

### Mentions légales / contact

- `/mentions-legales` : **placeholders** `[NOM / RAISON SOCIALE]`, `[ADRESSE]`,
  `[SIRET]`, `[EMAIL DE CONTACT]`, `[NOM]` (directeur de publication) + bandeau
  « site de démonstration ». Hébergeur (Vercel), RGPD et cookies rédigés.
- E-mail de contact `contact@laptitebarque.com` : **démo** (`src/lib/site.ts`).
- Lien Instagram : réel.

---

## 3. Ce qui manque objectivement pour livrer

1. **Module de réservation fonctionnel** — l'actuel est une maquette statique.
   Périmètre prévu : **Smoobu** (disponibilités + réservation) + **empreinte de
   caution sans débit** + **contrat auto-signé** + **fiche de police**.
   Rien de tout cela n'est commencé.
2. **Nom de domaine** — aucun domaine ; `laptitebarque.com` n'est qu'une valeur par
   défaut dans le code.
3. **Autorisations écrites d'utilisation des contenus** — photos, vidéos, textes
   d'annonces, avis (prénoms réels) : aucune autorisation formelle archivée.
4. **Mentions légales réelles** — éditeur, adresse, SIRET, directeur de publication,
   e-mail de contact réel.
5. **Déploiement production** — pas de projet Vercel de production pour ce site
   (seule une preview privée est prévue pour le RDV), pas de `NEXT_PUBLIC_SITE_URL`
   définitif, clés `ANTHROPIC_API_KEY` / `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` à poser.
6. Photos Guadeloupe manquantes (3/6) ; tarifs réels ; e-mail de contact réel.

---

## 4. Décisions qui dépendent du RDV

- **Nombre de biens** : 1, 2 ou les 4 ? (le site en présente 4 ; 2 partagent la même
  adresse Intra-Muros).
- **Nom de domaine** (laptitebarque.com ? lesptitesbarques.fr ? autre — le compte
  Instagram est `lesptitesbarques`).
- **Textes** : fournis par la cliente ou interview + rédaction ?
- **Photos définitives** (Guadeloupe notamment) et vidéos.
- **Périmètre exact réservation / caution** : Smoobu seul ? empreinte de caution ?
  contrat auto-signé ? fiche de police ? paiement en direct ?
- **Tarifs à afficher** (ou renvoi vers le module de résa uniquement).
- Validation des avis publiés avec prénoms réels.

---

## 5. Écarts avec les standards actuels (à noter, NE PAS corriger sur cette branche)

- Heros scroll-scrub (`ScrollHero`) : **pas de crossfade inter-frames** ni de **gate
  de préchargement strict** (seule une barre de progression `loadedCount` existe) →
  premier chargement plus lourd / moins lisse que sur Granit & Corail. Le hero
  d'accueil (`HeroWeld`) a bien un crossfade, mais uniquement entre les clips A et B.
- Pas de chargement progressif 720 → HD ni de préchargement inter-pages.
- **Globe** : pas de fallback mobile spécifique (seulement `prefers-reduced-motion`
  et `touch-action: pan-y` sur pointeur tactile) — pas de sélecteur de repli tactile.
- **Pas d'audit responsive multi-largeurs récent** (les audits mobile de fin juillet
  ont été faits sur Granit & Corail uniquement).
- **Cache `/public` non immutable** : `next.config.ts` ne définit aucun header
  `Cache-Control` (frames WebP et images servies avec les défauts Vercel).
- **QA SOP v2.2 non passée.**
- Bandeau/tarifs « -10 % vs plateformes » et parcours de réservation fictif complet
  (extras, récap) n'existent pas sur cette branche (ajoutés après, côté G&C).
- Dépendances : 5 vulnérabilités `npm audit` (1 modérée, 4 hautes) non traitées.

---

## 6. Déploiement preview (rappel)

Projet Vercel séparé `petites-barques-preview` sur le même dépôt, branche de
production `petites-barques`, env vars `ANTHROPIC_API_KEY` et
`NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY`.

Indexation : Vercel sert tous les déploiements **preview** (non-production) avec
`X-Robots-Tag: noindex` — ils ne sont pas indexés. Attention : un déploiement de
**production** (même sur `*.vercel.app`) n'a PAS ce header ; si la branche
`petites-barques` est définie comme branche de production, activer la
**Deployment Protection** (Vercel Authentication ou mot de passe, plan Pro) pour
garder l'URL privée, ou partager l'URL de preview de branche
(`petites-barques-preview-git-petites-barques-*.vercel.app`).
