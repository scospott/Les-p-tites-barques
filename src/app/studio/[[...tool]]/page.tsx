import Studio from "./Studio";

/* La page qui MONTE le Studio est une coquille statique : c'est le Studio
   lui-même, dans le navigateur, qui parle à l'API Sanity. */
export const dynamic = "force-static";

export default function StudioPage() {
  return <Studio />;
}
