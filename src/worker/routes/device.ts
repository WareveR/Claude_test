import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { isLanguage } from "../../core/languages";
import type { Device } from "../auth/session";
import { schema } from "../db";
import type { PushSubscriptionJson } from "../db/schema";
import { vapidKeys } from "../push";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

/** The Signed-in Device's own record. */
export const deviceRoutes = new Hono<AppEnv>().use(requireDevice);

function present(device: Device) {
  return {
    id: device.id,
    name: device.name,
    language: device.language,
    push: device.pushSubscription !== null,
    remindersOn: device.remindersOn,
    reminderPersonIds: device.reminderPersonIds,
  };
}

deviceRoutes.get("/device", (c) => c.json(present(c.get("device"))));

/** Changes this device's language. */
deviceRoutes.patch("/device", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!isLanguage(body.language)) return c.json({ error: "invalid", field: "language" }, 400);
  const device = c.get("device");
  await c
    .get("db")
    .update(schema.signedInDevice)
    .set({ language: body.language })
    .where(eq(schema.signedInDevice.id, device.id));
  return c.json({ ...present(device), language: body.language });
});

/** Where pushes may go: the browsers' own push services, so the Worker never posts elsewhere. */
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com",
];

export function isPushSubscription(value: unknown): value is PushSubscriptionJson {
  const v = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  if (typeof v?.endpoint !== "string" || v.endpoint.length > 1000) return false;
  if (typeof v.keys?.p256dh !== "string" || typeof v.keys.auth !== "string") return false;
  if (!/^[A-Za-z0-9_-]{80,100}$/.test(v.keys.p256dh) || !/^[A-Za-z0-9_-]{16,32}$/.test(v.keys.auth))
    return false;
  try {
    const url = new URL(v.endpoint);
    return (
      url.protocol === "https:" &&
      PUSH_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
    );
  } catch {
    return false;
  }
}

/** The VAPID public key the browser subscribes with; null when Reminders aren't set up. */
deviceRoutes.get("/push/key", (c) => c.json({ publicKey: vapidKeys(c.env)?.publicKey ?? null }));

/** Keeps this device's push subscription, after notifications were allowed in Settings. */
deviceRoutes.put("/device/push", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!isPushSubscription(body)) return c.json({ error: "invalid", field: "subscription" }, 400);
  const device = c.get("device");
  const pushSubscription = { endpoint: body.endpoint, keys: body.keys };
  await c
    .get("db")
    .update(schema.signedInDevice)
    .set({ pushSubscription })
    .where(eq(schema.signedInDevice.id, device.id));
  return c.json(present({ ...device, pushSubscription }));
});

deviceRoutes.delete("/device/push", async (c) => {
  const device = c.get("device");
  await c
    .get("db")
    .update(schema.signedInDevice)
    .set({ pushSubscription: null })
    .where(eq(schema.signedInDevice.id, device.id));
  return c.json(present({ ...device, pushSubscription: null }));
});

/** This device's Reminder settings: on or off, and which Persons (null is everyone). */
deviceRoutes.put("/device/reminders", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (typeof body.remindersOn !== "boolean") {
    return c.json({ error: "invalid", field: "remindersOn" }, 400);
  }
  const ids = body.reminderPersonIds;
  if (ids !== null && !(Array.isArray(ids) && ids.every((id) => typeof id === "string"))) {
    return c.json({ error: "invalid", field: "reminderPersonIds" }, 400);
  }
  const db = c.get("db");
  let reminderPersonIds: string[] | null = null;
  if (ids !== null) {
    const known = new Set(
      (await db.select({ id: schema.person.id }).from(schema.person)).map((p) => p.id),
    );
    if (!ids.every((id: string) => known.has(id))) {
      return c.json({ error: "invalid", field: "reminderPersonIds" }, 400);
    }
    reminderPersonIds = [...new Set(ids as string[])];
  }
  const device = c.get("device");
  const settings = { remindersOn: body.remindersOn as boolean, reminderPersonIds };
  await db
    .update(schema.signedInDevice)
    .set(settings)
    .where(eq(schema.signedInDevice.id, device.id));
  return c.json(present({ ...device, ...settings }));
});
