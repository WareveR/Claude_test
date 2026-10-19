import { and, eq, gte } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { isLanguage } from "../../core/languages";
import { accountByEmail, EMAIL, normalEmail, ownerAccount, type Account } from "../auth/account";
import { randomId, randomToken, safeEqual, sha256 } from "../auth/crypto";
import { hashPassword, isAcceptablePassword, verifyPassword } from "../auth/password";
import { startSession } from "../auth/session";
import { clearFailures, clientIp, recordFailure, retryAfter } from "../auth/throttle";
import type { Db } from "../db";
import { schema } from "../db";
import { EMAIL_TEXTS, sendEmail } from "../email";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

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
  accountId: string,
  purpose: "password" | "email",
  now: Date,
  lifetime: number,
  newEmail: string | null = null,
) {
  const token = randomToken();
  await db.insert(schema.recoveryToken).values({
    id: randomId(),
    tokenHash: await sha256(token),
    accountId,
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
  if (
    !row?.accountId ||
    row.purpose !== purpose ||
    row.usedAt ||
    row.expiresAt <= now.toISOString()
  ) {
    return null;
  }
  await db
    .update(schema.recoveryToken)
    .set({ usedAt: now.toISOString() })
    .where(eq(schema.recoveryToken.id, row.id));
  return row;
}

/** Sets an Account's new password and signs out every device of that Account. */
export async function replacePassword(db: Db, accountId: string, password: string, now: Date) {
  await db.batch([
    db
      .update(schema.account)
      .set({ passwordHash: await hashPassword(password), changedAt: now.toISOString() })
      .where(eq(schema.account.id, accountId)),
    db.delete(schema.signedInDevice).where(eq(schema.signedInDevice.accountId, accountId)),
  ]);
}

export async function sendPasswordNotice(env: Env, db: Db, account: { email: string }) {
  const texts = textsFor(await theFamily(db));
  await sendEmail(env, {
    to: account.email,
    subject: texts.passwordChangedSubject,
    text: texts.passwordChangedText,
  });
}

async function accountById(db: Db, id: string): Promise<Account | undefined> {
  const [account] = await db.select().from(schema.account).where(eq(schema.account.id, id));
  return account;
}

/** Password recovery and the setup-code reset: they work without a session. */
export const recoveryRoutes = new Hono<AppEnv>();

/** "Forgot password": the same answer whatever address is typed, so it leaks nothing. */
recoveryRoutes.post("/recovery", async (c) => {
  const db = c.get("db");
  const now = c.get("now");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const family = await theFamily(db);
  const account = family ? await accountByEmail(db, normalEmail(body.email)) : undefined;
  if (family && account) {
    const recent = await db
      .select({ id: schema.recoveryToken.id })
      .from(schema.recoveryToken)
      .where(
        and(
          eq(schema.recoveryToken.accountId, account.id),
          eq(schema.recoveryToken.purpose, "password"),
          gte(schema.recoveryToken.createdAt, new Date(now.getTime() - HOUR).toISOString()),
        ),
      );
    if (recent.length < RECOVERY_EMAILS_PER_HOUR) {
      const token = await issueToken(db, account.id, "password", now, HOUR);
      const texts = textsFor(family);
      await sendEmail(c.env, {
        to: account.email,
        subject: texts.recoverySubject,
        text: texts.recoveryText(link(c, "/recover", token)),
      });
    }
  }
  return c.json({ ok: true }, 202);
});

/** Chooses a new password with a recovery link; every device of that Account is signed out. */
recoveryRoutes.post("/recovery/password", async (c) => {
  const db = c.get("db");
  const now = c.get("now");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!isAcceptablePassword(body.password)) {
    return c.json({ error: "invalid", field: "password" }, 400);
  }
  const row = await redeemToken(db, body.token, "password", now);
  const account = row?.accountId ? await accountById(db, row.accountId) : undefined;
  if (!account) return c.json({ error: "invalid_link" }, 410);
  await replacePassword(db, account.id, body.password as string, now);
  await sendPasswordNotice(c.env, db, account);
  return c.body(null, 204);
});

/** Confirms an Account's new email from the link sent to it; the old address gets a notice. */
recoveryRoutes.post("/recovery-email/confirm", async (c) => {
  const db = c.get("db");
  const now = c.get("now");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const row = await redeemToken(db, body.token, "email", now);
  const account = row?.accountId ? await accountById(db, row.accountId) : undefined;
  if (!row?.newEmail || !account) return c.json({ error: "invalid_link" }, 410);
  if (await accountByEmail(db, row.newEmail)) return c.json({ error: "email_taken" }, 409);
  await db
    .update(schema.account)
    .set({ email: row.newEmail, changedAt: now.toISOString() })
    .where(eq(schema.account.id, account.id));
  const texts = textsFor(await theFamily(db));
  for (const to of new Set([account.email, row.newEmail])) {
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

/** The last resort: a new setup code lets this browser choose a new password for the Owner. */
recoveryRoutes.post("/setup/password", async (c) => {
  const db = c.get("db");
  const now = c.get("now");
  const ip = clientIp(c);
  const family = await theFamily(db);
  const owner = await ownerAccount(db);
  if (!family || !owner || !(await setupCodeChanged(c.env, family))) {
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
  await replacePassword(db, owner.id, body.password as string, now);
  await db
    .update(schema.family)
    .set({ setupCodeHash: await sha256(c.env.SETUP_CODE), changedAt: now.toISOString() })
    .where(eq(schema.family.id, family.id));
  await sendPasswordNotice(c.env, db, owner);
  await startSession(c, db, now, owner.id);
  return c.json({ ok: true }, 201);
});

/** Changing one's own email: needs the password, then the new address must confirm. */
export const recoveryEmailRoutes = new Hono<AppEnv>().use(requireDevice);

recoveryEmailRoutes.post("/recovery-email", async (c) => {
  const db = c.get("db");
  const now = c.get("now");
  const ip = clientIp(c);
  const wait = await retryAfter(db, ip, now);
  if (wait > 0) return c.json({ error: "too_many_attempts", retryAfter: wait }, 429);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const family = await theFamily(db);
  const account = c.get("account");
  if (!(await verifyPassword(String(body.password ?? ""), account.passwordHash))) {
    await recordFailure(db, ip, now);
    return c.json({ error: "wrong_password" }, 401);
  }
  const email = normalEmail(body.email);
  if (!EMAIL.test(email)) return c.json({ error: "invalid", field: "email" }, 400);
  await clearFailures(db, ip);
  if (await accountByEmail(db, email)) return c.json({ error: "email_taken" }, 409);
  const token = await issueToken(db, account.id, "email", now, 24 * HOUR, email);
  const texts = textsFor(family);
  await sendEmail(c.env, {
    to: email,
    subject: texts.confirmSubject,
    text: texts.confirmText(link(c, "/confirm-email", token)),
  });
  return c.json({ ok: true }, 202);
});
