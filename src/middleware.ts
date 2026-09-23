import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip Next internals, the API routes, the embedded Sanity Studio and any
  // path containing a dot (static files). `/studio` must NOT be locale-
  // prefixed: the Studio is a single French app served outside [locale].
  matcher: ["/((?!api|studio|_next|_vercel|.*\\..*).*)"],
};
