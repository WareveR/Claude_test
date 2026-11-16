import { and, asc, eq, gte, lte } from "drizzle-orm";
import { Hono } from "hono";
import { isMealSlot, type Meal } from "../../core/meal-plan";
import { daysBetween, isPlainDate } from "../../core/plain-date";
import { randomId } from "../auth/crypto";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

/** The most days one request may ask for: two months and a bit, enough for any view. */
const MAX_SPAN_DAYS = 62;

type Row = typeof schema.meal.$inferSelect;

function present(row: Row): Meal {
  return {
    id: row.id,
    date: row.date,
    slot: row.slot as Meal["slot"],
    recipeId: row.recipeId,
    text: row.text,
    servings: row.servings,
    createdAt: row.createdAt,
    changedAt: row.changedAt,
  };
}

/**
 * The weekly meal plan: one Meal per day and slot, free text or a Recipe. Never on the calendar
 * as Entries. Each request is one or two simple queries.
 */
export const mealRoutes = new Hono<AppEnv>().use(requireDevice);

mealRoutes.get("/meals", async (c) => {
  const from = c.req.query("from") ?? "";
  const to = c.req.query("to") ?? "";
  if (
    !isPlainDate(from) ||
    !isPlainDate(to) ||
    from > to ||
    daysBetween(from, to) >= MAX_SPAN_DAYS
  ) {
    return c.json({ error: "invalid" }, 400);
  }
  const rows = await c
    .get("db")
    .select()
    .from(schema.meal)
    .where(and(gte(schema.meal.date, from), lte(schema.meal.date, to)))
    .orderBy(asc(schema.meal.date));
  // "dinner" sorts before "lunch" as text, so the slots are put in order here.
  return c.json(rows.map(present).sort(byDateAndSlot));
});

function byDateAndSlot(a: Meal, b: Meal) {
  return a.date < b.date
    ? -1
    : a.date > b.date
      ? 1
      : a.slot === b.slot
        ? 0
        : a.slot === "lunch"
          ? -1
          : 1;
}

mealRoutes.put("/meals/:date/:slot", async (c) => {
  const db = c.get("db");
  const date = c.req.param("date");
  const slot = c.req.param("slot");
  if (!isPlainDate(date)) return c.json({ error: "invalid", field: "date" }, 400);
  if (!isMealSlot(slot)) return c.json({ error: "invalid", field: "slot" }, 400);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const recipeId = body.recipeId ?? null;
  if (recipeId !== null && (typeof recipeId !== "string" || recipeId.length > 64)) {
    return c.json({ error: "invalid", field: "recipeId" }, 400);
  }
  if (typeof body.text !== "string" || body.text.length > 200) {
    return c.json({ error: "invalid", field: "text" }, 400);
  }
  const servings = body.servings ?? null;
  if (
    servings !== null &&
    !(typeof servings === "number" && Number.isInteger(servings) && servings >= 1 && servings <= 50)
  ) {
    return c.json({ error: "invalid", field: "servings" }, 400);
  }
  let text = body.text.trim();
  if (recipeId !== null) {
    const [recipe] = await db
      .select({ name: schema.recipe.name })
      .from(schema.recipe)
      .where(eq(schema.recipe.id, recipeId));
    if (!recipe) return c.json({ error: "invalid", field: "recipeId" }, 400);
    // The Recipe's name is kept with the Meal, so it still reads after the Recipe is deleted.
    text = recipe.name;
  } else if (text === "") {
    return c.json({ error: "invalid", field: "text" }, 400);
  }
  const now = c.get("now").toISOString();
  const [row] = await db
    .insert(schema.meal)
    .values({
      id: randomId(),
      date,
      slot,
      recipeId,
      text,
      servings,
      createdAt: now,
      changedAt: now,
    })
    .onConflictDoUpdate({
      target: [schema.meal.date, schema.meal.slot],
      set: { recipeId, text, servings, changedAt: now },
    })
    .returning();
  return c.json(present(row));
});

mealRoutes.delete("/meals/:date/:slot", async (c) => {
  const deleted = await c
    .get("db")
    .delete(schema.meal)
    .where(
      and(eq(schema.meal.date, c.req.param("date")), eq(schema.meal.slot, c.req.param("slot"))),
    )
    .returning({ id: schema.meal.id });
  if (deleted.length === 0) return c.json({ error: "not_found" }, 404);
  return c.body(null, 204);
});
