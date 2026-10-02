import { asc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { isPlainDate } from "../../core/plain-date";
import { randomId } from "../auth/crypto";
import type { Db } from "../db";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";
import { personMentionChecks } from "./persons";

type ChecklistRow = typeof schema.checklist.$inferSelect;

/** Validates a whole Checklist; returns the bad field's name or the clean values. */
async function parseChecklist(db: Db, body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { field: "name" };
  const date = (v: unknown) => (v === null || v === undefined ? null : v);
  const startDate = date(body.startDate);
  const endDate = date(body.endDate);
  for (const [field, value] of [
    ["startDate", startDate],
    ["endDate", endDate],
  ] as const) {
    if (value !== null && (typeof value !== "string" || !isPlainDate(value))) return { field };
  }
  if (startDate && (!endDate || (endDate as string) < (startDate as string))) {
    return { field: "endDate" };
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
      name,
      startDate: startDate as string | null,
      endDate: endDate as string | null,
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
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    startDate: row.startDate,
    endDate: row.endDate,
    personIds: links.filter((l) => l.checklistId === row.id).map((l) => l.personId),
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

export const checklistRoutes = new Hono<AppEnv>().use(requireDevice);

checklistRoutes.get("/checklists", async (c) => {
  const db = c.get("db");
  const rows = await db.select().from(schema.checklist).orderBy(asc(schema.checklist.name));
  return c.json(await present(db, rows));
});

checklistRoutes.get("/checklists/:id", async (c) => {
  const checklist = await presentOne(c.get("db"), c.req.param("id"));
  if (!checklist) return c.json({ error: "not_found" }, 404);
  return c.json(checklist);
});

checklistRoutes.post("/checklists", async (c) => {
  const db = c.get("db");
  const parsed = await parseChecklist(db, await c.req.json().catch(() => ({})));
  if (!parsed.values) return c.json({ error: "invalid", field: parsed.field }, 400);
  const { personIds, ...fields } = parsed.values;
  const id = randomId();
  const now = c.get("now").toISOString();
  await db.batch([
    db.insert(schema.checklist).values({ id, ...fields, createdAt: now, changedAt: now }),
    ...personLinks(db, id, personIds),
  ]);
  return c.json(await presentOne(db, id), 201);
});

checklistRoutes.put("/checklists/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [existing] = await db.select().from(schema.checklist).where(eq(schema.checklist.id, id));
  if (!existing) return c.json({ error: "not_found" }, 404);
  const parsed = await parseChecklist(db, await c.req.json().catch(() => ({})));
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

/** Deleting a Checklist deletes its Tasks too, for good. */
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
