import { createMiddleware } from "hono/factory";
import { currentDevice } from "./auth/session";
import type { AppEnv } from "./types";

/** Rejects requests without a valid session and makes the Signed-in Device available. */
export const requireDevice = createMiddleware<AppEnv>(async (c, next) => {
  const device = await currentDevice(c, c.get("db"), c.get("now"));
  if (!device) return c.json({ error: "signed_out" }, 401);
  c.set("device", device);
  await next();
});
