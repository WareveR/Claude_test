import { eq, isNotNull } from "drizzle-orm";
import { Hono } from "hono";
import type { Ingredient } from "../../core/recipe";
import { randomId } from "../auth/crypto";
import type { Db } from "../db";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

/** Ids a device may pick itself, so its new Recipe shows before the answer. */
const ID = /^[A-Za-z0-9_-]{8,64}$/;

type Row = typeof schema.recipe.$inferSelect;
type Fields = Partial<
  Pick<
    Row,
    | "name"
    | "servings"
    | "minutes"
    | "steps"
    | "source"
    | "notes"
    | "photoKey"
    | "favourite"
    | "tags"
    | "ingredients"
  >
>;

const isText = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
const isCount = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

function validIngredient(v: unknown): v is Ingredient {
  if (typeof v !== "object" || v === null) return false;
  const i = v as Record<string, unknown>;
  const name = typeof i.name === "string" ? i.name.trim() : "";
  return (
    name.length >= 1 &&
    name.length <= 200 &&
    isText(i.unit, 40) &&
    (i.quantity === null ||
      (typeof i.quantity === "number" &&
        Number.isFinite(i.quantity) &&
        i.quantity >= 0 &&
        i.quantity <= 100_000)) &&
    typeof i.pantry === "boolean"
  );
}

/** The fields present in the body, checked and ready to store; the bad field's name when one isn't right. */
function parseFields(body: Record<string, unknown>, needName: boolean) {
  const out: Fields = {};
  if (body.name !== undefined || needName) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 1 || name.length > 200) return { field: "name" };
    out.name = name;
  }
  if (body.servings !== undefined) {
    if (!isCount(body.servings, 1, 50)) return { field: "servings" };
    out.servings = body.servings;
  }
  if (body.minutes !== undefined) {
    if (body.minutes !== null && !isCount(body.minutes, 1, 2000)) return { field: "minutes" };
    out.minutes = body.minutes;
  }
  if (body.tags !== undefined) {
    const tags = body.tags;
    if (!Array.isArray(tags) || tags.length > 20 || !tags.every((t) => isText(t, 40))) {
      return { field: "tags" };
    }
    out.tags = JSON.stringify(tags);
  }
  if (body.ingredients !== undefined) {
    const list = body.ingredients;
    if (!Array.isArray(list) || list.length > 100 || !list.every(validIngredient)) {
      return { field: "ingredients" };
    }
    out.ingredients = JSON.stringify(
      list.map(({ quantity, unit, name, pantry }) => ({
        quantity,
        unit,
        name: name.trim(),
        pantry,
      })),
    );
  }
  for (const [field, max] of [
    ["steps", 20_000],
    ["source", 500],
    ["notes", 5000],
  ] as const) {
    if (body[field] === undefined) continue;
    if (!isText(body[field], max)) return { field };
    out[field] = body[field];
  }
  if (body.photoKey !== undefined) {
    if (body.photoKey !== null && !isText(body.photoKey, 200)) return { field: "photoKey" };
    out.photoKey = body.photoKey;
  }
  if (body.favourite !== undefined) {
    if (typeof body.favourite !== "boolean") return { field: "favourite" };
    out.favourite = body.favourite;
  }
  return { values: out };
}

function present(row: Row) {
  return {
    id: row.id,
    name: row.name,
    servings: row.servings,
    minutes: row.minutes,
    tags: JSON.parse(row.tags) as string[],
    ingredients: JSON.parse(row.ingredients) as Ingredient[],
    steps: row.steps,
    source: row.source,
    notes: row.notes,
    photoKey: row.photoKey,
    favourite: row.favourite,
    createdAt: row.createdAt,
    changedAt: row.changedAt,
  };
}

/** The Family's Recipe Book: no dates, never on the calendar. Searching is left to the browser. */
export const recipeRoutes = new Hono<AppEnv>().use(requireDevice);

recipeRoutes.get("/recipes", async (c) => {
  const rows = await c.get("db").select().from(schema.recipe).orderBy(schema.recipe.name);
  return c.json(rows.map(present));
});

recipeRoutes.get("/recipes/:id", async (c) => {
  const [row] = await c
    .get("db")
    .select()
    .from(schema.recipe)
    .where(eq(schema.recipe.id, c.req.param("id")));
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json(present(row));
});

recipeRoutes.post("/recipes", async (c) => {
  const db = c.get("db");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseFields(body, true);
  if (!parsed.values) return c.json({ error: "invalid", field: parsed.field }, 400);
  const id = body.id ?? randomId();
  if (typeof id !== "string" || !ID.test(id)) return c.json({ error: "invalid", field: "id" }, 400);
  const [taken] = await db
    .select({ id: schema.recipe.id })
    .from(schema.recipe)
    .where(eq(schema.recipe.id, id));
  if (taken) return c.json({ error: "conflict" }, 409);
  const now = c.get("now").toISOString();
  const [row] = await db
    .insert(schema.recipe)
    .values({ ...parsed.values, name: parsed.values.name!, id, createdAt: now, changedAt: now })
    .returning();
  return c.json(present(row), 201);
});

/** Changes only the fields sent. */
recipeRoutes.patch("/recipes/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseFields(body, false);
  if (!parsed.values) return c.json({ error: "invalid", field: parsed.field }, 400);
  const [existing] = await db
    .select({ id: schema.recipe.id })
    .from(schema.recipe)
    .where(eq(schema.recipe.id, id));
  if (!existing) return c.json({ error: "not_found" }, 404);
  const [row] = await db
    .update(schema.recipe)
    .set({ ...parsed.values, changedAt: c.get("now").toISOString() })
    .where(eq(schema.recipe.id, id))
    .returning();
  return c.json(present(row));
});

recipeRoutes.delete("/recipes/:id", async (c) => {
  const deleted = await c
    .get("db")
    .delete(schema.recipe)
    .where(eq(schema.recipe.id, c.req.param("id")))
    .returning({ id: schema.recipe.id });
  if (deleted.length === 0) return c.json({ error: "not_found" }, 404);
  return c.body(null, 204);
});

/** Photos still shown in the Recipe Book, for the nightly image clean-up. */
export async function recipePhotoKeys(db: Db): Promise<string[]> {
  const rows = await db
    .select({ key: schema.recipe.photoKey })
    .from(schema.recipe)
    .where(isNotNull(schema.recipe.photoKey));
  return rows.map((r) => r.key!);
}
