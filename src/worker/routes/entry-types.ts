import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import {
  BUILT_IN_DEFAULTS,
  BUILT_IN_TYPES,
  ICONS,
  IMPORTANCES,
  UNDELETABLE_TYPES,
  type BuiltInType,
  type EntryTypeDefaults,
} from "../../core/entry-type";
import { isRepetition } from "../../core/repetition";
import { randomId } from "../auth/crypto";
import type { Db } from "../db";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

const COLOR = /^#[0-9a-f]{6}$/i;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Creates the seven built-in Entry Types; called once, when the Family is set up. */
export function seedBuiltInTypes(db: Db, now: string) {
  return BUILT_IN_TYPES.map((key) =>
    db.insert(schema.entryType).values({
      id: randomId(),
      builtinKey: key,
      name: null,
      color: BUILT_IN_DEFAULTS[key].color,
      icon: BUILT_IN_DEFAULTS[key].icon,
      thumbnailKey: null,
      defaults: BUILT_IN_DEFAULTS[key].defaults,
      createdAt: now,
      changedAt: now,
    }),
  );
}

function parseDefaults(value: unknown): EntryTypeDefaults | null {
  if (typeof value !== "object" || value === null) return null;
  const d = value as Record<string, unknown>;
  const out: EntryTypeDefaults = {};
  if (d.allDay !== undefined) out.allDay = Boolean(d.allDay);
  if (d.startTime !== undefined && d.startTime !== null) {
    if (typeof d.startTime !== "string" || !TIME.test(d.startTime)) return null;
    out.startTime = d.startTime;
  }
  if (d.durationMinutes !== undefined && d.durationMinutes !== null) {
    if (!Number.isInteger(d.durationMinutes) || (d.durationMinutes as number) < 0) return null;
    out.durationMinutes = d.durationMinutes as number;
  }
  if (d.repetition !== undefined && d.repetition !== null) {
    if (!isRepetition(d.repetition)) return null;
    out.repetition = d.repetition;
  }
  if (d.importance !== undefined) {
    if (!IMPORTANCES.includes(d.importance as never)) return null;
    out.importance = d.importance as EntryTypeDefaults["importance"];
  }
  for (const key of ["location", "notes"] as const) {
    if (d[key] !== undefined && d[key] !== null && d[key] !== "") {
      if (typeof d[key] !== "string") return null;
      out[key] = d[key] as string;
    }
  }
  if (d.personIds !== undefined) {
    if (!Array.isArray(d.personIds) || !d.personIds.every((p) => typeof p === "string"))
      return null;
    out.personIds = d.personIds;
  }
  if (d.reminders !== undefined) {
    if (!Array.isArray(d.reminders) || !d.reminders.every((r) => Number.isInteger(r) && r >= 0))
      return null;
    out.reminders = [...new Set(d.reminders as number[])].sort((a, b) => b - a);
  }
  return out;
}

type TypeFields = Partial<typeof schema.entryType.$inferInsert>;

function parseType(body: Record<string, unknown>, partial: boolean) {
  const out: TypeFields = {};
  if ("name" in body || !partial) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name && !partial) return { field: "name" };
    out.name = name || null;
  }
  if ("color" in body || !partial) {
    if (typeof body.color !== "string" || !COLOR.test(body.color)) return { field: "color" };
    out.color = body.color.toLowerCase();
  }
  if ("icon" in body) {
    if (body.icon !== null && !ICONS.includes(body.icon as never)) return { field: "icon" };
    out.icon = body.icon as string | null;
  }
  if ("thumbnailKey" in body) {
    if (body.thumbnailKey !== null && typeof body.thumbnailKey !== "string") {
      return { field: "thumbnailKey" };
    }
    out.thumbnailKey = body.thumbnailKey as string | null;
  }
  if ("defaults" in body || !partial) {
    const defaults = parseDefaults(body.defaults ?? {});
    if (!defaults) return { field: "defaults" };
    out.defaults = defaults;
  }
  return { values: out };
}

function present(row: typeof schema.entryType.$inferSelect) {
  return {
    id: row.id,
    builtinKey: row.builtinKey as BuiltInType | null,
    name: row.name,
    color: row.color,
    icon: row.icon,
    thumbnailKey: row.thumbnailKey,
    defaults: row.defaults,
    deletable: !UNDELETABLE_TYPES.includes(row.builtinKey as BuiltInType),
  };
}

/**
 * Moves the deleted type's Entries before it goes: each to the type the Family chose, the
 * rest to General. Entries register this when they arrive.
 */
export const entryTypeDeleteSteps: ((
  db: Db,
  typeId: string,
  moves: Record<string, string>,
  generalId: string,
) => Promise<void>)[] = [];

export const entryTypeRoutes = new Hono<AppEnv>().use(requireDevice);

entryTypeRoutes.get("/entry-types", async (c) => {
  const rows = await c
    .get("db")
    .select()
    .from(schema.entryType)
    .orderBy(asc(schema.entryType.createdAt), asc(schema.entryType.id));
  const order = (key: string | null) =>
    key ? BUILT_IN_TYPES.indexOf(key as BuiltInType) : BUILT_IN_TYPES.length;
  return c.json(rows.sort((a, b) => order(a.builtinKey) - order(b.builtinKey)).map(present));
});

entryTypeRoutes.post("/entry-types", async (c) => {
  const parsed = parseType(await c.req.json().catch(() => ({})), false);
  if (!parsed.values) return c.json({ error: "invalid", field: parsed.field }, 400);
  const now = c.get("now").toISOString();
  const [row] = await c
    .get("db")
    .insert(schema.entryType)
    .values({
      id: randomId(),
      builtinKey: null,
      name: parsed.values.name!,
      color: parsed.values.color!,
      icon: parsed.values.icon ?? "calendar",
      thumbnailKey: parsed.values.thumbnailKey ?? null,
      defaults: parsed.values.defaults!,
      createdAt: now,
      changedAt: now,
    })
    .returning();
  return c.json(present(row), 201);
});

entryTypeRoutes.patch("/entry-types/:id", async (c) => {
  const parsed = parseType(await c.req.json().catch(() => ({})), true);
  if (!parsed.values) return c.json({ error: "invalid", field: parsed.field }, 400);
  const [row] = await c
    .get("db")
    .update(schema.entryType)
    .set({ ...parsed.values, changedAt: c.get("now").toISOString() })
    .where(eq(schema.entryType.id, c.req.param("id")))
    .returning();
  if (!row) return c.json({ error: "not_found" }, 404);
  if (!row.builtinKey && !row.name) return c.json({ error: "invalid", field: "name" }, 400);
  return c.json(present(row));
});

entryTypeRoutes.delete("/entry-types/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [row] = await db.select().from(schema.entryType).where(eq(schema.entryType.id, id));
  if (!row) return c.json({ error: "not_found" }, 404);
  if (UNDELETABLE_TYPES.includes(row.builtinKey as BuiltInType)) {
    return c.json({ error: "type_undeletable" }, 409);
  }
  const body = await c.req.json().catch(() => ({}));
  const moves: Record<string, string> =
    typeof body.moves === "object" && body.moves !== null ? body.moves : {};
  const [general] = await db
    .select()
    .from(schema.entryType)
    .where(eq(schema.entryType.builtinKey, "general"));
  for (const step of entryTypeDeleteSteps) await step(db, id, moves, general.id);
  await db.delete(schema.entryType).where(eq(schema.entryType.id, id));
  return c.body(null, 204);
});
