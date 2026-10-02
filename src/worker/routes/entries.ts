import { and, eq, gte, inArray, isNotNull, isNull, like, lte, ne, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { entryTimeProblem, isClockTime, type EntryTime } from "../../core/entry-time";
import { ICONS, IMPORTANCES, type Importance } from "../../core/entry-type";
import { addDays, isPlainDate } from "../../core/plain-date";
import { isRepetition, occurrenceDates, type Repetition } from "../../core/repetition";
import { randomId } from "../auth/crypto";
import type { Db } from "../db";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";
import { entryTypeDeleteSteps } from "./entry-types";
import { personMentionChecks } from "./persons";

type EntryRow = typeof schema.entry.$inferSelect;

export type EntryInput = {
  title: string;
  entryTypeId: string;
  time: EntryTime;
  personIds: string[];
  importance: Importance;
  location: string;
  notes: string;
  icon: string | null;
  private: boolean;
  reminders: number[];
  repetition: Repetition | null;
  /** Birthday Entries: the start date carries the real birth year, so the age can show. */
  birthYearKnown: boolean;
};

function parseTime(value: unknown): EntryTime | null {
  if (typeof value !== "object" || value === null) return null;
  const t = value as Record<string, unknown>;
  if (typeof t.startDate !== "string" || !isPlainDate(t.startDate)) return null;
  if (t.allDay === true) {
    if (typeof t.endDate !== "string" || !isPlainDate(t.endDate)) return null;
    return { allDay: true, startDate: t.startDate, endDate: t.endDate };
  }
  if (!isClockTime(t.startTime)) return null;
  const endDate = t.endDate ?? null;
  const endTime = t.endTime ?? null;
  if (endDate !== null && (typeof endDate !== "string" || !isPlainDate(endDate))) return null;
  if (endTime !== null && !isClockTime(endTime)) return null;
  return { allDay: false, startDate: t.startDate, startTime: t.startTime, endDate, endTime };
}

/** Validates a whole Entry; returns the bad field's name or the clean values. */
async function parseEntry(db: Db, body: Record<string, unknown>) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return { field: "title" };
  const time = parseTime(body.time);
  if (!time) return { field: "time" };
  const problem = entryTimeProblem(time);
  if (problem) return { field: "time", problem };
  if (typeof body.entryTypeId !== "string") return { field: "entryTypeId" };
  const [type] = await db
    .select({ id: schema.entryType.id })
    .from(schema.entryType)
    .where(eq(schema.entryType.id, body.entryTypeId));
  if (!type) return { field: "entryTypeId" };
  const personIds = Array.isArray(body.personIds) ? [...new Set(body.personIds)] : [];
  if (!personIds.every((p) => typeof p === "string")) return { field: "personIds" };
  if (personIds.length > 0) {
    const found = await db
      .select({ id: schema.person.id })
      .from(schema.person)
      .where(inArray(schema.person.id, personIds as string[]));
    if (found.length !== personIds.length) return { field: "personIds" };
  }
  const importance = body.importance ?? "normal";
  if (!IMPORTANCES.includes(importance as Importance)) return { field: "importance" };
  const icon = body.icon ?? null;
  if (icon !== null && !ICONS.includes(icon as never)) return { field: "icon" };
  const reminders = Array.isArray(body.reminders) ? body.reminders : [];
  if (!reminders.every((r) => Number.isInteger(r) && r >= 0)) return { field: "reminders" };
  const repetition = body.repetition ?? null;
  if (repetition !== null && !isRepetition(repetition)) return { field: "repetition" };
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return {
    values: {
      title,
      entryTypeId: type.id,
      time,
      personIds: personIds as string[],
      importance: importance as Importance,
      location: text(body.location),
      notes: text(body.notes),
      icon: icon as string | null,
      private: Boolean(body.private),
      reminders: [...new Set(reminders as number[])].sort((a, b) => b - a),
      repetition: repetition as Repetition | null,
      birthYearKnown: Boolean(body.birthYearKnown),
    } satisfies EntryInput,
  };
}

function columns(v: EntryInput) {
  const t = v.time;
  return {
    title: v.title,
    entryTypeId: v.entryTypeId,
    allDay: t.allDay,
    startDate: t.startDate,
    startTime: t.allDay ? null : t.startTime,
    endDate: t.endDate,
    endTime: t.allDay ? null : t.endTime,
    importance: v.importance,
    location: v.location,
    notes: v.notes,
    icon: v.icon,
    private: v.private,
    reminders: v.reminders,
    repetition: v.repetition,
    birthYearKnown: v.birthYearKnown,
  };
}

type ExceptionRow = typeof schema.occurrenceException.$inferSelect;

export function present(row: EntryRow, personIds: string[], exceptions: ExceptionRow[] = []) {
  const time: EntryTime = row.allDay
    ? { allDay: true, startDate: row.startDate, endDate: row.endDate! }
    : {
        allDay: false,
        startDate: row.startDate,
        startTime: row.startTime!,
        endDate: row.endDate,
        endTime: row.endTime,
      };
  return {
    id: row.id,
    title: row.title,
    entryTypeId: row.entryTypeId,
    time,
    personIds,
    importance: row.importance,
    location: row.location,
    notes: row.notes,
    icon: row.icon,
    private: row.private,
    reminders: row.reminders,
    repetition: row.repetition ?? null,
    seriesId: row.seriesId,
    birthdayPersonId: row.birthdayPersonId,
    birthYearKnown: row.birthYearKnown,
    exceptions: exceptions.map((e) => ({
      date: e.originalDate,
      skipped: e.skipped,
      override: e.override,
    })),
    createdAt: row.createdAt,
    changedAt: row.changedAt,
  };
}

async function withPersons(db: Db, rows: EntryRow[]) {
  if (rows.length === 0) return [];
  const links = await db
    .select()
    .from(schema.entryPerson)
    .where(
      inArray(
        schema.entryPerson.entryId,
        rows.map((r) => r.id),
      ),
    );
  const repeating = rows.filter((r) => r.repetition).map((r) => r.id);
  const exceptions = repeating.length
    ? await db
        .select()
        .from(schema.occurrenceException)
        .where(inArray(schema.occurrenceException.entryId, repeating))
    : [];
  return rows.map((row) =>
    present(
      row,
      links.filter((l) => l.entryId === row.id).map((l) => l.personId),
      exceptions.filter((e) => e.entryId === row.id),
    ),
  );
}

/** Every Entry with its Persons and exceptions, for the Calendar Feed. */
export async function allEntries(db: Db) {
  const [rows, links, exceptions] = await Promise.all([
    db.select().from(schema.entry),
    db.select().from(schema.entryPerson),
    db.select().from(schema.occurrenceException),
  ]);
  const personsOf = new Map<string, string[]>();
  for (const l of links)
    personsOf.set(l.entryId, [...(personsOf.get(l.entryId) ?? []), l.personId]);
  const exceptionsOf = new Map<string, ExceptionRow[]>();
  for (const e of exceptions)
    exceptionsOf.set(e.entryId, [...(exceptionsOf.get(e.entryId) ?? []), e]);
  return rows.map((row) =>
    present(row, personsOf.get(row.id) ?? [], exceptionsOf.get(row.id) ?? []),
  );
}

function personLinks(db: Db, entryId: string, personIds: string[]) {
  return personIds.map((personId) => db.insert(schema.entryPerson).values({ entryId, personId }));
}

personMentionChecks.push(async (db, personId) => {
  // The Person's own synced Birthday doesn't count: it goes with them.
  const [link] = await db
    .select({ entryId: schema.entryPerson.entryId })
    .from(schema.entryPerson)
    .innerJoin(schema.entry, eq(schema.entry.id, schema.entryPerson.entryId))
    .where(
      and(
        eq(schema.entryPerson.personId, personId),
        or(isNull(schema.entry.birthdayPersonId), ne(schema.entry.birthdayPersonId, personId)),
      ),
    )
    .limit(1);
  if (link) return true;
  const [override] = await db
    .select({ entryId: schema.occurrenceException.entryId })
    .from(schema.occurrenceException)
    .where(like(schema.occurrenceException.override, `%"${personId}"%`))
    .limit(1);
  return Boolean(override);
});

entryTypeDeleteSteps.push(async (db, typeId, moves, generalId) => {
  const entries = await db
    .select({ id: schema.entry.id })
    .from(schema.entry)
    .where(eq(schema.entry.entryTypeId, typeId));
  for (const { id } of entries) {
    const target = moves[id] && moves[id] !== typeId ? moves[id] : generalId;
    await db.update(schema.entry).set({ entryTypeId: target }).where(eq(schema.entry.id, id));
  }
});

/**
 * A synced Birthday's date, Person, title, type and Repetition follow its Person; returns the
 * first of those the edit tries to change.
 */
function lockedChange(row: EntryRow, v: EntryInput) {
  const fixed = columns(v);
  for (const key of ["title", "entryTypeId", "allDay", "startDate", "endDate"] as const) {
    if (fixed[key] !== row[key]) return key === "title" || key === "entryTypeId" ? key : "time";
  }
  if (JSON.stringify(v.repetition) !== JSON.stringify(row.repetition)) return "repetition";
  if (v.personIds.length !== 1 || v.personIds[0] !== row.birthdayPersonId) return "personIds";
  if (!v.birthYearKnown) return "birthYearKnown";
  return null;
}

export const entryRoutes = new Hono<AppEnv>().use(requireDevice);

/**
 * Entries that may touch a date window, both ends included: one-off Entries overlapping it and
 * every repeating Entry starting by its end. The browser expands Occurrences for the window.
 */
entryRoutes.get("/entries", async (c) => {
  const from = c.req.query("from") ?? "";
  const to = c.req.query("to") ?? "";
  const typeId = c.req.query("entryTypeId");
  const db = c.get("db");
  if (typeId) {
    const rows = await db.select().from(schema.entry).where(eq(schema.entry.entryTypeId, typeId));
    return c.json(await withPersons(db, rows));
  }
  if (!isPlainDate(from) || !isPlainDate(to) || to < from) {
    return c.json({ error: "invalid", field: "window" }, 400);
  }
  const rows = await db
    .select()
    .from(schema.entry)
    .where(
      and(
        lte(schema.entry.startDate, to),
        or(
          gte(sql`coalesce(${schema.entry.endDate}, ${schema.entry.startDate})`, from),
          isNotNull(schema.entry.repetition),
        ),
      ),
    );
  return c.json(await withPersons(db, rows));
});

entryRoutes.get("/entries/:id", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select()
    .from(schema.entry)
    .where(eq(schema.entry.id, c.req.param("id")));
  if (rows.length === 0) return c.json({ error: "not_found" }, 404);
  return c.json((await withPersons(db, rows))[0]);
});

entryRoutes.post("/entries", async (c) => {
  const db = c.get("db");
  const parsed = await parseEntry(db, await c.req.json().catch(() => ({})));
  if (!parsed.values) return c.json({ error: "invalid", ...parsed }, 400);
  const id = randomId();
  const now = c.get("now").toISOString();
  await db.batch([
    db
      .insert(schema.entry)
      .values({ id, ...columns(parsed.values), createdAt: now, changedAt: now }),
    ...personLinks(db, id, parsed.values.personIds),
  ]);
  const rows = await db.select().from(schema.entry).where(eq(schema.entry.id, id));
  return c.json((await withPersons(db, rows))[0], 201);
});

entryRoutes.put("/entries/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [existing] = await db.select().from(schema.entry).where(eq(schema.entry.id, id));
  if (!existing) return c.json({ error: "not_found" }, 404);
  const parsed = await parseEntry(db, await c.req.json().catch(() => ({})));
  if (!parsed.values) return c.json({ error: "invalid", ...parsed }, 400);
  const field = existing.birthdayPersonId && lockedChange(existing, parsed.values);
  if (field) return c.json({ error: "birthday_locked", field }, 409);
  await db.batch([
    db
      .update(schema.entry)
      .set({ ...columns(parsed.values), changedAt: c.get("now").toISOString() })
      .where(eq(schema.entry.id, id)),
    db.delete(schema.entryPerson).where(eq(schema.entryPerson.entryId, id)),
    ...personLinks(db, id, parsed.values.personIds),
  ]);
  const rows = await db.select().from(schema.entry).where(eq(schema.entry.id, id));
  return c.json((await withPersons(db, rows))[0]);
});

/**
 * Deleting is for good; nightly Backups are the safety net. A synced Birthday goes only through
 * its Person's date of birth.
 */
entryRoutes.delete("/entries/:id", async (c) => {
  const db = c.get("db");
  const row = await loadEntry(db, c.req.param("id"));
  if (row?.birthdayPersonId) return c.json({ error: "birthday_locked" }, 409);
  const deleted = await db
    .delete(schema.entry)
    .where(eq(schema.entry.id, c.req.param("id")))
    .returning({ id: schema.entry.id });
  if (deleted.length === 0) return c.json({ error: "not_found" }, 404);
  return c.body(null, 204);
});

async function loadEntry(db: Db, id: string) {
  const [row] = await db.select().from(schema.entry).where(eq(schema.entry.id, id));
  return row;
}

async function presentOne(db: Db, id: string) {
  const rows = await db.select().from(schema.entry).where(eq(schema.entry.id, id));
  return (await withPersons(db, rows))[0];
}

/** Whether `date` is one of the series' Occurrences. */
function isOccurrence(row: EntryRow, date: string) {
  if (!row.repetition || !isPlainDate(date)) return false;
  return occurrenceDates(row.startDate, row.repetition, date, date).length === 1;
}

/** The series' Repetition cut to end the day before `date`. */
function endBefore(row: EntryRow, date: string): Repetition {
  const repetition = row.repetition!;
  if (repetition.end.type === "count") {
    const before = occurrenceDates(row.startDate, repetition, row.startDate, addDays(date, -1));
    return { ...repetition, end: { type: "count", count: before.length } };
  }
  return { ...repetition, end: { type: "until", date: addDays(date, -1) } };
}

/** "This Occurrence": edit one Occurrence alone; any field but the Repetition. */
entryRoutes.put("/entries/:id/occurrences/:date", async (c) => {
  const db = c.get("db");
  const { id, date } = c.req.param();
  const row = await loadEntry(db, id);
  if (!row || !isOccurrence(row, date)) return c.json({ error: "not_found" }, 404);
  if (row.birthdayPersonId) return c.json({ error: "birthday_locked" }, 409);
  const parsed = await parseEntry(db, await c.req.json().catch(() => ({})));
  if (!parsed.values) return c.json({ error: "invalid", ...parsed }, 400);
  const { repetition, ...override } = parsed.values;
  if (repetition && JSON.stringify(repetition) !== JSON.stringify(row.repetition)) {
    return c.json({ error: "invalid", field: "repetition" }, 400);
  }
  await db
    .insert(schema.occurrenceException)
    .values({ entryId: id, originalDate: date, skipped: false, override })
    .onConflictDoUpdate({
      target: [schema.occurrenceException.entryId, schema.occurrenceException.originalDate],
      set: { skipped: false, override },
    });
  await db
    .update(schema.entry)
    .set({ changedAt: c.get("now").toISOString() })
    .where(eq(schema.entry.id, id));
  return c.json(await presentOne(db, id));
});

/** "This Occurrence": skip one Occurrence. */
entryRoutes.delete("/entries/:id/occurrences/:date", async (c) => {
  const db = c.get("db");
  const { id, date } = c.req.param();
  const row = await loadEntry(db, id);
  if (!row || !isOccurrence(row, date)) return c.json({ error: "not_found" }, 404);
  if (row.birthdayPersonId) return c.json({ error: "birthday_locked" }, 409);
  await db
    .insert(schema.occurrenceException)
    .values({ entryId: id, originalDate: date, skipped: true, override: null })
    .onConflictDoUpdate({
      target: [schema.occurrenceException.entryId, schema.occurrenceException.originalDate],
      set: { skipped: true, override: null },
    });
  return c.body(null, 204);
});

/**
 * "This and the following": the old Entry ends the day before, and a new Entry from this
 * Occurrence on carries the changes, linked by a series id. Later exceptions move with it.
 */
entryRoutes.post("/entries/:id/following/:date", async (c) => {
  const db = c.get("db");
  const { id, date } = c.req.param();
  const row = await loadEntry(db, id);
  if (!row || !isOccurrence(row, date)) return c.json({ error: "not_found" }, 404);
  if (row.birthdayPersonId) return c.json({ error: "birthday_locked" }, 409);
  const parsed = await parseEntry(db, await c.req.json().catch(() => ({})));
  if (!parsed.values) return c.json({ error: "invalid", ...parsed }, 400);
  const now = c.get("now").toISOString();
  const seriesId = row.seriesId ?? row.id;
  const newId = randomId();
  let repetition = parsed.values.repetition;
  if (repetition?.end.type === "count" && row.repetition?.end.type === "count") {
    // The new series keeps the times that were left.
    const before = endBefore(row, date).end as { count: number };
    repetition = {
      ...repetition,
      end: { type: "count", count: Math.max(1, repetition.end.count - before.count) },
    };
  }
  const values = { ...parsed.values, repetition };
  const oldEnd = endBefore(row, date);
  const nothingLeft =
    date === row.startDate || (oldEnd.end.type === "count" && oldEnd.end.count === 0);
  await db.batch([
    db
      .insert(schema.entry)
      .values({ id: newId, ...columns(values), seriesId, createdAt: now, changedAt: now }),
    ...personLinks(db, newId, values.personIds),
    db
      .update(schema.occurrenceException)
      .set({ entryId: newId })
      .where(
        and(
          eq(schema.occurrenceException.entryId, id),
          gte(schema.occurrenceException.originalDate, date),
        ),
      ),
    nothingLeft
      ? db.delete(schema.entry).where(eq(schema.entry.id, id))
      : db
          .update(schema.entry)
          .set({ repetition: oldEnd, seriesId, changedAt: now })
          .where(eq(schema.entry.id, id)),
  ]);
  return c.json(await presentOne(db, newId), 201);
});

/** "This and the following" for deleting: the series ends the day before. */
entryRoutes.delete("/entries/:id/following/:date", async (c) => {
  const db = c.get("db");
  const { id, date } = c.req.param();
  const row = await loadEntry(db, id);
  if (!row || !isOccurrence(row, date)) return c.json({ error: "not_found" }, 404);
  if (row.birthdayPersonId) return c.json({ error: "birthday_locked" }, 409);
  const oldEnd = endBefore(row, date);
  if (date === row.startDate || (oldEnd.end.type === "count" && oldEnd.end.count === 0)) {
    await db.delete(schema.entry).where(eq(schema.entry.id, id));
  } else {
    await db.batch([
      db
        .update(schema.entry)
        .set({ repetition: oldEnd, changedAt: c.get("now").toISOString() })
        .where(eq(schema.entry.id, id)),
      db
        .delete(schema.occurrenceException)
        .where(
          and(
            eq(schema.occurrenceException.entryId, id),
            gte(schema.occurrenceException.originalDate, date),
          ),
        ),
    ]);
  }
  return c.body(null, 204);
});
