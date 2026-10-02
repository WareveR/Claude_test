import { and, eq, isNotNull, lt } from "drizzle-orm";
import { clockTime } from "../../core/entry-time";
import { isLanguage } from "../../core/languages";
import {
  checklistReminders,
  entryReminders,
  taskReminders,
  reminderText,
  remindsDevice,
  wallClock,
  type DueReminder,
} from "../../core/reminders";
import { familyNow } from "../../core/task";
import type { Db } from "../db";
import { schema } from "../db";
import { pusher, vapidKeys } from "../push";
import { allEntries } from "./entries";

/** After downtime, Reminders older than this are dropped rather than sent late. */
const CATCH_UP_MS = 60 * 60 * 1000;
/** The first run ever looks back one Scheduler interval. */
const INTERVAL_MS = 5 * 60 * 1000;
/** `reminder_sent` rows are kept this long; long enough for any offset. */
const KEEP_SENT_MS = 90 * 24 * 60 * 60 * 1000;

function familyWallClock(timeZone: string, at: Date) {
  const { today, minutes } = familyNow(timeZone, at);
  return wallClock(today, clockTime(minutes));
}

function linkOf(reminder: DueReminder) {
  if (reminder.kind === "task") return `/tasks/${reminder.id}`;
  if (reminder.kind === "checklist") return `/checklists/${reminder.id}`;
  return `/entries/${reminder.id}?occurrence=${reminder.date}`;
}

async function dueBetween(db: Db, from: string, to: string) {
  const [entries, tasks, links, checklists] = await Promise.all([
    allEntries(db),
    db.select().from(schema.task),
    db.select().from(schema.taskPerson),
    db.select().from(schema.checklist),
  ]);
  const withPersons = tasks.map((t) => ({
    ...t,
    personIds: links.filter((l) => l.taskId === t.id).map((l) => l.personId),
  }));
  return [
    ...entryReminders(entries, from, to),
    ...taskReminders(withPersons, from, to),
    ...checklistReminders(checklists, withPersons, from, to),
  ].sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * Scheduler, every run: sends the Entry, Task and Checklist Reminders due since the last run to the devices with Reminders
 * on whose Persons match (Family-wide items go to every such device), each only once. Expired
 * push subscriptions are removed.
 */
export async function reminderJob(db: Db, env: Env, now: Date) {
  const [family] = await db.select().from(schema.family).limit(1);
  if (!family || !vapidKeys(env)) return;

  const [last] = await db
    .select()
    .from(schema.schedulerRun)
    .where(and(eq(schema.schedulerRun.job, "reminders"), eq(schema.schedulerRun.key, "last")));
  const since = Math.max(
    last ? Date.parse(last.at) : now.getTime() - INTERVAL_MS,
    now.getTime() - CATCH_UP_MS,
  );
  await db
    .insert(schema.schedulerRun)
    .values({ job: "reminders", key: "last", at: now.toISOString() })
    .onConflictDoUpdate({
      target: [schema.schedulerRun.job, schema.schedulerRun.key],
      set: { at: now.toISOString() },
    });
  await db
    .delete(schema.reminderSent)
    .where(lt(schema.reminderSent.sentAt, new Date(now.getTime() - KEEP_SENT_MS).toISOString()));

  const from = familyWallClock(family.timeZone, new Date(since));
  const to = familyWallClock(family.timeZone, now);
  if (from >= to) return;
  const due = await dueBetween(db, from, to);
  if (due.length === 0) return;

  const devices = await db
    .select()
    .from(schema.signedInDevice)
    .where(isNotNull(schema.signedInDevice.pushSubscription));
  const { today } = familyNow(family.timeZone, now);
  const gone = new Set<string>();
  for (const reminder of due) {
    const claimed = await db
      .insert(schema.reminderSent)
      .values({ key: reminder.key, sentAt: now.toISOString() })
      .onConflictDoNothing()
      .returning();
    if (claimed.length === 0) continue;
    for (const device of devices) {
      if (gone.has(device.id) || !device.pushSubscription) continue;
      if (!remindsDevice(device, reminder.personIds)) continue;
      const language = isLanguage(device.language)
        ? device.language
        : isLanguage(family.language)
          ? family.language
          : "pt-PT";
      try {
        const result = await pusher.send(
          env,
          device.pushSubscription,
          {
            title: reminderText(reminder, today, language),
            url: linkOf(reminder),
            tag: reminder.key,
          },
          now,
        );
        if (result.gone) gone.add(device.id);
      } catch (error) {
        console.warn("push failed", error);
      }
    }
  }
  for (const id of gone) {
    await db
      .update(schema.signedInDevice)
      .set({ pushSubscription: null })
      .where(eq(schema.signedInDevice.id, id));
  }
}
