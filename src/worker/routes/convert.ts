import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { entryFromTask, taskFromEntry, type EntryFromTask } from "../../core/convert";
import type { EntryTime } from "../../core/entry-time";
import { familyNow } from "../../core/task";
import { randomId } from "../auth/crypto";
import type { Db } from "../db";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

/**
 * Turning an Entry into a Task and back. Each stays its own kind underneath; the new one keeps
 * what both have (title, notes, Persons, Private, Importance, Repetition) and the old one goes,
 * in one batch so nothing is half done.
 */
export const convertRoutes = new Hono<AppEnv>().use(requireDevice);

async function today(db: Db, now: Date) {
  const [family] = await db.select({ timeZone: schema.family.timeZone }).from(schema.family);
  return familyNow(family.timeZone, now).today;
}

/** A new Entry of the General type, without Reminders, from a Task's values. */
async function insertEntry(db: Db, values: EntryFromTask, now: string) {
  const [general] = await db
    .select({ id: schema.entryType.id })
    .from(schema.entryType)
    .where(eq(schema.entryType.builtinKey, "general"));
  const id = randomId();
  const t: EntryTime = values.time;
  return {
    id,
    insert: db.insert(schema.entry).values({
      id,
      title: values.title,
      entryTypeId: general.id,
      allDay: t.allDay,
      startDate: t.startDate,
      startTime: t.allDay ? null : t.startTime,
      endDate: t.endDate,
      endTime: t.allDay ? null : t.endTime,
      importance: values.importance,
      notes: values.notes,
      private: values.private,
      reminders: [],
      repetition: values.repetition,
      createdAt: now,
      changedAt: now,
    }),
    links: values.personIds.map((personId) =>
      db.insert(schema.entryPerson).values({ entryId: id, personId }),
    ),
  };
}

/**
 * An Entry becomes a Task. The Checklists and Tasks that prepared for it stay, unlinked, as
 * when an Entry is deleted. A synced Birthday goes only with its Person.
 */
convertRoutes.post("/entries/:id/to-task", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [row] = await db.select().from(schema.entry).where(eq(schema.entry.id, id));
  if (!row) return c.json({ error: "not_found" }, 404);
  if (row.birthdayPersonId) return c.json({ error: "birthday_locked" }, 409);
  const persons = await db
    .select({ personId: schema.entryPerson.personId })
    .from(schema.entryPerson)
    .where(eq(schema.entryPerson.entryId, id));
  const time: EntryTime = row.allDay
    ? { allDay: true, startDate: row.startDate, endDate: row.endDate! }
    : {
        allDay: false,
        startDate: row.startDate,
        startTime: row.startTime!,
        endDate: row.endDate,
        endTime: row.endTime,
      };
  const task = taskFromEntry(
    {
      title: row.title,
      notes: row.notes,
      personIds: persons.map((p) => p.personId),
      private: row.private,
      importance: row.importance,
      repetition: row.repetition ?? null,
      location: row.location,
      time,
    },
    await today(db, c.get("now")),
  );
  const { personIds, ...fields } = task;
  const taskId = randomId();
  const now = c.get("now").toISOString();
  await db.batch([
    db.insert(schema.task).values({ id: taskId, ...fields, createdAt: now, changedAt: now }),
    ...personIds.map((personId) => db.insert(schema.taskPerson).values({ taskId, personId })),
    db.delete(schema.entry).where(eq(schema.entry.id, id)),
  ]);
  return c.json({ id: taskId }, 201);
});

/** A loose Task becomes an Entry; a Checklist's item stays with its Checklist. */
convertRoutes.post("/tasks/:id/to-entry", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [row] = await db.select().from(schema.task).where(eq(schema.task.id, id));
  if (!row) return c.json({ error: "not_found" }, 404);
  if (row.checklistId) return c.json({ error: "invalid", field: "checklistId" }, 400);
  const persons = await db
    .select({ personId: schema.taskPerson.personId })
    .from(schema.taskPerson)
    .where(eq(schema.taskPerson.taskId, id));
  const values = entryFromTask(
    {
      title: row.title,
      notes: row.notes,
      personIds: persons.map((p) => p.personId),
      private: row.private,
      importance: row.importance,
      repetition: row.repetition ?? null,
      dueDate: row.dueDate,
      dueTime: row.dueTime,
    },
    await today(db, c.get("now")),
  );
  const entry = await insertEntry(db, values, c.get("now").toISOString());
  await db.batch([
    entry.insert,
    ...entry.links,
    db.delete(schema.task).where(eq(schema.task.id, id)),
  ]);
  return c.json({ id: entry.id }, 201);
});

/**
 * A Task with items becomes an Entry over its period, or all day today without one, and the
 * list itself stays as that Entry's Preparation, so no item is lost.
 */
convertRoutes.post("/checklists/:id/to-entry", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [row] = await db.select().from(schema.checklist).where(eq(schema.checklist.id, id));
  if (!row) return c.json({ error: "not_found" }, 404);
  const persons = await db
    .select({ personId: schema.checklistPerson.personId })
    .from(schema.checklistPerson)
    .where(eq(schema.checklistPerson.checklistId, id));
  const start = row.startDate ?? row.endDate ?? (await today(db, c.get("now")));
  const values: EntryFromTask = {
    title: row.name,
    notes: "",
    personIds: persons.map((p) => p.personId),
    private: false,
    importance: "normal",
    // Without a start, a Checklist's rounds count from the day it was saved, not the Entry's.
    repetition: row.startDate ? (row.repetition ?? null) : null,
    time: { allDay: true, startDate: start, endDate: row.endDate ?? start },
  };
  const now = c.get("now").toISOString();
  const entry = await insertEntry(db, values, now);
  await db.batch([
    entry.insert,
    ...entry.links,
    db
      .update(schema.checklist)
      .set({ entryId: entry.id, changedAt: now })
      .where(eq(schema.checklist.id, id)),
  ]);
  return c.json({ id: entry.id }, 201);
});
