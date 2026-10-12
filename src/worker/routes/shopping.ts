import { desc, eq, gte, isNotNull, isNull, or } from "drizzle-orm";
import { Hono } from "hono";
import { rankSuggestions } from "../../core/shopping";
import { randomId } from "../auth/crypto";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

const MAX_TEXT = 200;
/** Ids a device may pick itself, so its new item shows (and can be ticked) before the answer. */
const ID = /^[A-Za-z0-9_-]{8,64}$/;
/** Bought items come back for two days; the browser keeps those of today in the Family Time Zone. */
const RECENT_MS = 2 * 86_400_000;
/** How many bought items the history lists. */
const HISTORY = 60;

type Fields = { name?: string; quantity?: string; note?: string; store?: string };

/** The text fields present in the body, trimmed; the bad field's name when one isn't text. */
function parseFields(body: Record<string, unknown>, needName: boolean) {
  const values: Fields = {};
  for (const field of ["name", "quantity", "note", "store"] as const) {
    if (body[field] === undefined) continue;
    const value = body[field];
    if (typeof value !== "string" || value.trim().length > MAX_TEXT) return { field };
    values[field] = value.trim();
  }
  if ((needName || values.name !== undefined) && !values.name) return { field: "name" };
  return { values };
}

function present(row: typeof schema.shoppingItem.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    note: row.note,
    store: row.store,
    boughtAt: row.boughtAt,
    createdAt: row.createdAt,
    changedAt: row.changedAt,
  };
}

/** The Family's one Shopping List: no dates, never on the calendar. */
export const shoppingRoutes = new Hono<AppEnv>().use(requireDevice);

/** What is still to buy, and what was bought lately (the browser keeps today's). */
shoppingRoutes.get("/shopping/items", async (c) => {
  const db = c.get("db");
  const since = new Date(c.get("now").getTime() - RECENT_MS).toISOString();
  const rows = await db
    .select()
    .from(schema.shoppingItem)
    .where(or(isNull(schema.shoppingItem.boughtAt), gte(schema.shoppingItem.boughtAt, since)))
    .orderBy(schema.shoppingItem.createdAt);
  return c.json(rows.map(present));
});

/**
 * The history: every name ever added, most often first, with its latest shop; the shops used;
 * and the latest bought items.
 */
shoppingRoutes.get("/shopping/history", async (c) => {
  const db = c.get("db");
  const all = await db
    .select({
      name: schema.shoppingItem.name,
      store: schema.shoppingItem.store,
      createdAt: schema.shoppingItem.createdAt,
    })
    .from(schema.shoppingItem);
  const bought = await db
    .select()
    .from(schema.shoppingItem)
    .where(isNotNull(schema.shoppingItem.boughtAt))
    .orderBy(desc(schema.shoppingItem.boughtAt))
    .limit(HISTORY);
  const stores = rankSuggestions(
    all.filter((i) => i.store.trim()).map((i) => ({ ...i, name: i.store })),
  ).map((s) => s.name);
  return c.json({ suggestions: rankSuggestions(all), stores, bought: bought.map(present) });
});

shoppingRoutes.post("/shopping/items", async (c) => {
  const db = c.get("db");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseFields(body, true);
  if (!parsed.values) return c.json({ error: "invalid", field: parsed.field }, 400);
  const id = body.id ?? randomId();
  if (typeof id !== "string" || !ID.test(id)) return c.json({ error: "invalid", field: "id" }, 400);
  const [taken] = await db
    .select({ id: schema.shoppingItem.id })
    .from(schema.shoppingItem)
    .where(eq(schema.shoppingItem.id, id));
  if (taken) return c.json({ error: "conflict" }, 409);
  const now = c.get("now").toISOString();
  const [row] = await db
    .insert(schema.shoppingItem)
    .values({ ...parsed.values, name: parsed.values.name!, id, createdAt: now, changedAt: now })
    .returning();
  return c.json(present(row), 201);
});

/**
 * Changes an item's name, quantity, note or shop, and ticks it bought (`bought: true`, keeping
 * the first time) or back to buy (`bought: false`).
 */
shoppingRoutes.patch("/shopping/items/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseFields(body, false);
  if (!parsed.values) return c.json({ error: "invalid", field: parsed.field }, 400);
  if (body.bought !== undefined && typeof body.bought !== "boolean") {
    return c.json({ error: "invalid", field: "bought" }, 400);
  }
  const [existing] = await db
    .select()
    .from(schema.shoppingItem)
    .where(eq(schema.shoppingItem.id, id));
  if (!existing) return c.json({ error: "not_found" }, 404);
  const now = c.get("now").toISOString();
  const boughtAt =
    body.bought === undefined ? existing.boughtAt : body.bought ? (existing.boughtAt ?? now) : null;
  const [row] = await db
    .update(schema.shoppingItem)
    .set({ ...parsed.values, boughtAt, changedAt: now })
    .where(eq(schema.shoppingItem.id, id))
    .returning();
  return c.json(present(row));
});

/** Deleting is for good, and the name is no longer suggested from it. */
shoppingRoutes.delete("/shopping/items/:id", async (c) => {
  const deleted = await c
    .get("db")
    .delete(schema.shoppingItem)
    .where(eq(schema.shoppingItem.id, c.req.param("id")))
    .returning({ id: schema.shoppingItem.id });
  if (deleted.length === 0) return c.json({ error: "not_found" }, 404);
  return c.body(null, 204);
});
