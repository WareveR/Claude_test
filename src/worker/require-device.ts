import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { currentDevice } from "./auth/session";
import { schema } from "./db";
import type { AppEnv } from "./types";

/**
 * Rejects requests without a valid session and makes the Signed-in Device and its Account
 * available.
 */
export const requireDevice = createMiddleware<AppEnv>(async (c, next) => {
  const db = c.get("db");
  const device = await currentDevice(c, db, c.get("now"));
  if (!device) return c.json({ error: "signed_out" }, 401);
  const [account] = await db
    .select()
    .from(schema.account)
    .where(eq(schema.account.id, device.accountId));
  if (!account) return c.json({ error: "signed_out" }, 401);
  c.set("device", device);
  c.set("account", account);
  await next();
});

/** For routes only the Owner may use; after requireDevice. */
export const requireOwner = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("account").role !== "owner") return c.json({ error: "forbidden" }, 403);
  await next();
});

/** For routes only the Owner and Admins may use; after requireDevice. */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("account").role === "member") return c.json({ error: "forbidden" }, 403);
  await next();
});
