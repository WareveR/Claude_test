import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { Hono } from "hono";
import { entryTimeProblem, isClockTime, type EntryTime } from "../../core/entry-time";
import { ICONS, IMPORTANCES, type Importance } from "../../core/entry-type";
import { isPlainDate } from "../../core/plain-date";
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
  };
}

export function present(row: EntryRow, personIds: string[]) {
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
  return rows.map((row) =>
    present(
      row,
      links.filter((l) => l.entryId === row.id).map((l) => l.personId),
    ),
  );
}

function personLinks(db: Db, entryId: string, personIds: string[]) {
  return personIds.map((personId) => db.insert(schema.entryPerson).values({ entryId, personId }));
}

personMentionChecks.push(async (db, personId) => {
  const [link] = await db
    .select()
    .from(schema.entryPerson)
    .where(eq(schema.entryPerson.personId, personId))
    .limit(1);
  return Boolean(link);
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

export const entryRoutes = new Hono<AppEnv>().use(requireDevice);

/** Entries overlapping a date window, both ends included. */
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
        gte(sql`coalesce(${schema.entry.endDate}, ${schema.entry.startDate})`, from),
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

/** Deleting is for good; nightly Backups are the safety net. */
entryRoutes.delete("/entries/:id", async (c) => {
  const deleted = await c
    .get("db")
    .delete(schema.entry)
    .where(eq(schema.entry.id, c.req.param("id")))
    .returning({ id: schema.entry.id });
  if (deleted.length === 0) return c.json({ error: "not_found" }, 404);
  return c.body(null, 204);
});
