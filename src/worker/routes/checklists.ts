import { asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { Hono } from "hono";
import { cleanItems } from "../../core/checklist-template";
import { dueRoundStart, firstRoundStart, roundLabel, shiftRound } from "../../core/checklist";
import { isPlainDate } from "../../core/plain-date";
import { isRepetition, type Repetition } from "../../core/repetition";
import { familyNow } from "../../core/task";
import { randomId } from "../auth/crypto";
import type { Db } from "../db";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";
import { personMentionChecks } from "./persons";

type ChecklistRow = typeof schema.checklist.$inferSelect;

/**
 * Validates a whole Checklist; returns the bad field's name or the clean values. Start and end
 * are each optional; a Repetition counts its rounds from the start, or from today without one
 * (the first round then starts on the first Repetition date from today).
 */
async function parseChecklist(db: Db, body: Record<string, unknown>, today: string) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { field: "name" };
  const date = (v: unknown) => (v === null || v === undefined ? null : v);
  let startDate = date(body.startDate);
  const endDate = date(body.endDate);
  for (const [field, value] of [
    ["startDate", startDate],
    ["endDate", endDate],
  ] as const) {
    if (value !== null && (typeof value !== "string" || !isPlainDate(value))) return { field };
  }
  const repetition = body.repetition ?? null;
  if (repetition !== null && !isRepetition(repetition)) return { field: "repetition" };
  if (repetition !== null && startDate === null) {
    startDate = firstRoundStart(repetition as Repetition, today);
  }
  if (startDate && endDate && (endDate as string) < (startDate as string)) {
    return { field: "endDate" };
  }
  const remindAtStart = body.remindAtStart ?? true;
  if (typeof remindAtStart !== "boolean") return { field: "remindAtStart" };
  const personIds = Array.isArray(body.personIds) ? [...new Set(body.personIds)] : [];
  if (!personIds.every((p) => typeof p === "string")) return { field: "personIds" };
  if (personIds.length > 0) {
    const found = await db
      .select({ id: schema.person.id })
      .from(schema.person)
      .where(inArray(schema.person.id, personIds as string[]));
    if (found.length !== personIds.length) return { field: "personIds" };
  }
  return {
    values: {
      name,
      startDate: startDate as string | null,
      endDate: endDate as string | null,
      repetition: repetition as Repetition | null,
      remindAtStart,
      personIds: personIds as string[],
    },
  };
}

async function present(db: Db, rows: ChecklistRow[]) {
  if (rows.length === 0) return [];
  const links = await db
    .select()
    .from(schema.checklistPerson)
    .where(
      inArray(
        schema.checklistPerson.checklistId,
        rows.map((r) => r.id),
      ),
    );
  const rounds = await db
    .select()
    .from(schema.checklistRound)
    .where(
      inArray(
        schema.checklistRound.checklistId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(desc(schema.checklistRound.closedAt));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    startDate: row.startDate,
    endDate: row.endDate,
    repetition: row.repetition ?? null,
    remindAtStart: row.remindAtStart,
    personIds: links.filter((l) => l.checklistId === row.id).map((l) => l.personId),
    rounds: rounds
      .filter((r) => r.checklistId === row.id)
      .map((r) => ({ label: r.label, done: r.done, total: r.total })),
    createdAt: row.createdAt,
    changedAt: row.changedAt,
  }));
}

async function presentOne(db: Db, id: string) {
  const rows = await db.select().from(schema.checklist).where(eq(schema.checklist.id, id));
  return (await present(db, rows))[0];
}

function personLinks(db: Db, checklistId: string, personIds: string[]) {
  return personIds.map((personId) =>
    db.insert(schema.checklistPerson).values({ checklistId, personId }),
  );
}

personMentionChecks.push(async (db, personId) => {
  const [link] = await db
    .select()
    .from(schema.checklistPerson)
    .where(eq(schema.checklistPerson.personId, personId))
    .limit(1);
  return Boolean(link);
});

/**
 * Closes the current round, keeping only its result, and starts the next: every item undone,
 * the period moved to the new start. Items' own stored dates are left as they are (ignored).
 */
async function startRound(db: Db, checklist: ChecklistRow, newStart: string | null, now: Date) {
  const tasks = await db
    .select()
    .from(schema.task)
    .where(eq(schema.task.checklistId, checklist.id));
  const at = now.toISOString();
  const { startDate, endDate } = shiftRound(checklist, newStart);
  await db.batch([
    db.insert(schema.checklistRound).values({
      id: randomId(),
      checklistId: checklist.id,
      label: roundLabel(checklist, at.slice(0, 10)),
      done: tasks.filter((t) => t.doneAt).length,
      total: tasks.length,
      closedAt: at,
    }),
    db
      .update(schema.checklist)
      .set({ startDate, endDate, changedAt: at })
      .where(eq(schema.checklist.id, checklist.id)),
    ...tasks
      .filter((t) => t.doneAt)
      .map((t) =>
        db.update(schema.task).set({ doneAt: null, changedAt: at }).where(eq(schema.task.id, t.id)),
      ),
  ]);
}

async function familyToday(db: Db, now: Date) {
  const [family] = await db.select({ timeZone: schema.family.timeZone }).from(schema.family);
  return familyNow(family.timeZone, now).today;
}

/** Starts the rounds that repeating Checklists are due for; the Scheduler can call it too. */
export async function startDueRounds(db: Db, now: Date) {
  const repeating = await db
    .select()
    .from(schema.checklist)
    .where(isNotNull(schema.checklist.repetition));
  if (repeating.length === 0) return;
  const today = await familyToday(db, now);
  for (const checklist of repeating) {
    const start = dueRoundStart(checklist, today);
    if (start) await startRound(db, checklist, start, now);
  }
}

export const checklistRoutes = new Hono<AppEnv>().use(requireDevice);

checklistRoutes.get("/checklists", async (c) => {
  const db = c.get("db");
  await startDueRounds(db, c.get("now"));
  const rows = await db.select().from(schema.checklist).orderBy(asc(schema.checklist.name));
  return c.json(await present(db, rows));
});

checklistRoutes.get("/checklists/:id", async (c) => {
  const checklist = await presentOne(c.get("db"), c.req.param("id"));
  if (!checklist) return c.json({ error: "not_found" }, 404);
  return c.json(checklist);
});

/**
 * A new Checklist; `items` (names, from a template) become its first items, in that order, each
 * for the Checklist's Persons.
 */
checklistRoutes.post("/checklists", async (c) => {
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const parsed = await parseChecklist(db, body, await familyToday(db, c.get("now")));
  if (!parsed.values) return c.json({ error: "invalid", field: parsed.field }, 400);
  const items = body.items === undefined ? [] : cleanItems(body.items);
  if (!items) return c.json({ error: "invalid", field: "items" }, 400);
  const { personIds, ...fields } = parsed.values;
  const id = randomId();
  const at = c.get("now");
  const now = at.toISOString();
  await db.batch([
    db.insert(schema.checklist).values({ id, ...fields, createdAt: now, changedAt: now }),
    ...personLinks(db, id, personIds),
    ...items.flatMap((title, i) => {
      // A millisecond apart, so the items keep the template's order on the Checklist's page.
      const createdAt = new Date(at.getTime() + i).toISOString();
      const taskId = randomId();
      return [
        db.insert(schema.task).values({
          id: taskId,
          title,
          checklistId: id,
          createdAt,
          changedAt: createdAt,
        }),
        ...personIds.map((personId) => db.insert(schema.taskPerson).values({ taskId, personId })),
      ];
    }),
  ]);
  return c.json(await presentOne(db, id), 201);
});

checklistRoutes.put("/checklists/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [existing] = await db.select().from(schema.checklist).where(eq(schema.checklist.id, id));
  if (!existing) return c.json({ error: "not_found" }, 404);
  const parsed = await parseChecklist(
    db,
    await c.req.json().catch(() => ({})),
    await familyToday(db, c.get("now")),
  );
  if (!parsed.values) return c.json({ error: "invalid", field: parsed.field }, 400);
  const { personIds, ...fields } = parsed.values;
  await db.batch([
    db
      .update(schema.checklist)
      .set({ ...fields, changedAt: c.get("now").toISOString() })
      .where(eq(schema.checklist.id, id)),
    db.delete(schema.checklistPerson).where(eq(schema.checklistPerson.checklistId, id)),
    ...personLinks(db, id, personIds),
  ]);
  return c.json(await presentOne(db, id));
});

/** Deleting a Checklist deletes its items too, for good. */
checklistRoutes.delete("/checklists/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [, deleted] = await db.batch([
    db.delete(schema.task).where(eq(schema.task.checklistId, id)),
    db
      .delete(schema.checklist)
      .where(eq(schema.checklist.id, id))
      .returning({ id: schema.checklist.id }),
  ]);
  if (deleted.length === 0) return c.json({ error: "not_found" }, 404);
  return c.body(null, 204);
});

/** "Use again": a new round by hand, optionally moved to a new start date. */
checklistRoutes.post("/checklists/:id/rounds", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [checklist] = await db.select().from(schema.checklist).where(eq(schema.checklist.id, id));
  if (!checklist) return c.json({ error: "not_found" }, 404);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const startDate = body.startDate ?? null;
  if (startDate !== null && (typeof startDate !== "string" || !isPlainDate(startDate))) {
    return c.json({ error: "invalid", field: "startDate" }, 400);
  }
  await startRound(db, checklist, startDate as string | null, c.get("now"));
  return c.json(await presentOne(db, id), 201);
});
