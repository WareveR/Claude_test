import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie } from "hono/cookie";
import { hashPassword, isAcceptablePassword, verifyPassword } from "../auth/password";
import { SESSION_COOKIE } from "../auth/session";
import { clearFailures, clientIp, recordFailure, retryAfter } from "../auth/throttle";
import { schema } from "../db";
import { sendPasswordNotice } from "./recovery";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

/** The "Signed-in devices" page and the Family Password change. */
export const devicesRoutes = new Hono<AppEnv>().use(requireDevice);

devicesRoutes.get("/devices", async (c) => {
  const current = c.get("device");
  const devices = await c
    .get("db")
    .select()
    .from(schema.signedInDevice)
    .orderBy(schema.signedInDevice.lastUsedAt);
  return c.json(
    devices.reverse().map((d) => ({
      id: d.id,
      name: d.name,
      lastUsedAt: d.lastUsedAt,
      current: d.id === current.id,
    })),
  );
});

devicesRoutes.patch("/devices/:id", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!name) return c.json({ error: "invalid", field: "name" }, 400);
  const updated = await c
    .get("db")
    .update(schema.signedInDevice)
    .set({ name })
    .where(eq(schema.signedInDevice.id, c.req.param("id")))
    .returning({ id: schema.signedInDevice.id });
  if (updated.length === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ id: updated[0].id, name });
});

devicesRoutes.delete("/devices/:id", async (c) => {
  const id = c.req.param("id");
  const deleted = await c
    .get("db")
    .delete(schema.signedInDevice)
    .where(eq(schema.signedInDevice.id, id))
    .returning({ id: schema.signedInDevice.id });
  if (deleted.length === 0) return c.json({ error: "not_found" }, 404);
  if (id === c.get("device").id) {
    deleteCookie(c, SESSION_COOKIE, { path: "/", secure: true, prefix: "host" });
  }
  return c.body(null, 204);
});

/** Changing the Family Password signs out every device, this one included. */
devicesRoutes.post("/password", async (c) => {
  const db = c.get("db");
  const now = c.get("now");
  const ip = clientIp(c);
  const wait = await retryAfter(db, ip, now);
  if (wait > 0) return c.json({ error: "too_many_attempts", retryAfter: wait }, 429);

  const body = await c.req.json().catch(() => ({}));
  const [family] = await db.select().from(schema.family).limit(1);
  if (!(await verifyPassword(String(body.currentPassword ?? ""), family.passwordHash))) {
    await recordFailure(db, ip, now);
    return c.json({ error: "wrong_password" }, 401);
  }
  if (!isAcceptablePassword(body.newPassword)) {
    return c.json({ error: "invalid", field: "newPassword" }, 400);
  }
  await clearFailures(db, ip);
  await db.batch([
    db
      .update(schema.family)
      .set({ passwordHash: await hashPassword(body.newPassword), changedAt: now.toISOString() })
      .where(eq(schema.family.id, family.id)),
    db.delete(schema.signedInDevice),
  ]);
  await sendPasswordNotice(c.env, family);
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: true, prefix: "host" });
  return c.body(null, 204);
});
