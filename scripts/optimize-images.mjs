/* ============================================================
   Mise au format web des photos de public/images/.

     node scripts/optimize-images.mjs

   RÈGLE : seules les photos JPEG dont le côté long dépasse 2560 px sont
   retouchées (côté long ramené à 2400 px, JPEG q85 progressif). Les
   versions web du photographe (*-pro/, 2560 px q82) sont donc laissées
   telles quelles : les ré-encoder dégraderait l'image pour un gain nul.

   IDEMPOTENT : une image déjà ≤ 2560 px n'est jamais réécrite ; relancer
   le script après coup ne change aucun fichier.

   Les logos, SVG et PNG (logo/, marque/) ne sont pas concernés.
   ============================================================ */

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const ROOT = path.resolve("public/images");
const SKIP_DIRS = new Set(["logo", "marque"]);
const THRESHOLD = 2560;
const TARGET = 2400;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(p);
    } else if (/\.jpe?g$/i.test(entry.name)) {
      yield p;
    }
  }
}

let touched = 0;
let seen = 0;
for await (const file of walk(ROOT)) {
  seen++;
  const input = await readFile(file);
  const { width = 0, height = 0 } = await sharp(input).metadata();
  if (Math.max(width, height) <= THRESHOLD) continue;

  const output = await sharp(input)
    .rotate() // applique l'orientation EXIF avant de la retirer
    .resize({ width: TARGET, height: TARGET, fit: "inside" })
    .jpeg({ quality: 85, progressive: true, mozjpeg: true })
    .toBuffer();
  await writeFile(file, output);
  touched++;
  console.log(
    `${path.relative(ROOT, file)} : ${width}×${height}, ` +
      `${(input.length / 1e6).toFixed(1)} Mo → ${(output.length / 1e6).toFixed(1)} Mo`,
  );
}
console.log(`${touched} image(s) redimensionnée(s) sur ${seen}.`);
