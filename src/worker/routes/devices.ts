import { and, eq, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie } from "hono/cookie";
import { isDeviceKind, type DeviceKind } from "../../core/device-kind";
import type { Account } from "../auth/account";
import { isAcceptablePassword, verifyPassword } from "../auth/password";
import { SESSION_COOKIE } from "../auth/session";
import { clearFailures, clientIp, recordFailure, retryAfter } from "../auth/throttle";
import { schema } from "../db";
import { replacePassword, sendPasswordNotice } from "./recovery";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

/** The "Signed-in devices" page and changing one's own password. */
export const devicesRoutes = new Hono<AppEnv>().use(requireDevice);

/** The devices an Account may see and sign out: its own, or everyone's for the Owner and Admins. */
function reachable(account: Account, id?: string): SQL | undefined {
  const own =
    account.role === "member" ? eq(schema.signedInDevice.accountId, account.id) : undefined;
  const one = id ? eq(schema.signedInDevice.id, id) : undefined;
  return and(own, one);
}

devicesRoutes.get("/devices", async (c) => {
  const current = c.get("device");
  const db = c.get("db");
  const [devices, accounts, persons] = await Promise.all([
    db
      .select()
      .from(schema.signedInDevice)
      .where(reachable(c.get("account")))
      .orderBy(schema.signedInDevice.lastUsedAt),
    db.select().from(schema.account),
    db.select({ id: schema.person.id, name: schema.person.name }).from(schema.person),
  ]);
  /** Whose device it is: the Person's name, or the email before a Person is chosen. */
  const owner = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    return persons.find((p) => p.id === account?.personId)?.name ?? account?.email ?? "";
  };
  return c.json(
    devices.reverse().map((d) => ({
      id: d.id,
      name: d.name,
      accountId: d.accountId,
      owner: owner(d.accountId),
      kind: d.kind,
      model: d.model,
      createdAt: d.createdAt,
      lastUsedAt: d.lastUsedAt,
      current: d.id === current.id,
    })),
  );
});

devicesRoutes.patch("/devices/:id", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const changes: { name?: string; kind?: DeviceKind } = {};
  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
    if (!name) return c.json({ error: "invalid", field: "name" }, 400);
    changes.name = name;
  }
  if (body.kind !== undefined) {
    if (!isDeviceKind(body.kind)) return c.json({ error: "invalid", field: "kind" }, 400);
    changes.kind = body.kind;
  }
  if (Object.keys(changes).length === 0) return c.json({ error: "invalid", field: "name" }, 400);
  const updated = await c
    .get("db")
    .update(schema.signedInDevice)
    .set(changes)
    .where(reachable(c.get("account"), c.req.param("id")))
    .returning({ id: schema.signedInDevice.id });
  if (updated.length === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ id: updated[0].id, ...changes });
});

devicesRoutes.delete("/devices/:id", async (c) => {
  const id = c.req.param("id");
  const deleted = await c
    .get("db")
    .delete(schema.signedInDevice)
    .where(reachable(c.get("account"), id))
    .returning({ id: schema.signedInDevice.id });
  if (deleted.length === 0) return c.json({ error: "not_found" }, 404);
  if (id === c.get("device").id) {
    deleteCookie(c, SESSION_COOKIE, { path: "/", secure: true, prefix: "host" });
  }
  return c.body(null, 204);
});

/** Changing one's own password signs out every device of that Account, this one included. */
devicesRoutes.post("/password", async (c) => {
  const db = c.get("db");
  const now = c.get("now");
  const ip = clientIp(c);
  const wait = await retryAfter(db, ip, now);
  if (wait > 0) return c.json({ error: "too_many_attempts", retryAfter: wait }, 429);

  const body = await c.req.json().catch(() => ({}));
  const account = c.get("account");
  if (!(await verifyPassword(String(body.currentPassword ?? ""), account.passwordHash))) {
    await recordFailure(db, ip, now);
    return c.json({ error: "wrong_password" }, 401);
  }
  if (!isAcceptablePassword(body.newPassword)) {
    return c.json({ error: "invalid", field: "newPassword" }, 400);
  }
  await clearFailures(db, ip);
  await replacePassword(db, account.id, body.newPassword, now);
  await sendPasswordNotice(c.env, db, account);
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: true, prefix: "host" });
  return c.body(null, 204);
});
