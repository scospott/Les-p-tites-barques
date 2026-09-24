/* ============================================================
   Noms des images Open Graph des logements (public/og/) — DESCRIPTIFS
   (SEO image) plutôt que le slug. Source unique : lue par `ogImageFor`
   (src/lib/seo.ts) et par scripts/generate-og-images.ts, qui les produit.
   Les images des pages destination sont déclarées dans
   src/lib/destination-config.ts (`ogImage`).
   ============================================================ */

export const OG_FILES: Record<string, string> = {
  "les-remparts-mer": "remparts-mer-appartement-saint-malo-intra-muros.jpg",
  "les-remparts-plage": "remparts-plage-appartement-saint-malo-bon-secours.jpg",
  parame: "parame-tiny-house-terrasse-saint-malo.jpg",
  "l-antillaise": "studio-vue-mer-deshaies-guadeloupe.jpg",
};
