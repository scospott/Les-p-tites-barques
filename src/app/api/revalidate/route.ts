import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { parseBody } from "next-sanity/webhook";

import type { SanityTag } from "@/sanity/fetch";

/* ============================================================
   POST /api/revalidate — webhook Sanity : chaque publication invalide le
   cache des pages qui lisent ce type de document (étiquettes posées par
   `sanityFetch`, cf. src/sanity/fetch.ts).

   Webhook à créer (sanity.io/manage → projet → API → Webhooks) :
     URL        https://<domaine>/api/revalidate
     Dataset    production
     Trigger on Create, Update, Delete
     Filter     _type in ["logement","avis","lieu","destination","site","assistante"]
     Projection {_type}
     Secret     = SANITY_REVALIDATE_SECRET (variable d'env Vercel)
   La signature est vérifiée : sans le secret, la requête est refusée.
   ============================================================ */

const TAGS = new Set<SanityTag>(["logement", "avis", "lieu", "destination", "site", "assistante"]);

export async function POST(req: NextRequest) {
  const secret = process.env.SANITY_REVALIDATE_SECRET;
  if (!secret) {
    return Response.json({ message: "SANITY_REVALIDATE_SECRET manquant" }, { status: 500 });
  }
  try {
    const { isValidSignature, body } = await parseBody<{ _type?: string }>(req, secret, true);
    if (!isValidSignature) {
      return Response.json({ message: "Signature invalide" }, { status: 401 });
    }
    const type = body?._type as SanityTag | undefined;
    if (!type || !TAGS.has(type)) {
      return Response.json({ message: `Type ignoré : ${type ?? "(aucun)"}` }, { status: 400 });
    }
    revalidateTag(type);
    return Response.json({ revalidated: [type], now: Date.now() });
  } catch (error) {
    return Response.json({ message: (error as Error).message }, { status: 500 });
  }
}
