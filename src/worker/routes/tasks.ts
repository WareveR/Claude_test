import { desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { isClockTime } from "../../core/entry-time";
import { isPlainDate } from "../../core/plain-date";
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

/** Ticks a Task done from any device, recording when; ticking again keeps the first time. */
taskRoutes.post("/tasks/:id/done", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [existing] = await db.select().from(schema.task).where(eq(schema.task.id, id));
  if (!existing) return c.json({ error: "not_found" }, 404);
  if (!existing.doneAt) {
    const now = c.get("now").toISOString();
    await db.update(schema.task).set({ doneAt: now, changedAt: now }).where(eq(schema.task.id, id));
  }
  return c.json(await presentOne(db, id));
});

/** Undoes a tick. */
taskRoutes.delete("/tasks/:id/done", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const updated = await db
    .update(schema.task)
    .set({ doneAt: null, changedAt: c.get("now").toISOString() })
    .where(eq(schema.task.id, id))
    .returning({ id: schema.task.id });
  if (updated.length === 0) return c.json({ error: "not_found" }, 404);
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
