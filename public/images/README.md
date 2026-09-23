# Photos — organisation des dossiers

Les galeries sont **déclarées explicitement** dans `src/lib/appartements.ts`
(champ `gallery: string[]`, un chemin par photo, dans l'ordre d'affichage).
Pour ajouter/retirer/réordonner une photo de galerie : déposer le fichier ici
puis mettre à jour la liste correspondante.

Tant qu'un fichier référencé n'existe pas, le site affiche un placeholder
élégant (composant `<SafeImage>` / carte placeholder du carrousel 3D).

## Dossiers

| Dossier            | Usage                                                        |
| ------------------ | ------------------------------------------------------------ |
| `accueil/`         | Photos principales (`principale-*.jpg`) + `gwenaelle.jpg` + `barques-vue-aerienne.jpg` |
| `marque/`          | Identité (`logo.jpg`)                                         |
| `parame-pro/`      | Photos PRO Paramé (`photo-01…24.jpg`) — galerie, vitrine, héros |
| `remparts-mer-pro/`| Photos PRO Les Remparts Mer (`photo-01…20.jpg`)               |
| `remparts-plage-pro/` | Photos PRO Les Remparts Plage (`photo-01…20.jpg`)          |
| `guadeloupe/`      | Galerie Guadeloupe (incomplète — 3 photos)                    |

## Photos pro (`*-pro/`)

Versions WEB des originaux du photographe (8192 px, 12–35 Mo chacun, conservés
hors dépôt dans « Granit et corail/public/images/*-pro ») : côté long 2560 px,
JPEG qualité 82 progressif (~400–900 Ko). `<SafeImage>` sert les fichiers tels
quels (pas d'optimisation next/image) : ne jamais déposer les originaux ici.
Ordre de galerie = ordre des numéros. Vitrines et héros : `mainImage`,
`hero1Image`, `hero2Image` dans `src/lib/appartements.ts`.

## Photos principales (`accueil/`)

- `principale-mer.jpg` — Les Remparts Mer
- `principale-plage.jpg` — Les Remparts Plage
- `principale-parame.jpg` — Paramé
- `principale-antilles.jpg` — Guadeloupe

Utilisées partout où le logement est représenté : cartes de l'accueil, vignettes
des pins du globe, cartes de la modal « Réserver », hero des pages logement.

## Conventions

- Extensions en `.jpg` **minuscule**, pas d'espaces ni de parenthèses dans les noms.
- **Galerie** : ratio portrait ~3/4 conseillé (cartes du carrousel en 1.5/2).
- **Principales / heros** : paysage généreux (ex. 1920×1080 ou plus).

> Astuce : privilégiez des images lumineuses, beaucoup d'air, lumière côtière —
> dans l'esprit « marque hôtelière premium », jamais nautique kitsch.

## Originaux hors dépôt

Les originaux 8k (`lesptitesbarques*-N.jpg`) sont conservés hors dépôt dans
`~/Documents/ScottLab/Assets/petites-barques/photos-originales/<slug>/`.
`node scripts/optimize-images.mjs` ramène à 2400 px (JPEG q85 progressif) toute
photo de plus de 2560 px déposée ici ; les versions `-pro` ne sont pas retouchées.
