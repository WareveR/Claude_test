import { createMiddleware } from "hono/factory";
import { secureHeaders } from "hono/secure-headers";
import type { AppEnv } from "./types";

/**
 * The Content-Security-Policy of every response, Worker and static files alike.
 * `public/_headers` must carry this same string; security.test.ts checks that it does.
 */
export const CONTENT_SECURITY_POLICY =
  "default-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

const otherSecureHeaders = secureHeaders({
  strictTransportSecurity: "max-age=31536000; includeSubDomains",
  referrerPolicy: "no-referrer",
  xFrameOptions: "DENY",
});

/** The same headers `public/_headers` sets on the app's static files. */
export const apiSecureHeaders = createMiddleware<AppEnv>(async (c, next) => {
  await otherSecureHeaders(c, next);
  c.res.headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
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
