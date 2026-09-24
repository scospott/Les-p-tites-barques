/* ============================================================
   Images Open Graph des logements — 1200 × 630, JPEG q82.

     npx tsx scripts/generate-og-images.ts

   SOURCE : la photo vitrine de chaque logement (`mainImage` dans
   src/lib/appartements.ts) et la photo du héros de chaque page
   destination (`heroImage` dans src/lib/destination-pages.ts), recadrées
   en « cover » sur la zone la plus riche de l'image (stratégie
   `attention` de sharp).
   SORTIE : public/og/<nom descriptif>.jpg (src/lib/og-images.ts pour les
   logements, `ogImage` pour les destinations), COMMITÉES (servies telles
   quelles par les balises og:image, voir `ogImageFor` dans src/lib/seo.ts).
   À relancer après tout changement de photo vitrine ou de héros.
   ============================================================ */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { apartments } from "../src/lib/appartements";
import { destinationPageList } from "../src/lib/destination-pages";
import { OG_FILES } from "../src/lib/og-images";

const OUT = path.resolve("public/og");

await mkdir(OUT, { recursive: true });
const jobs = [
  ...apartments.map((a) => ({ from: a.mainImage, to: OG_FILES[a.slug] ?? `${a.slug}.jpg` })),
  ...destinationPageList.map((d) => ({ from: d.heroImage, to: path.basename(d.ogImage) })),
];

for (const { from, to } of jobs) {
  const src = path.resolve("public", from.replace(/^\//, ""));
  const out = path.join(OUT, to);
  const buffer = await sharp(src)
    .rotate()
    .resize(1200, 630, { fit: "cover", position: sharp.strategy.attention })
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
    .toBuffer();
  await writeFile(out, buffer);
  console.log(`${path.relative(process.cwd(), out)} ← ${from} (${Math.round(buffer.length / 1024)} Ko)`);
}
