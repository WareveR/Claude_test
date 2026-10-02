import { Hono } from "hono";
import { isHolidayPlaces } from "../../core/holidays";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

export const familyRoutes = new Hono<AppEnv>().use(requireDevice);

/** The Family-wide places whose Public Holidays show; the browser calculates the days. */
familyRoutes.put("/family/holidays", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!isHolidayPlaces(body.places)) return c.json({ error: "invalid", field: "places" }, 400);
  const now = c.get("now").toISOString();
  await c.get("db").update(schema.family).set({ holidayPlaces: body.places, changedAt: now });
  return c.json({ holidayPlaces: body.places });
});
