import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { Hono } from "hono";
import { isClockTime } from "../../core/entry-time";
import { IMPORTANCES, type Importance } from "../../core/entry-type";
import { isPlainDate } from "../../core/plain-date";
import { isRepetition, type Repetition } from "../../core/repetition";
import { familyNow, nextRepeat } from "../../core/task";
import { wouldNestInItself } from "../../core/task-tree";
import { randomId } from "../auth/crypto";
import type { Db } from "../db";
import { inParts, schema } from "../db";
import { announceLater } from "../announce";
import type { Account } from "../auth/account";
import { seesInFull } from "../private";
import { requireDevice } from "../require-device";
import { settleChecklist } from "../task-tree";
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
  checklistId: string | null;
  section: string;
  parentId: string | null;
  entryId: string | null;
  importance: Importance;
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
  const checklistId = body.checklistId ?? null;
  if (checklistId !== null) {
    if (typeof checklistId !== "string") return { field: "checklistId" };
    const [found] = await db
      .select({ id: schema.checklist.id })
      .from(schema.checklist)
      .where(eq(schema.checklist.id, checklistId));
    if (!found) return { field: "checklistId" };
  }
  // An item can sit inside another item of the same Checklist.
  const parentId = checklistId === null ? null : (body.parentId ?? null);
  if (parentId !== null) {
    if (typeof parentId !== "string") return { field: "parentId" };
    const [found] = await db
      .select({ checklistId: schema.task.checklistId })
      .from(schema.task)
      .where(eq(schema.task.id, parentId));
    if (found?.checklistId !== checklistId) return { field: "parentId" };
  }
  // Only a loose Task prepares for an Entry; an item goes with its Checklist.
  const entryId = checklistId === null ? (body.entryId ?? null) : null;
  if (entryId !== null) {
    if (typeof entryId !== "string") return { field: "entryId" };
    const [found] = await db
      .select({ id: schema.entry.id })
      .from(schema.entry)
      .where(eq(schema.entry.id, entryId));
    if (!found) return { field: "entryId" };
  }
  // A Checklist's Tasks come back with the Checklist's rounds, never on their own.
  const repetition = body.repetition ?? null;
  if (
    repetition !== null &&
    (!isRepetition(repetition) || dueDate === null || checklistId !== null)
  ) {
    return { field: "repetition" };
  }
  const importance = body.importance ?? "normal";
  if (!IMPORTANCES.includes(importance as Importance)) return { field: "importance" };
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
      checklistId: checklistId as string | null,
      // Items nest instead of having sections (migration 0027).
      section: "",
      parentId: parentId as string | null,
      entryId: entryId as string | null,
      importance: importance as Importance,
    } satisfies TaskInput,
  };
}

/**
 * Tasks as this Account may see them: a Private one it may not see in full keeps only its due
 * date and time, Persons and done state, marked hidden.
 */
async function present(db: Db, rows: TaskRow[], viewer: Account) {
  if (rows.length === 0) return [];
  const links = await inParts(
    rows.map((r) => r.id),
    (ids) => db.select().from(schema.taskPerson).where(inArray(schema.taskPerson.taskId, ids)),
  );
  return rows.map((row) => {
    const personIds = links.filter((l) => l.taskId === row.id).map((l) => l.personId);
    const hidden = !seesInFull(viewer, row, personIds);
    return {
      id: row.id,
      title: hidden ? "" : row.title,
      notes: hidden ? "" : row.notes,
      dueDate: row.dueDate,
      dueTime: row.dueTime,
      personIds,
      private: row.private,
      hidden,
      doneAt: row.doneAt,
      repetition: row.repetition ?? null,
      seriesId: row.seriesId,
      checklistId: row.checklistId,
      parentId: row.parentId,
      entryId: row.entryId,
      importance: row.importance,
      createdAt: row.createdAt,
      changedAt: row.changedAt,
    };
  });
}

async function presentOne(db: Db, id: string, viewer: Account) {
  const rows = await db.select().from(schema.task).where(eq(schema.task.id, id));
  return (await present(db, rows, viewer))[0];
}

/** Whether this Account may change, tick or delete the Task: not when it is Private and hidden from it. */
export async function mayChangeTask(db: Db, viewer: Account, row: TaskRow) {
  if (!row.private) return true;
  const links = await db
    .select({ personId: schema.taskPerson.personId })
    .from(schema.taskPerson)
    .where(eq(schema.taskPerson.taskId, row.id));
  return seesInFull(
    viewer,
    row,
    links.map((l) => l.personId),
  );
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
  return c.json(await present(db, rows, c.get("account")));
});

taskRoutes.get("/tasks/:id", async (c) => {
  const task = await presentOne(c.get("db"), c.req.param("id"), c.get("account"));
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
    db.insert(schema.task).values({
      id,
      ...fields,
      createdBy: c.get("account").id,
      createdAt: now,
      changedAt: now,
    }),
    ...personLinks(db, id, personIds),
  ]);
  // A new undone item unticks the items holding it.
  if (fields.checklistId) await settleChecklist(db, fields.checklistId, now);
  // Items inside a task aren't announced, only the task itself.
  if (!fields.parentId) {
    announceLater(c, { kind: "task", id, title: fields.title, private: fields.private, personIds });
  }
  return c.json(await presentOne(db, id, c.get("account")), 201);
});

taskRoutes.put("/tasks/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [existing] = await db.select().from(schema.task).where(eq(schema.task.id, id));
  if (!existing) return c.json({ error: "not_found" }, 404);
  if (!(await mayChangeTask(db, c.get("account"), existing)))
    return c.json({ error: "private" }, 403);
  const parsed = await parseTask(db, await c.req.json().catch(() => ({})));
  if (!parsed.values) return c.json({ error: "invalid", field: parsed.field }, 400);
  const { personIds, ...fields } = parsed.values;
  if (fields.checklistId) {
    const items = await db
      .select({ id: schema.task.id, parentId: schema.task.parentId, doneAt: schema.task.doneAt })
      .from(schema.task)
      .where(eq(schema.task.checklistId, fields.checklistId));
    if (wouldNestInItself(items, id, fields.parentId)) {
      return c.json({ error: "invalid", field: "parentId" }, 400);
    }
  }
  // Items inside an item that leaves its Checklist go with it.
  const inside =
    existing.checklistId && existing.checklistId !== fields.checklistId
      ? await db
          .select({ id: schema.task.id })
          .from(schema.task)
          .where(eq(schema.task.parentId, id))
      : [];
  if (inside.length > 0) return c.json({ error: "invalid", field: "checklistId" }, 400);
  const now = c.get("now").toISOString();
  await db.batch([
    db
      .update(schema.task)
      .set({ ...fields, changedAt: now })
      .where(eq(schema.task.id, id)),
    db.delete(schema.taskPerson).where(eq(schema.taskPerson.taskId, id)),
    ...personLinks(db, id, personIds),
  ]);
  for (const checklistId of new Set([existing.checklistId, fields.checklistId])) {
    if (checklistId) await settleChecklist(db, checklistId, now);
  }
  return c.json(await presentOne(db, id, c.get("account")));
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
  if (!(await mayChangeTask(db, c.get("account"), existing)))
    return c.json({ error: "private" }, 403);
  // An item ticks everything inside it, and the items holding it once all their items are done.
  if (existing.checklistId) {
    await settleChecklist(db, existing.checklistId, c.get("now").toISOString(), {
      id,
      done: true,
    });
    return c.json(await presentOne(db, id, c.get("account")));
  }
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
          createdBy: existing.createdBy,
          importance: existing.importance,
          entryId: existing.entryId,
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
  return c.json(await presentOne(db, id, c.get("account")));
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
  if (!(await mayChangeTask(db, c.get("account"), existing)))
    return c.json({ error: "private" }, 403);
  if (existing.checklistId) {
    await settleChecklist(db, existing.checklistId, c.get("now").toISOString(), {
      id,
      done: false,
    });
    return c.json(await presentOne(db, id, c.get("account")));
  }
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
  return c.json(await presentOne(db, id, c.get("account")));
});

/**
 * Deleting is for good, with the items inside; nightly Backups are the safety net. The items
 * that held it are done if everything left in them is.
 */
taskRoutes.delete("/tasks/:id", async (c) => {
  const db = c.get("db");
  const [existing] = await db
    .select()
    .from(schema.task)
    .where(eq(schema.task.id, c.req.param("id")));
  if (existing && !(await mayChangeTask(db, c.get("account"), existing))) {
    return c.json({ error: "private" }, 403);
  }
  const deleted = await db
    .delete(schema.task)
    .where(eq(schema.task.id, c.req.param("id")))
    .returning({ id: schema.task.id, checklistId: schema.task.checklistId });
  if (deleted.length === 0) return c.json({ error: "not_found" }, 404);
  const { checklistId } = deleted[0];
  if (checklistId) await settleChecklist(db, checklistId, c.get("now").toISOString());
  return c.body(null, 204);
});

/**
 * Puts a loose Task into a Checklist (ADR 0006). "move": the Task becomes one of its items,
 * losing its date, time, Repetition and Private, and goes to the end of the list. "duplicate":
 * a new item with the same title and Persons; the Task stays as it is.
 */
taskRoutes.post("/tasks/:id/checklist", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.mode !== "move" && body.mode !== "duplicate") {
    return c.json({ error: "invalid", field: "mode" }, 400);
  }
  const [existing] = await db.select().from(schema.task).where(eq(schema.task.id, id));
  if (!existing) return c.json({ error: "not_found" }, 404);
  if (!(await mayChangeTask(db, c.get("account"), existing)))
    return c.json({ error: "private" }, 403);
  if (existing.checklistId) return c.json({ error: "already_in_checklist" }, 409);
  const checklistId = typeof body.checklistId === "string" ? body.checklistId : "";
  const [checklist] = await db
    .select({ id: schema.checklist.id })
    .from(schema.checklist)
    .where(eq(schema.checklist.id, checklistId));
  if (!checklist) return c.json({ error: "invalid", field: "checklistId" }, 400);
  const now = c.get("now").toISOString();
  if (body.mode === "move") {
    await db
      .update(schema.task)
      .set({
        checklistId,
        parentId: null,
        dueDate: null,
        dueTime: null,
        repetition: null,
        private: false,
        entryId: null,
        // Items are listed in the order they were added.
        createdAt: now,
        changedAt: now,
      })
      .where(eq(schema.task.id, id));
    return c.json(await presentOne(db, id, c.get("account")));
  }
  const links = await db
    .select({ personId: schema.taskPerson.personId })
    .from(schema.taskPerson)
    .where(eq(schema.taskPerson.taskId, id));
  const copyId = randomId();
  await db.batch([
    db.insert(schema.task).values({
      id: copyId,
      title: existing.title,
      checklistId,
      createdAt: now,
      changedAt: now,
    }),
    ...personLinks(
      db,
      copyId,
      links.map((l) => l.personId),
    ),
  ]);
  return c.json(await presentOne(db, copyId, c.get("account")), 201);
});
