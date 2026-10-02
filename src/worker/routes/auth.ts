import { Hono } from "hono";
import { isLanguage, isTimeZone } from "../../core/languages";
import { safeEqual, randomId, sha256 } from "../auth/crypto";
import { hashPassword, isAcceptablePassword, verifyPassword } from "../auth/password";
import { currentDevice, endSession, startSession } from "../auth/session";
import { clearFailures, clientIp, recordFailure, retryAfter } from "../auth/throttle";
import { schema } from "../db";
import type { AppEnv } from "../types";
import { seedBuiltInTypes } from "./entry-types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Setup, sign-in and sign-out: the routes that work without a session. */
export const authRoutes = new Hono<AppEnv>();

authRoutes.get("/status", async (c) => {
  const db = c.get("db");
  const [family] = await db.select().from(schema.family).limit(1);
  const device = family ? await currentDevice(c, db, c.get("now")) : null;
  return c.json({
    familyExists: Boolean(family),
    signedIn: Boolean(device),
    family:
      family && device
        ? {
            name: family.name,
            language: family.language,
            timeZone: family.timeZone,
            holidayPlaces: family.holidayPlaces,
          }
        : null,
    device: device ? { id: device.id, name: device.name, language: device.language } : null,
  });
});

authRoutes.post("/setup", async (c) => {
  const db = c.get("db");
  const now = c.get("now");
  const ip = clientIp(c);
  const [existing] = await db.select({ id: schema.family.id }).from(schema.family).limit(1);
  if (existing) return c.json({ error: "setup_locked" }, 409);

  const wait = await retryAfter(db, ip, now);
  if (wait > 0) return c.json({ error: "too_many_attempts", retryAfter: wait }, 429);

  const body = await c.req.json().catch(() => ({}));
  if (!c.env.SETUP_CODE || !safeEqual(String(body.setupCode ?? ""), c.env.SETUP_CODE)) {
    await recordFailure(db, ip, now);
    return c.json({ error: "wrong_setup_code" }, 401);
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const recoveryEmail = typeof body.recoveryEmail === "string" ? body.recoveryEmail.trim() : "";
  if (!name) return c.json({ error: "invalid", field: "name" }, 400);
  if (!isAcceptablePassword(body.password))
    return c.json({ error: "invalid", field: "password" }, 400);
  if (!EMAIL.test(recoveryEmail)) return c.json({ error: "invalid", field: "recoveryEmail" }, 400);
  if (!isLanguage(body.language)) return c.json({ error: "invalid", field: "language" }, 400);
  if (!isTimeZone(body.timeZone)) return c.json({ error: "invalid", field: "timeZone" }, 400);

  await db.batch([
    db.insert(schema.family).values({
      id: randomId(),
      name,
      language: body.language,
      timeZone: body.timeZone,
      passwordHash: await hashPassword(body.password),
      recoveryEmail,
      setupCodeHash: await sha256(c.env.SETUP_CODE),
      createdAt: now.toISOString(),
      changedAt: now.toISOString(),
    }),
    ...seedBuiltInTypes(db, now.toISOString()),
  ]);
  await clearFailures(db, ip);
  await startSession(c, db, now);
  return c.json({ ok: true }, 201);
});

authRoutes.post("/session", async (c) => {
  const db = c.get("db");
  const now = c.get("now");
  const ip = clientIp(c);
  const [family] = await db.select().from(schema.family).limit(1);
  if (!family) return c.json({ error: "no_family" }, 409);

  const wait = await retryAfter(db, ip, now);
  if (wait > 0) return c.json({ error: "too_many_attempts", retryAfter: wait }, 429);

  const body = await c.req.json().catch(() => ({}));
  if (!(await verifyPassword(String(body.password ?? ""), family.passwordHash))) {
    await recordFailure(db, ip, now);
    return c.json({ error: "wrong_password" }, 401);
  }
  await clearFailures(db, ip);
  await startSession(c, db, now);
  return c.json({ ok: true }, 201);
});

authRoutes.delete("/session", async (c) => {
  const db = c.get("db");
  const device = await currentDevice(c, db, c.get("now"));
  if (device) await endSession(c, db, device.id);
  return c.body(null, 204);
});
