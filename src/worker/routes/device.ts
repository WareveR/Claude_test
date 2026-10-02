import { Hono } from "hono";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

/** The Signed-in Device's own record. */
export const deviceRoutes = new Hono<AppEnv>().use(requireDevice);

deviceRoutes.get("/device", (c) => {
  const { id, name, language } = c.get("device");
  return c.json({ id, name, language });
});
