import { asc, eq, isNotNull } from "drizzle-orm";
import { Hono } from "hono";
import {
  BUILT_IN_TEMPLATES,
  cleanItems,
  MAX_TEMPLATE_TEXT,
  type BuiltInTemplate,
} from "../../core/checklist-template";
import { randomId } from "../auth/crypto";
import type { Db } from "../db";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

type TemplateRow = typeof schema.checklistTemplate.$inferSelect;

function builtInRow(key: BuiltInTemplate, now: string) {
  return {
    id: randomId(),
    builtinKey: key,
    name: null,
    items: null,
    createdAt: now,
    changedAt: now,
  };
}

/** Creates the built-in Checklist templates; called once, when the Family is set up. */
export function seedBuiltInTemplates(db: Db, now: string) {
  return BUILT_IN_TEMPLATES.map((key) =>
    db.insert(schema.checklistTemplate).values(builtInRow(key, now)),
  );
}

function present(row: TemplateRow) {
  return {
    id: row.id,
    builtinKey: row.builtinKey as BuiltInTemplate | null,
    name: row.name,
    items: row.items ?? null,
    createdAt: row.createdAt,
    changedAt: row.changedAt,
  };
}

/** Built-in templates first in their own order, then the Family's own, oldest first. */
async function listTemplates(db: Db) {
  const rows = await db
    .select()
    .from(schema.checklistTemplate)
    .orderBy(asc(schema.checklistTemplate.createdAt), asc(schema.checklistTemplate.id));
  const order = (key: string | null) =>
    key ? BUILT_IN_TEMPLATES.indexOf(key as BuiltInTemplate) : BUILT_IN_TEMPLATES.length;
  return rows.sort((a, b) => order(a.builtinKey) - order(b.builtinKey)).map(present);
}

/**
 * A template's name and items. A built-in one may send null for either to keep reading it in
 * each device's language; a custom one needs a name.
 */
function parseTemplate(body: Record<string, unknown>, builtIn: boolean) {
  let name: string | null = null;
  if (body.name !== null && body.name !== undefined) {
    if (typeof body.name !== "string") return { field: "name" };
    name = body.name.trim() || null;
  }
  if ((!name && !builtIn) || (name && name.length > MAX_TEMPLATE_TEXT)) return { field: "name" };
  let items: string[] | null = null;
  if (body.items !== null && body.items !== undefined) {
    items = cleanItems(body.items);
    if (!items) return { field: "items" };
  } else if (!builtIn) items = [];
  return { values: { name, items } };
}

export const checklistTemplateRoutes = new Hono<AppEnv>().use(requireDevice);

checklistTemplateRoutes.get("/checklist-templates", async (c) => {
  return c.json(await listTemplates(c.get("db")));
});

checklistTemplateRoutes.post("/checklist-templates", async (c) => {
  const parsed = parseTemplate(await c.req.json().catch(() => ({})), false);
  if (!parsed.values) return c.json({ error: "invalid", field: parsed.field }, 400);
  const now = c.get("now").toISOString();
  const [row] = await c
    .get("db")
    .insert(schema.checklistTemplate)
    .values({ id: randomId(), builtinKey: null, ...parsed.values, createdAt: now, changedAt: now })
    .returning();
  return c.json(present(row), 201);
});

checklistTemplateRoutes.put("/checklist-templates/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [existing] = await db
    .select()
    .from(schema.checklistTemplate)
    .where(eq(schema.checklistTemplate.id, id));
  if (!existing) return c.json({ error: "not_found" }, 404);
  const parsed = parseTemplate(await c.req.json().catch(() => ({})), Boolean(existing.builtinKey));
  if (!parsed.values) return c.json({ error: "invalid", field: parsed.field }, 400);
  const [row] = await db
    .update(schema.checklistTemplate)
    .set({ ...parsed.values, changedAt: c.get("now").toISOString() })
    .where(eq(schema.checklistTemplate.id, id))
    .returning();
  return c.json(present(row));
});

/** Any template can go, built-in ones too; "Restore defaults" brings those back. */
checklistTemplateRoutes.delete("/checklist-templates/:id", async (c) => {
  const deleted = await c
    .get("db")
    .delete(schema.checklistTemplate)
    .where(eq(schema.checklistTemplate.id, c.req.param("id")))
    .returning({ id: schema.checklistTemplate.id });
  if (deleted.length === 0) return c.json({ error: "not_found" }, 404);
  return c.body(null, 204);
});

/**
 * Brings back deleted built-in templates and resets edited ones to their defaults; the
 * Family's own templates stay as they are.
 */
checklistTemplateRoutes.post("/checklist-templates/restore-defaults", async (c) => {
  const db = c.get("db");
  const now = c.get("now").toISOString();
  const builtIn = await db
    .select()
    .from(schema.checklistTemplate)
    .where(isNotNull(schema.checklistTemplate.builtinKey));
  const kept = new Set(builtIn.map((row) => row.builtinKey));
  const missing = BUILT_IN_TEMPLATES.filter((key) => !kept.has(key));
  const edited = builtIn.filter((row) => row.name !== null || row.items !== null);
  const writes = [
    ...missing.map((key) => db.insert(schema.checklistTemplate).values(builtInRow(key, now))),
    ...edited.map((row) =>
      db
        .update(schema.checklistTemplate)
        .set({ name: null, items: null, changedAt: now })
        .where(eq(schema.checklistTemplate.id, row.id)),
    ),
  ];
  const [first, ...rest] = writes;
  if (first) await db.batch([first, ...rest]);
  return c.json(await listTemplates(db));
});
