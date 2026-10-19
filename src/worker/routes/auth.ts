import { Hono } from "hono";
import { isLanguage, isTimeZone } from "../../core/languages";
import { eq } from "drizzle-orm";
import { accountByEmail, EMAIL, normalEmail } from "../auth/account";
import { safeEqual, randomId, sha256 } from "../auth/crypto";
import {
  hashPassword,
  isAcceptablePassword,
  NO_ACCOUNT_HASH,
  verifyPassword,
} from "../auth/password";
import { currentDevice, endSession, startSession } from "../auth/session";
import { clearFailures, clientIp, recordFailure, retryAfter } from "../auth/throttle";
import { schema } from "../db";
import type { AppEnv } from "../types";
import { seedBuiltInTypes } from "./entry-types";
import { seedBuiltInTemplates } from "./checklist-templates";
import { setupCodeChanged } from "./recovery";

/** Setup, sign-in and sign-out: the routes that work without a session. */
export const authRoutes = new Hono<AppEnv>();

authRoutes.get("/status", async (c) => {
  const db = c.get("db");
  const [family] = await db.select().from(schema.family).limit(1);
  const device = family ? await currentDevice(c, db, c.get("now")) : null;
  const [account] = device
    ? await db.select().from(schema.account).where(eq(schema.account.id, device.accountId))
    : [];
  return c.json({
    familyExists: Boolean(family),
    newSetupCode: family ? await setupCodeChanged(c.env, family) : false,
    signedIn: Boolean(account),
    family:
      family && account
        ? {
            name: family.name,
            language: family.language,
            timeZone: family.timeZone,
            holidayPlaces: family.holidayPlaces,
            wasteCollection: family.wasteCollection,
            sleepHours: { start: family.sleepStartHour, end: family.sleepEndHour },
            lastExportAt: family.lastExportAt,
          }
        : null,
    account: account
      ? {
          id: account.id,
          email: account.email,
          role: account.role,
          dev: account.dev,
          personId: account.personId,
        }
      : null,
    device:
      device && account
        ? {
            id: device.id,
            name: device.name,
            language: device.language,
            kind: device.kind,
            model: device.model,
          }
        : null,
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
  const email = normalEmail(body.email);
  if (!name) return c.json({ error: "invalid", field: "name" }, 400);
  if (!EMAIL.test(email)) return c.json({ error: "invalid", field: "email" }, 400);
  if (!isAcceptablePassword(body.password))
    return c.json({ error: "invalid", field: "password" }, 400);
  if (!isLanguage(body.language)) return c.json({ error: "invalid", field: "language" }, 400);
  if (!isTimeZone(body.timeZone)) return c.json({ error: "invalid", field: "timeZone" }, 400);

  const ownerId = randomId();
  await db.batch([
    db.insert(schema.family).values({
      id: randomId(),
      name,
      language: body.language,
      timeZone: body.timeZone,
      setupCodeHash: await sha256(c.env.SETUP_CODE),
      createdAt: now.toISOString(),
      changedAt: now.toISOString(),
    }),
    db.insert(schema.account).values({
      id: ownerId,
      email,
      passwordHash: await hashPassword(body.password),
      role: "owner",
      createdAt: now.toISOString(),
      changedAt: now.toISOString(),
    }),
    ...seedBuiltInTypes(db, now.toISOString()),
    ...seedBuiltInTemplates(db, now.toISOString()),
  ]);
  await clearFailures(db, ip);
  await startSession(c, db, now, ownerId);
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
  const account = await accountByEmail(db, normalEmail(body.email));
  // An unknown email and a wrong password look the same, so neither leaks who has an Account.
  const password = String(body.password ?? "");
  const matches = await verifyPassword(password, account?.passwordHash || NO_ACCOUNT_HASH);
  if (!account || !matches) {
    await recordFailure(db, ip, now);
    return c.json({ error: "wrong_password" }, 401);
  }
  await clearFailures(db, ip);
  await startSession(c, db, now, account.id);
  return c.json({ ok: true }, 201);
});

authRoutes.delete("/session", async (c) => {
  const db = c.get("db");
  const device = await currentDevice(c, db, c.get("now"));
  if (device) await endSession(c, db, device.id);
  return c.body(null, 204);
});
