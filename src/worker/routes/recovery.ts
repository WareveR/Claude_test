import { and, eq, gte } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { isLanguage } from "../../core/languages";
import { randomId, randomToken, safeEqual, sha256 } from "../auth/crypto";
import { hashPassword, isAcceptablePassword, verifyPassword } from "../auth/password";
import { startSession } from "../auth/session";
import { clearFailures, clientIp, recordFailure, retryAfter } from "../auth/throttle";
import type { Db } from "../db";
import { schema } from "../db";
import { EMAIL_TEXTS, sendEmail } from "../email";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOUR = 60 * 60 * 1000;
/** At most this many recovery emails an hour, so the form can't flood the inbox. */
const RECOVERY_EMAILS_PER_HOUR = 3;

async function theFamily(db: Db) {
  const [family] = await db.select().from(schema.family).limit(1);
  return family;
}

function textsFor(family: { language: string }) {
  return EMAIL_TEXTS[isLanguage(family.language) ? family.language : "en"];
}

function link(c: Context<AppEnv>, path: string, token: string) {
  return `${new URL(c.req.url).origin}${path}?token=${token}`;
}

async function issueToken(
  db: Db,
  purpose: "password" | "email",
  now: Date,
  lifetime: number,
  newEmail: string | null = null,
) {
  const token = randomToken();
  await db.insert(schema.recoveryToken).values({
    id: randomId(),
    tokenHash: await sha256(token),
    purpose,
    newEmail,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + lifetime).toISOString(),
  });
  return token;
}

/** Uses up a token once; null when unknown, used, expired or for another purpose. */
async function redeemToken(db: Db, token: unknown, purpose: "password" | "email", now: Date) {
  if (typeof token !== "string" || !token) return null;
  const [row] = await db
    .select()
    .from(schema.recoveryToken)
    .where(eq(schema.recoveryToken.tokenHash, await sha256(token)));
  if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt <= now.toISOString()) {
    return null;
  }
  await db
    .update(schema.recoveryToken)
    .set({ usedAt: now.toISOString() })
    .where(eq(schema.recoveryToken.id, row.id));
  return row;
}

/** Sets a new Family Password and signs out every device. */
async function replacePassword(db: Db, password: string, now: Date, setupCodeHash?: string) {
  const family = await theFamily(db);
  await db.batch([
    db
      .update(schema.family)
      .set({
        passwordHash: await hashPassword(password),
        ...(setupCodeHash ? { setupCodeHash } : {}),
        changedAt: now.toISOString(),
      })
      .where(eq(schema.family.id, family.id)),
    db.delete(schema.signedInDevice),
  ]);
  return family;
}

export async function sendPasswordNotice(
  env: Env,
  family: { recoveryEmail: string; language: string },
) {
  const texts = textsFor(family);
  await sendEmail(env, {
    to: family.recoveryEmail,
    subject: texts.passwordChangedSubject,
    text: texts.passwordChangedText,
  });
}

/** Password recovery and the setup-code reset: they work without a session. */
export const recoveryRoutes = new Hono<AppEnv>();

/** "Forgot password": the same answer whatever address is typed, so it leaks nothing. */
recoveryRoutes.post("/recovery", async (c) => {
  const db = c.get("db");
  const now = c.get("now");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const typed = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const family = await theFamily(db);
  if (family && typed && typed === family.recoveryEmail.toLowerCase()) {
    const recent = await db
      .select({ id: schema.recoveryToken.id })
      .from(schema.recoveryToken)
      .where(
        and(
          eq(schema.recoveryToken.purpose, "password"),
          gte(schema.recoveryToken.createdAt, new Date(now.getTime() - HOUR).toISOString()),
        ),
      );
    if (recent.length < RECOVERY_EMAILS_PER_HOUR) {
      const token = await issueToken(db, "password", now, HOUR);
      const texts = textsFor(family);
      await sendEmail(c.env, {
        to: family.recoveryEmail,
        subject: texts.recoverySubject,
        text: texts.recoveryText(link(c, "/recover", token)),
      });
    }
  }
  return c.json({ ok: true }, 202);
});

/** Chooses a new Family Password with a recovery link; every device is signed out. */
recoveryRoutes.post("/recovery/password", async (c) => {
  const db = c.get("db");
  const now = c.get("now");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!isAcceptablePassword(body.password)) {
    return c.json({ error: "invalid", field: "password" }, 400);
  }
  if (!(await redeemToken(db, body.token, "password", now))) {
    return c.json({ error: "invalid_link" }, 410);
  }
  const family = await replacePassword(db, body.password as string, now);
  await sendPasswordNotice(c.env, family);
  return c.body(null, 204);
});

/** Confirms a new recovery email from the link sent to it; the old address gets a notice. */
recoveryRoutes.post("/recovery-email/confirm", async (c) => {
  const db = c.get("db");
  const now = c.get("now");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const row = await redeemToken(db, body.token, "email", now);
  if (!row?.newEmail) return c.json({ error: "invalid_link" }, 410);
  const family = await theFamily(db);
  await db
    .update(schema.family)
    .set({ recoveryEmail: row.newEmail, changedAt: now.toISOString() })
    .where(eq(schema.family.id, family.id));
  const texts = textsFor(family);
  for (const to of new Set([family.recoveryEmail, row.newEmail])) {
    await sendEmail(c.env, {
      to,
      subject: texts.emailChangedSubject,
      text: texts.emailChangedText(row.newEmail),
    });
  }
  return c.body(null, 204);
});

/** Whether the installer set a new setup code, which reopens the choose-new-password screen. */
export async function setupCodeChanged(env: Env, family: { setupCodeHash: string }) {
  return Boolean(env.SETUP_CODE) && (await sha256(env.SETUP_CODE)) !== family.setupCodeHash;
}

/** The last resort: a new setup code lets this browser choose a new Family Password. */
recoveryRoutes.post("/setup/password", async (c) => {
  const db = c.get("db");
  const now = c.get("now");
  const ip = clientIp(c);
  const family = await theFamily(db);
  if (!family || !(await setupCodeChanged(c.env, family))) {
    return c.json({ error: "setup_locked" }, 409);
  }
  const wait = await retryAfter(db, ip, now);
  if (wait > 0) return c.json({ error: "too_many_attempts", retryAfter: wait }, 429);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!safeEqual(String(body.setupCode ?? ""), c.env.SETUP_CODE)) {
    await recordFailure(db, ip, now);
    return c.json({ error: "wrong_setup_code" }, 401);
  }
  if (!isAcceptablePassword(body.password)) {
    return c.json({ error: "invalid", field: "password" }, 400);
  }
  await clearFailures(db, ip);
  await replacePassword(db, body.password as string, now, await sha256(c.env.SETUP_CODE));
  await sendPasswordNotice(c.env, family);
  await startSession(c, db, now);
  return c.json({ ok: true }, 201);
});

/** Changing the recovery email: needs the password, then the new address must confirm. */
export const recoveryEmailRoutes = new Hono<AppEnv>().use(requireDevice);

recoveryEmailRoutes.post("/recovery-email", async (c) => {
  const db = c.get("db");
  const now = c.get("now");
  const ip = clientIp(c);
  const wait = await retryAfter(db, ip, now);
  if (wait > 0) return c.json({ error: "too_many_attempts", retryAfter: wait }, 429);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const family = await theFamily(db);
  if (!(await verifyPassword(String(body.password ?? ""), family.passwordHash))) {
    await recordFailure(db, ip, now);
    return c.json({ error: "wrong_password" }, 401);
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!EMAIL.test(email)) return c.json({ error: "invalid", field: "email" }, 400);
  await clearFailures(db, ip);
  const token = await issueToken(db, "email", now, 24 * HOUR, email);
  const texts = textsFor(family);
  await sendEmail(c.env, {
    to: email,
    subject: texts.confirmSubject,
    text: texts.confirmText(link(c, "/confirm-email", token)),
  });
  return c.json({ ok: true }, 202);
});
