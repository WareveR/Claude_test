import { and, between, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
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
import { dosesBetween, doseReminder } from "../../core/medication";
import { familyNow } from "../../core/task";
import type { Db } from "../db";
import { personsBy, schema } from "../db";
import { pusher, vapidKeys } from "../push";
import { allEntries } from "./entries";
import { presentMedication, seesMedication } from "./medications";

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
  // Only what can remind in the window is read: this runs every 5 minutes, and parsing every
  // Entry and Task each time costs more CPU than the free plan gives one run.
  const [fromDate, toDate] = [from.slice(0, 10), to.slice(0, 10)];
  const { task, taskPerson, checklist } = schema;
  const startingChecklists = and(
    eq(checklist.remindAtStart, true),
    between(checklist.startDate, fromDate, toDate),
  );
  const wanted = or(
    and(isNull(task.checklistId), isNull(task.doneAt), between(task.dueDate, fromDate, toDate)),
    inArray(
      task.checklistId,
      db.select({ id: checklist.id }).from(checklist).where(startingChecklists),
    ),
  );
  const [entries, tasks, links, checklists] = await Promise.all([
    allEntries(db, sql`json_array_length(${schema.entry.reminders}) > 0`),
    db.select().from(task).where(wanted),
    db
      .select({ taskId: taskPerson.taskId, personId: taskPerson.personId })
      .from(taskPerson)
      .innerJoin(task, eq(task.id, taskPerson.taskId))
      .where(wanted),
    db.select().from(checklist).where(startingChecklists),
  ]);
  const personsOf = personsBy(links, (l) => l.taskId);
  const withPersons = tasks.map((t) => ({ ...t, personIds: personsOf.get(t.id) ?? [] }));
  return [
    ...entryReminders(entries, from, to),
    ...taskReminders(withPersons, from, to),
    ...checklistReminders(checklists, withPersons, from, to),
  ].sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * Scheduler, every 5 minutes: sends the Entry, Task and Checklist Reminders and the Medication
 * doses due since the last run to the devices with Reminders
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
  const meds = await db.select().from(schema.medication);
  const doses = dosesBetween(meds.map(presentMedication), from, to);
  if (due.length === 0 && doses.length === 0) return;

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
  if (doses.length > 0) {
    const [accounts, persons] = await Promise.all([
      db.select({ id: schema.account.id, personId: schema.account.personId }).from(schema.account),
      db.select({ id: schema.person.id, name: schema.person.name }).from(schema.person),
    ]);
    for (const dose of doses) {
      const key = `medication:${dose.medication.id}:${dose.date}T${dose.time}`;
      const claimed = await db
        .insert(schema.reminderSent)
        .values({ key, sentAt: now.toISOString() })
        .onConflictDoNothing()
        .returning();
      if (claimed.length === 0) continue;
      const row = meds.find((m) => m.id === dose.medication.id)!;
      const personName = persons.find((p) => p.id === row.personId)?.name ?? "";
      for (const device of devices) {
        if (gone.has(device.id) || !device.pushSubscription) continue;
        if (!remindsDevice(device, [row.personId])) continue;
        // A Private Medication reminds only the Accounts that see it.
        const account = accounts.find((a) => a.id === device.accountId);
        if (!account || !seesMedication(account, row)) continue;
        const language = isLanguage(device.language)
          ? device.language
          : isLanguage(family.language)
            ? family.language
            : "pt-PT";
        const text = doseReminder(dose, personName, language);
        try {
          const result = await pusher.send(
            env,
            device.pushSubscription,
            {
              title: text.title,
              url: `/settings/persons/${row.personId}`,
              tag: key,
              action: {
                title: text.taken,
                post: `/api/medications/${row.id}/doses`,
                date: dose.date,
                time: dose.time,
              },
            },
            now,
          );
          if (result.gone) gone.add(device.id);
        } catch (error) {
          console.warn("push failed", error);
        }
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
