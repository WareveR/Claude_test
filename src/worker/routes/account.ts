import { and, eq, ne } from "drizzle-orm";
import { Hono } from "hono";
import { verifyPassword } from "../auth/password";
import { clearFailures, clientIp, recordFailure, retryAfter } from "../auth/throttle";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

/** The signed-in Account's own details. */
export const accountRoutes = new Hono<AppEnv>().use(requireDevice);

/**
 * Says which Person the signed-in Account is; each Person has at most one Account. Only the
 * Owner and Admins choose their own, since a Member could otherwise take another adult's Person
 * (and later see what is Private to them); a Member's is set when they are invited.
 */
accountRoutes.put("/account/person", async (c) => {
  const db = c.get("db");
  const account = c.get("account");
  if (account.role === "member") return c.json({ error: "forbidden" }, 403);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const personId = typeof body.personId === "string" ? body.personId : "";
  const [person] = await db
    .select({ id: schema.person.id, archived: schema.person.archived })
    .from(schema.person)
    .where(eq(schema.person.id, personId));
  if (!person || person.archived) return c.json({ error: "invalid", field: "personId" }, 400);
  const [taken] = await db
    .select({ id: schema.account.id })
    .from(schema.account)
    .where(and(eq(schema.account.personId, personId), ne(schema.account.id, account.id)));
  if (taken) return c.json({ error: "person_taken" }, 409);
  await db
    .update(schema.account)
    .set({ personId, changedAt: c.get("now").toISOString() })
    .where(eq(schema.account.id, account.id));
  return c.json({ personId });
});

/** Asks the signed-in Account's password again, as leaving Display Mode does. */
accountRoutes.post("/account/password-check", async (c) => {
  const db = c.get("db");
  const now = c.get("now");
  const ip = clientIp(c);
  const wait = await retryAfter(db, ip, now);
  if (wait > 0) return c.json({ error: "too_many_attempts", retryAfter: wait }, 429);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyPassword(String(body.password ?? ""), c.get("account").passwordHash))) {
    await recordFailure(db, ip, now);
    return c.json({ error: "wrong_password" }, 401);
  }
  await clearFailures(db, ip);
  return c.body(null, 204);
});
