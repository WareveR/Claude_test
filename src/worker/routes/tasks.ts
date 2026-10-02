import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { Hono } from "hono";
import { isClockTime } from "../../core/entry-time";
import { isPlainDate } from "../../core/plain-date";
import { isRepetition, type Repetition } from "../../core/repetition";
import { familyNow, nextRepeat } from "../../core/task";
import { randomId } from "../auth/crypto";
import type { Db } from "../db";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";
import { personMentionChecks } from "./persons";

type TaskRow = typeof schema.task.$inferSelect;

export type TaskInput = {
  title: string;
  notes: string;
  dueDate: string | null;
  dueTime: string | null;
  personIds: string[];
  private: boolean;
  repetition: Repetition | null;
};

/** Validates a whole Task; returns the bad field's name or the clean values. */
async function parseTask(db: Db, body: Record<string, unknown>) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return { field: "title" };
  const dueDate = body.dueDate ?? null;
  if (dueDate !== null && (typeof dueDate !== "string" || !isPlainDate(dueDate))) {
    return { field: "dueDate" };
  }
  const dueTime = body.dueTime ?? null;
  if (dueTime !== null && (!isClockTime(dueTime) || dueDate === null)) return { field: "dueTime" };
  const repetition = body.repetition ?? null;
  if (repetition !== null && (!isRepetition(repetition) || dueDate === null)) {
    return { field: "repetition" };
  }
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
      title,
      notes: typeof body.notes === "string" ? body.notes.trim() : "",
      dueDate: dueDate as string | null,
      dueTime: dueTime as string | null,
      personIds: personIds as string[],
      private: Boolean(body.private),
      repetition: repetition as Repetition | null,
    } satisfies TaskInput,
  };
}

async function present(db: Db, rows: TaskRow[]) {
  if (rows.length === 0) return [];
  const links = await db
    .select()
    .from(schema.taskPerson)
    .where(
      inArray(
        schema.taskPerson.taskId,
        rows.map((r) => r.id),
      ),
    );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    notes: row.notes,
    dueDate: row.dueDate,
    dueTime: row.dueTime,
    personIds: links.filter((l) => l.taskId === row.id).map((l) => l.personId),
    private: row.private,
    doneAt: row.doneAt,
    repetition: row.repetition ?? null,
    seriesId: row.seriesId,
    createdAt: row.createdAt,
    changedAt: row.changedAt,
  }));
}

async function presentOne(db: Db, id: string) {
  const rows = await db.select().from(schema.task).where(eq(schema.task.id, id));
  return (await present(db, rows))[0];
}

function personLinks(db: Db, taskId: string, personIds: string[]) {
  return personIds.map((personId) => db.insert(schema.taskPerson).values({ taskId, personId }));
}

personMentionChecks.push(async (db, personId) => {
  const [link] = await db
    .select()
    .from(schema.taskPerson)
    .where(eq(schema.taskPerson.personId, personId))
    .limit(1);
  return Boolean(link);
});

export const taskRoutes = new Hono<AppEnv>().use(requireDevice);

/** Every Task, newest first; the browser groups them in the Family Time Zone. */
taskRoutes.get("/tasks", async (c) => {
  const db = c.get("db");
  const rows = await db.select().from(schema.task).orderBy(desc(schema.task.createdAt));
  return c.json(await present(db, rows));
});

taskRoutes.get("/tasks/:id", async (c) => {
  const task = await presentOne(c.get("db"), c.req.param("id"));
  if (!task) return c.json({ error: "not_found" }, 404);
  return c.json(task);
});

taskRoutes.post("/tasks", async (c) => {
  const db = c.get("db");
  const parsed = await parseTask(db, await c.req.json().catch(() => ({})));
  if (!parsed.values) return c.json({ error: "invalid", field: parsed.field }, 400);
  const { personIds, ...fields } = parsed.values;
  const id = randomId();
  const now = c.get("now").toISOString();
  await db.batch([
    db.insert(schema.task).values({ id, ...fields, createdAt: now, changedAt: now }),
    ...personLinks(db, id, personIds),
  ]);
  return c.json(await presentOne(db, id), 201);
});

taskRoutes.put("/tasks/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [existing] = await db.select().from(schema.task).where(eq(schema.task.id, id));
  if (!existing) return c.json({ error: "not_found" }, 404);
  const parsed = await parseTask(db, await c.req.json().catch(() => ({})));
  if (!parsed.values) return c.json({ error: "invalid", field: parsed.field }, 400);
  const { personIds, ...fields } = parsed.values;
  await db.batch([
    db
      .update(schema.task)
      .set({ ...fields, changedAt: c.get("now").toISOString() })
      .where(eq(schema.task.id, id)),
    db.delete(schema.taskPerson).where(eq(schema.taskPerson.taskId, id)),
    ...personLinks(db, id, personIds),
  ]);
  return c.json(await presentOne(db, id));
});

/**
 * Ticks a Task done from any device, recording when; ticking again keeps the first time.
 * A repeating Task stays done and brings up the next one, so only one is undone at a time.
 */
taskRoutes.post("/tasks/:id/done", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [existing] = await db.select().from(schema.task).where(eq(schema.task.id, id));
  if (!existing) return c.json({ error: "not_found" }, 404);
  if (!existing.doneAt) {
    const now = c.get("now");
    const at = now.toISOString();
    const tick = db
      .update(schema.task)
      .set({ doneAt: at, changedAt: at })
      .where(eq(schema.task.id, id));
    const next = await nextTask(db, existing, now);
    if (!next) await tick;
    else {
      const links = await db
        .select({ personId: schema.taskPerson.personId })
        .from(schema.taskPerson)
        .where(eq(schema.taskPerson.taskId, id));
      const nextId = randomId();
      await db.batch([
        tick,
        db.insert(schema.task).values({
          id: nextId,
          title: existing.title,
          notes: existing.notes,
          dueDate: next.dueDate,
          dueTime: existing.dueTime,
          private: existing.private,
          repetition: next.repetition,
          seriesId: existing.seriesId ?? existing.id,
          repeatOf: id,
          createdAt: at,
          changedAt: at,
        }),
        ...personLinks(
          db,
          nextId,
          links.map((l) => l.personId),
        ),
        ...(existing.seriesId
          ? []
          : [db.update(schema.task).set({ seriesId: id }).where(eq(schema.task.id, id))]),
      ]);
    }
  }
  return c.json(await presentOne(db, id));
});

/** The next Task of a repeating series, unless the series ended or already has an undone one. */
async function nextTask(db: Db, task: TaskRow, now: Date) {
  if (!task.repetition || !task.dueDate) return null;
  if (task.seriesId) {
    const [undone] = await db
      .select({ id: schema.task.id })
      .from(schema.task)
      .where(
        and(
          eq(schema.task.seriesId, task.seriesId),
          ne(schema.task.id, task.id),
          isNull(schema.task.doneAt),
        ),
      )
      .limit(1);
    if (undone) return null;
  }
  const [family] = await db.select({ timeZone: schema.family.timeZone }).from(schema.family);
  return nextRepeat(task.dueDate, task.repetition, familyNow(family.timeZone, now).today);
}

/** Undoes a tick; the next Task it brought up goes too, unless someone already changed it. */
taskRoutes.delete("/tasks/:id/done", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [existing] = await db.select().from(schema.task).where(eq(schema.task.id, id));
  if (!existing) return c.json({ error: "not_found" }, 404);
  const [next] = await db
    .select()
    .from(schema.task)
    .where(and(eq(schema.task.repeatOf, id), isNull(schema.task.doneAt)));
  const untouched = next && next.changedAt === next.createdAt;
  await db.batch([
    db
      .update(schema.task)
      .set({ doneAt: null, changedAt: c.get("now").toISOString() })
      .where(eq(schema.task.id, id)),
    ...(untouched ? [db.delete(schema.task).where(eq(schema.task.id, next.id))] : []),
  ]);
  return c.json(await presentOne(db, id));
});

/** Deleting is for good; nightly Backups are the safety net. */
taskRoutes.delete("/tasks/:id", async (c) => {
  const deleted = await c
    .get("db")
    .delete(schema.task)
    .where(eq(schema.task.id, c.req.param("id")))
    .returning({ id: schema.task.id });
  if (deleted.length === 0) return c.json({ error: "not_found" }, 404);
  return c.body(null, 204);
});
