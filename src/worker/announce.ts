import { and, eq, isNotNull, ne } from "drizzle-orm";
import type { Context } from "hono";
import { isLanguage } from "../core/languages";
import { newItemText } from "../core/new-item-text";
import { remindsDevice } from "../core/reminders";
import { schema } from "./db";
import { pusher, vapidKeys } from "./push";
import type { AppEnv } from "./types";

export type NewItem = {
  kind: "entry" | "task";
  id: string;
  title: string;
  private: boolean;
  personIds: string[];
};

/**
 * Tells the Family's other devices that an Entry or Task was just created, by push. Only devices
 * with notifications allowed and Reminders on hear about it, and only for the Persons they follow.
 */
export async function announceNew(c: Context<AppEnv>, item: NewItem) {
  const env = c.env;
  if (!vapidKeys(env)) return;
  const db = c.get("db");
  const from = c.get("device").id;
  const devices = await db
    .select()
    .from(schema.signedInDevice)
    .where(
      and(isNotNull(schema.signedInDevice.pushSubscription), ne(schema.signedInDevice.id, from)),
    );
  const url = item.kind === "task" ? `/tasks/${item.id}` : `/entries/${item.id}`;
  const now = c.get("now");
  for (const device of devices) {
    if (!device.pushSubscription || !remindsDevice(device, item.personIds)) continue;
    const language = isLanguage(device.language) ? device.language : "pt-PT";
    try {
      const result = await pusher.send(
        env,
        device.pushSubscription,
        { title: newItemText(item, language), url, tag: `new-${item.id}` },
        now,
      );
      if (result.gone) {
        await db
          .update(schema.signedInDevice)
          .set({ pushSubscription: null })
          .where(eq(schema.signedInDevice.id, device.id));
      }
    } catch (error) {
      console.warn("push failed", error);
    }
  }
}

/** Runs `announceNew` after the answer is sent, so creating stays as fast as before. */
export function announceLater(c: Context<AppEnv>, item: NewItem) {
  const work = announceNew(c, item).catch((error) => console.warn("announce failed", error));
  try {
    c.executionCtx.waitUntil(work);
  } catch {
    // No execution context (tests): the promise still runs.
  }
  return work;
}
