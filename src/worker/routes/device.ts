import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { isLanguage } from "../../core/languages";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

/** The Signed-in Device's own record. */
export const deviceRoutes = new Hono<AppEnv>().use(requireDevice);

deviceRoutes.get("/device", (c) => {
  const { id, name, language } = c.get("device");
  return c.json({ id, name, language });
});

/** Changes this device's own settings; for now its language. */
deviceRoutes.patch("/device", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!isLanguage(body.language)) return c.json({ error: "invalid", field: "language" }, 400);
  const device = c.get("device");
  await c
    .get("db")
    .update(schema.signedInDevice)
    .set({ language: body.language })
    .where(eq(schema.signedInDevice.id, device.id));
  return c.json({ id: device.id, name: device.name, language: body.language });
});
