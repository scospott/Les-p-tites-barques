/* ============================================================
   Images Open Graph des logements — 1200 × 630, JPEG q82.

     npx tsx scripts/generate-og-images.ts

   SOURCE : la photo vitrine de chaque logement (`mainImage` dans
   src/lib/appartements.ts), recadrée en « cover » sur la zone la plus
   riche de l'image (stratégie `attention` de sharp).
   SORTIE : public/og/<slug>.jpg, COMMITÉES (servies telles quelles par les
   balises og:image des fiches, voir `ogImageFor` dans src/lib/seo.ts).
   À relancer après tout changement de photo vitrine.
   ============================================================ */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { apartments } from "../src/lib/appartements";

const OUT = path.resolve("public/og");

await mkdir(OUT, { recursive: true });
for (const a of apartments) {
  const src = path.resolve("public", a.mainImage.replace(/^\//, ""));
  const out = path.join(OUT, `${a.slug}.jpg`);
  const buffer = await sharp(src)
    .rotate()
    .resize(1200, 630, { fit: "cover", position: sharp.strategy.attention })
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
    .toBuffer();
  await writeFile(out, buffer);
  console.log(`${path.relative(process.cwd(), out)} ← ${a.mainImage} (${Math.round(buffer.length / 1024)} Ko)`);
}
