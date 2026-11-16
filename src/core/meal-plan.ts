import { addDays, startOfWeek, type PlainDate } from "./plain-date";
import { searchRecipes, type Recipe } from "./recipe";

/** The slots of a day, in the order they are eaten. */
export const MEAL_SLOTS = ["lunch", "dinner"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

/** One planned dish: a Recipe, or only free text, in one slot of one day. */
export interface Meal {
  id: string;
  date: PlainDate;
  slot: MealSlot;
  recipeId: string | null;
  /** Free text, or the Recipe's name as it was when planned. */
  text: string;
  servings: number | null;
  createdAt: string;
  changedAt: string;
}

export function isMealSlot(value: string): value is MealSlot {
  return (MEAL_SLOTS as readonly string[]).includes(value);
}

/** The seven days, Monday to Sunday, of the week the date falls in (as the week view). */
export function weekOf(date: PlainDate): PlainDate[] {
  const monday = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** The latest planned date of each Recipe. */
export function lastPlanned(meals: Pick<Meal, "recipeId" | "date">[]): Map<string, PlainDate> {
  const last = new Map<string, PlainDate>();
  for (const { recipeId, date } of meals) {
    if (recipeId === null) continue;
    const seen = last.get(recipeId);
    if (seen === undefined || date > seen) last.set(recipeId, date);
  }
  return last;
}

/**
 * The Recipes matching the query, in the order to offer them for a slot: never planned first,
 * then the ones planned longest ago; favourites, then name, break ties (the order of the search).
 */
export function rankForPicker(
  recipes: Recipe[],
  meals: Pick<Meal, "recipeId" | "date">[],
  query: string,
  label?: (tag: string) => string,
): Recipe[] {
  const last = lastPlanned(meals);
  // Array.sort is stable, so the search's order (favourites, then name) stays among equals.
  return searchRecipes(recipes, query, undefined, label).sort((a, b) => {
    const da = last.get(a.id) ?? "";
    const db = last.get(b.id) ?? "";
    return da < db ? -1 : da > db ? 1 : 0;
  });
}
