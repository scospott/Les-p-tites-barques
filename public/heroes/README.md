# Heroes scroll-scrub — séquences d'images

Le composant `<ScrollHero>` fait défiler une séquence d'images au scroll (la
section reste épinglée, puis se dépingle). Les images sont extraites d'un clip
court avec **ffmpeg**.

Les clips sources ne sont **pas** dans le dépôt (des .mp4 4K de 20 à 50 Mo).
Ils vivent dans `~/Documents/ScottLab/Assets/petites-barques/videos/<logement>/`.
Seules les frames WebP sont versionnées.

## Séquences en place

| Clé (`heroSequences`) | Dossier                        | Frames | Desktop | Mobile | Qualité |
| --------------------- | ------------------------------ | -----: | ------: | -----: | ------- |
| `accueil-a`           | `accueil-a` + `-mobile`        |    118 |    32 M |  5,8 M | —       |
| `accueil-b`           | `accueil-b` + `-mobile`        |    118 |    19 M |  3,8 M | —       |
| `remparts-mer-1`      | `remparts-mer/hero1` + `-mobile` |   97 |    18 M |  8,8 M | 82 / 86 |
| `remparts-mer-2`      | `remparts-mer/hero2` + `-mobile` |   97 |    17 M |  7,8 M | 82 / 86 |
| `remparts-plage-1`    | `remparts-plage/hero1` + `-mobile` | 97 |    24 M |  9,3 M | 82 / 86 |
| `remparts-plage-2`    | `remparts-plage/hero2` + `-mobile` | 97 |    19 M |  8,3 M | 82 / 86 |
| `parame-1`            | `parame/hero1` + `-mobile`     |     97 |    33 M |   14 M | 82 / 86 |

Total `public/heroes` : **216 Mo**, 1442 frames.

Deux séquences dépassent la cible de 20 Mo par jeu desktop, à qualité 82 (le
plancher retenu — en dessous, les aplats de ciel se postérisent) :

- `remparts-plage-1` (24 Mo) : scène dense (feuillage + gravier).
- `parame-1` (33 Mo) : le clip source est **carré** (2880×2880), donc les
  frames desktop font 1920×**1920** au lieu de 1920×1440 — 33 % de pixels en
  plus que les autres. Recadrer le clip en 16:9 avant extraction diviserait ce
  poids par ~1,4 (à arbitrer avec la cliente sur le cadrage).

## Extraction (standard)

Clips Seedance : 4,04 s, 24 fps, 97 frames.

```bash
CLIP=~/Documents/ScottLab/Assets/petites-barques/videos/remparts-mer/hero1.mp4
OUT=public/heroes/remparts-mer/hero1

# Desktop — 1920 de large
ffmpeg -i "$CLIP" \
  -vf "fps=24,scale=1920:-2:flags=lanczos,unsharp=5:5:0.6:5:5:0.0" \
  -c:v libwebp -quality 82 -compression_level 6 -f image2 \
  "$OUT/frame-%04d.webp"

# Mobile — 9:16 recadré au centre, 720 de large
ffmpeg -i "$CLIP" \
  -vf "fps=24,crop=ih*9/16:ih,scale=720:-2:flags=lanczos,unsharp=5:5:0.6:5:5:0.0" \
  -c:v libwebp -quality 86 -compression_level 6 -f image2 \
  "$OUT-mobile/frame-%04d.webp"
```

- `-c:v libwebp … -f image2` force des **fichiers séparés** (sinon ffmpeg crée
  un seul WebP animé à cause de l'extension `.webp`).
- **Le mobile garde le même `fps` que le desktop.** Le chargeur
  (`src/lib/hero-frames.ts`) demande le jeu 720 aux *mêmes indices* que le jeu
  pleine résolution : un jeu mobile deux fois moins dense ferait 404 sur la
  moitié de l'échelle et le gate basculerait en repli. Desktop et mobile ont
  donc toujours exactement le même nombre de frames.
- Comptez le nombre **réel** de frames générées
  (`ls <dossier>/frame-*.webp | wc -l`) et reportez-le dans
  `src/lib/heroSequences.ts` (`frameCount`).
- Cible : **≤ 20 Mo par jeu desktop**. Au-delà, ré-extraire à `-quality 82`,
  pas en dessous.

## Convention

| Élément        | Valeur                                             |
| -------------- | -------------------------------------------------- |
| Dossier        | `public/heroes/<logement>/<hero>/`                 |
| Variante 720   | même chemin suffixé `-mobile`                      |
| Frames         | `frame-0001.webp`, `frame-0002.webp`, … (4 chiffres) |
| Poster / base  | `frame-0001.webp`                                  |
| Clip source    | hors dépôt (`Assets/petites-barques/videos/`)      |

Le padding sur 4 chiffres est imposé par `framePath()`
(`src/lib/frame-loader.ts`). Le poster **doit** être la frame 1 : `<ScrollHero>`
réinjecte alors l'image déjà décodée dans le buffer plutôt que de la
retélécharger.

Les frames sont servies en `Cache-Control: public, max-age=31536000, immutable`
(règle `/heroes/:path*` dans `next.config.ts`, qui couvre les sous-dossiers).
Elles sont donc **immuables** : une ré-extraction doit changer le nom du
dossier, ou les visiteurs garderont les anciennes frames un an.

## Ajouter un héros

1. Déposez le clip dans `Assets/petites-barques/videos/<logement>/<hero>.mp4`.
2. Extrayez les deux jeux (commandes ci-dessus).
3. Ajoutez une entrée dans `src/lib/heroSequences.ts` avec le `frameCount` réel.
4. Référencez sa clé dans `scrubHeroes: [héros 1, héros 2]` du logement, dans
   `src/lib/appartements.ts`. `<ScrollHero>` remplace alors le héros Ken Burns,
   et le préchargement inter-pages (`hero-prefetch.ts`) prend la séquence en
   compte automatiquement.
