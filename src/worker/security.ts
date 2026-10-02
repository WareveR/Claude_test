import { createMiddleware } from "hono/factory";
import { secureHeaders } from "hono/secure-headers";
import type { AppEnv } from "./types";

/** The same headers `public/_headers` sets on the app's static files. */
export const apiSecureHeaders = secureHeaders({
  contentSecurityPolicy: { defaultSrc: ["'self'"], frameAncestors: ["'none'"] },
  strictTransportSecurity: "max-age=31536000; includeSubDomains",
  referrerPolicy: "no-referrer",
  xFrameOptions: "DENY",
});

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Accepts a state-changing request only when it comes from the app's own origin. */
export const sameOriginOnly = createMiddleware<AppEnv>(async (c, next) => {
  if (!SAFE_METHODS.has(c.req.method)) {
    const origin = c.req.header("Origin");
    if (origin !== new URL(c.req.url).origin) {
      return c.json({ error: "forbidden_origin" }, 403);
    }
  }
  await next();
});
