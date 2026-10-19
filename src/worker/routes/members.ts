import { and, eq, ne } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { accountByEmail, EMAIL, normalEmail, type Account } from "../auth/account";
import { randomId } from "../auth/crypto";
import { isAcceptablePassword } from "../auth/password";
import { startSession } from "../auth/session";
import type { Db } from "../db";
import { schema } from "../db";
import type { Role } from "../db/schema";
import { sendEmail } from "../email";
import { requireAdmin, requireDevice, requireOwner } from "../require-device";
import type { AppEnv } from "../types";
import {
  accountById,
  issueToken,
  link,
  redeemToken,
  replacePassword,
  textsFor,
  theFamily,
} from "./recovery";

const HOUR = 60 * 60 * 1000;
const INVITE_LIFETIME = 7 * 24 * HOUR;

/** An invited Account has no password until its invite link is used. */
export const isPending = (account: Account) => account.passwordHash === "";

function member(account: Account) {
  return {
    id: account.id,
    email: account.email,
    role: account.role,
    dev: account.dev,
    personId: account.personId,
    pending: isPending(account),
  };
}

const isInvitedRole = (value: unknown): value is Exclude<Role, "owner"> =>
  value === "admin" || value === "member";

/** Checks a Person can be given to this Account: it exists, is not archived and has no other Account. */
async function personProblem(db: Db, personId: unknown, accountId: string | null) {
  if (personId === null) return null;
  if (typeof personId !== "string") return "invalid";
  const [person] = await db
    .select({ archived: schema.person.archived })
    .from(schema.person)
    .where(eq(schema.person.id, personId));
  if (!person || person.archived) return "invalid";
  const [taken] = await db
    .select({ id: schema.account.id })
    .from(schema.account)
    .where(
      accountId
        ? and(eq(schema.account.personId, personId), ne(schema.account.id, accountId))
        : eq(schema.account.personId, personId),
    );
  return taken ? "person_taken" : null;
}

function personError(c: Context<AppEnv>, problem: "invalid" | "person_taken") {
  return problem === "invalid"
    ? c.json({ error: "invalid", field: "personId" }, 400)
    : c.json({ error: "person_taken" }, 409);
}

/** Emails a new invite link, replacing any earlier one; false when the email could not go. */
async function sendInvite(c: Context<AppEnv>, account: Account) {
  const db = c.get("db");
  await db
    .delete(schema.recoveryToken)
    .where(
      and(
        eq(schema.recoveryToken.accountId, account.id),
        eq(schema.recoveryToken.purpose, "invite"),
      ),
    );
  const token = await issueToken(db, account.id, "invite", c.get("now"), INVITE_LIFETIME);
  const family = await theFamily(db);
  const texts = textsFor(family);
  return sendEmail(c.env, {
    to: account.email,
    subject: texts.inviteSubject(family.name),
    text: texts.inviteText(family.name, link(c, "/invite", token)),
  });
}

/** Using an invite link: it works without a session. */
export const inviteRoutes = new Hono<AppEnv>();

/** Chooses the invited Account's password and signs this browser in to it. */
inviteRoutes.post("/invite/accept", async (c) => {
  const db = c.get("db");
  const now = c.get("now");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!isAcceptablePassword(body.password)) {
    return c.json({ error: "invalid", field: "password" }, 400);
  }
  const row = await redeemToken(db, body.token, "invite", now);
  const account = row?.accountId ? await accountById(db, row.accountId) : undefined;
  if (!account || !isPending(account)) return c.json({ error: "invalid_link" }, 410);
  await replacePassword(db, account.id, body.password as string, now);
  await startSession(c, db, now, account.id);
  return c.json({ ok: true }, 201);
});

/** Settings › Família › Membros: the Owner and Admins invite and manage the adults. */
export const memberRoutes = new Hono<AppEnv>().use(requireDevice);

memberRoutes.get("/members", requireAdmin, async (c) => {
  const accounts = await c
    .get("db")
    .select()
    .from(schema.account)
    .orderBy(schema.account.createdAt);
  return c.json(accounts.map(member));
});

memberRoutes.post("/members", requireAdmin, async (c) => {
  const db = c.get("db");
  const now = c.get("now").toISOString();
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = normalEmail(body.email);
  if (!EMAIL.test(email)) return c.json({ error: "invalid", field: "email" }, 400);
  if (!isInvitedRole(body.role)) return c.json({ error: "invalid", field: "role" }, 400);
  const personId = body.personId ?? null;
  const problem = await personProblem(db, personId, null);
  if (problem) return personError(c, problem);
  if (await accountByEmail(db, email)) return c.json({ error: "email_taken" }, 409);
  const account: Account = {
    id: randomId(),
    personId: personId as string | null,
    email,
    passwordHash: "",
    role: body.role,
    dev: body.dev === true,
    createdAt: now,
    changedAt: now,
  };
  await db.insert(schema.account).values(account);
  const emailSent = await sendInvite(c, account);
  return c.json({ ...member(account), emailSent }, 201);
});

/**
 * Changes a member's role, Dev switch or Person, and a pending invite's email. Nobody changes the
 * Owner here, nor their own role; an active Account's email is changed only by its owner, so an
 * Admin can't take it over with a recovery link.
 */
memberRoutes.patch("/members/:id", requireAdmin, async (c) => {
  const db = c.get("db");
  const me = c.get("account");
  const target = await accountById(db, c.req.param("id"));
  if (!target) return c.json({ error: "not_found" }, 404);
  if (target.role === "owner" && me.role !== "owner") return c.json({ error: "forbidden" }, 403);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const changes: Partial<Account> = {};
  if ("role" in body) {
    if (!isInvitedRole(body.role)) return c.json({ error: "invalid", field: "role" }, 400);
    if (target.id === me.id || target.role === "owner") return c.json({ error: "forbidden" }, 403);
    changes.role = body.role;
  }
  if ("dev" in body) {
    if (typeof body.dev !== "boolean") return c.json({ error: "invalid", field: "dev" }, 400);
    changes.dev = body.dev;
  }
  if ("personId" in body) {
    const problem = await personProblem(db, body.personId, target.id);
    if (problem) return personError(c, problem);
    changes.personId = body.personId as string | null;
  }
  let emailChanged = false;
  if ("email" in body) {
    const email = normalEmail(body.email);
    if (!EMAIL.test(email)) return c.json({ error: "invalid", field: "email" }, 400);
    if (email !== target.email) {
      if (!isPending(target)) return c.json({ error: "forbidden" }, 403);
      if (await accountByEmail(db, email)) return c.json({ error: "email_taken" }, 409);
      changes.email = email;
      emailChanged = true;
    }
  }
  const updated = { ...target, ...changes, changedAt: c.get("now").toISOString() };
  await db.update(schema.account).set(updated).where(eq(schema.account.id, target.id));
  const emailSent = emailChanged ? await sendInvite(c, updated) : undefined;
  return c.json({ ...member(updated), emailSent });
});

/** Emails the member a link to choose a new password, or the invite again while it is pending. */
memberRoutes.post("/members/:id/reset", requireAdmin, async (c) => {
  const db = c.get("db");
  const target = await accountById(db, c.req.param("id"));
  if (!target) return c.json({ error: "not_found" }, 404);
  let sent: boolean;
  if (isPending(target)) {
    sent = await sendInvite(c, target);
  } else {
    const token = await issueToken(db, target.id, "password", c.get("now"), HOUR);
    const texts = textsFor(await theFamily(db));
    sent = await sendEmail(c.env, {
      to: target.email,
      subject: texts.recoverySubject,
      text: texts.recoveryText(link(c, "/recover", token)),
    });
  }
  if (!sent) return c.json({ error: "email_failed" }, 502);
  return c.body(null, 204);
});

/** Removes an adult's Account and signs out their devices; what they made stays. */
memberRoutes.delete("/members/:id", requireAdmin, async (c) => {
  const db = c.get("db");
  const target = await accountById(db, c.req.param("id"));
  if (!target) return c.json({ error: "not_found" }, 404);
  if (target.role === "owner" || target.id === c.get("account").id) {
    return c.json({ error: "forbidden" }, 403);
  }
  await db.delete(schema.account).where(eq(schema.account.id, target.id));
  return c.body(null, 204);
});

/** The Owner hands the Family to another adult who has signed in, and becomes an Admin. */
memberRoutes.post("/members/:id/owner", requireOwner, async (c) => {
  const db = c.get("db");
  const me = c.get("account");
  const target = await accountById(db, c.req.param("id"));
  if (!target) return c.json({ error: "not_found" }, 404);
  if (target.id === me.id || isPending(target)) return c.json({ error: "invalid" }, 400);
  const now = c.get("now").toISOString();
  await db.batch([
    db
      .update(schema.account)
      .set({ role: "admin", changedAt: now })
      .where(eq(schema.account.id, me.id)),
    db
      .update(schema.account)
      .set({ role: "owner", changedAt: now })
      .where(eq(schema.account.id, target.id)),
  ]);
  return c.body(null, 204);
});
