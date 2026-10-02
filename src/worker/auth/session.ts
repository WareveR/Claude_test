import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { deviceName } from "../../core/device-name";
import type { Db } from "../db";
import { schema } from "../db";
import { randomId, randomToken, sha256 } from "./crypto";

/** Sent as "__Host-session": Hono adds the prefix. */
export const SESSION_COOKIE = "session";
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
/** last_used_at is rewritten at most this often, to save D1 writes. */
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export type Device = typeof schema.signedInDevice.$inferSelect;

/** Signs this browser in as a new Signed-in Device and sets its session cookie. */
export async function startSession(c: Context, db: Db, now: Date): Promise<Device> {
  const token = randomToken();
  const device: Device = {
    id: randomId(),
    name: deviceName(c.req.header("User-Agent") ?? ""),
    sessionHash: await sha256(token),
    language: null,
    createdAt: now.toISOString(),
    lastUsedAt: now.toISOString(),
  };
  await db.insert(schema.signedInDevice).values(device);
  setSessionCookie(c, token);
  return device;
}

function setSessionCookie(c: Context, token: string) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    prefix: "host",
    maxAge: YEAR_MS / 1000,
  });
}

/**
 * Finds the Signed-in Device behind the request's session cookie. A session lasts a year
 * from its last use; using it extends it.
 */
export async function currentDevice(c: Context, db: Db, now: Date): Promise<Device | null> {
  const token = getCookie(c, SESSION_COOKIE, "host");
  if (!token) return null;
  const sessionHash = await sha256(token);
  const [device] = await db
    .select()
    .from(schema.signedInDevice)
    .where(eq(schema.signedInDevice.sessionHash, sessionHash));
  if (!device) return null;
  const idle = now.getTime() - Date.parse(device.lastUsedAt);
  if (idle > YEAR_MS) {
    await db.delete(schema.signedInDevice).where(eq(schema.signedInDevice.id, device.id));
    return null;
  }
  if (idle > TOUCH_INTERVAL_MS) {
    await db
      .update(schema.signedInDevice)
      .set({ lastUsedAt: now.toISOString() })
      .where(eq(schema.signedInDevice.id, device.id));
    setSessionCookie(c, token);
  }
  return device;
}

export async function endSession(c: Context, db: Db, deviceId: string): Promise<void> {
  await db.delete(schema.signedInDevice).where(eq(schema.signedInDevice.id, deviceId));
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: true, prefix: "host" });
}
