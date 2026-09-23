/* ============================================================
   Posters allégés des héros scroll-scrub.

     node scripts/generate-posters.mjs

   Le poster est l'image LCP d'un héros : il tient le cadre jusqu'à
   l'ouverture du scrub. On le servait tel quel depuis frame-0001 de la
   séquence (WebP q82-86, jusqu'à ~180 Ko en mobile). Ce script en tire un
   `poster.webp` dédié, mêmes dimensions, dans le dossier de la séquence :

   - séquences MOBILE (`*-mobile`) : WebP q72, toujours ; si le résultat
     dépasse 80 Ko, la qualité descend par pas de 4 (plancher q48) ;
   - séquences DESKTOP : WebP q78, SEULEMENT si le gain dépasse 100 Ko
     (sinon le poster reste frame-0001 : un fichier de plus pour rien).

   La séquence de scrub elle-même n'est pas touchée. Les chemins retenus
   sont à reporter dans src/lib/heroSequences.ts (`poster`, `posterMobile`) ;
   le script les affiche à la fin.
   ============================================================ */

import { readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const ROOT = path.resolve("public/heroes");
const MOBILE_QUALITY = 72;
const MOBILE_TARGET = 80 * 1024;
const MOBILE_FLOOR = 48;
const DESKTOP_QUALITY = 78;
const DESKTOP_MIN_GAIN = 100 * 1024;
/** Séquence B de la soudure d'accueil : elle n'affiche jamais de poster. */
const SKIP = new Set(["/heroes/accueil-b", "/heroes/accueil-b-mobile"]);

async function* sequenceDirs(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const p = path.join(dir, entry.name);
    const files = await readdir(p);
    if (files.includes("frame-0001.webp")) yield p;
    else yield* sequenceDirs(p);
  }
}

const kept = [];
for await (const dir of sequenceDirs(ROOT)) {
  const rel = "/" + path.relative(path.resolve("public"), dir);
  if (SKIP.has(rel)) {
    await unlink(path.join(dir, "poster.webp")).catch(() => {});
    continue;
  }
  const mobile = /-mobile$/.test(dir);
  const src = path.join(dir, "frame-0001.webp");
  const out = path.join(dir, "poster.webp");
  const before = (await stat(src)).size;
  let quality = mobile ? MOBILE_QUALITY : DESKTOP_QUALITY;
  let buffer = await sharp(src).webp({ quality, effort: 6 }).toBuffer();
  while (mobile && buffer.length > MOBILE_TARGET && quality > MOBILE_FLOOR) {
    quality -= 4;
    buffer = await sharp(src).webp({ quality, effort: 6 }).toBuffer();
  }
  const gain = before - buffer.length;
  const keep = mobile ? gain > 0 : gain > DESKTOP_MIN_GAIN;
  const line = `${rel.padEnd(34)} ${(before / 1024).toFixed(0).padStart(4)} Ko → ${(buffer.length / 1024).toFixed(0).padStart(4)} Ko (q${quality})`;
  if (keep) {
    await writeFile(out, buffer);
    kept.push(`${rel}/poster.webp`);
    console.log(`${line}  ✔ poster.webp`);
  } else {
    await unlink(out).catch(() => {});
    console.log(`${line}  — gain insuffisant, frame-0001 conservée`);
  }
}
console.log(`\nPosters dédiés :\n${kept.map((k) => `  ${k}`).join("\n")}`);
