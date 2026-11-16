import type { Meal } from "./meal-plan";
import type { PlainDate } from "./plain-date";
import { fold, formatNumber, type Recipe } from "./recipe";
import type { ShoppingItem } from "./shopping";
import { SHOPPING_SECTIONS, shoppingSection } from "./shopping-sections";

/** The longest quantity or note the Shopping List keeps. */
export const MAX_SHOPPING_TEXT = 200;

/** One thing to buy for the Meals: what the Recipes need of it, summed. */
export interface MealShoppingLine {
  /** The folded name of the first spelling met; stable while the Meals stay. */
  key: string;
  /** As first written. */
  name: string;
  /** "400 g", "400 g + 1 lata", or "" when every Recipe says "q.b.". */
  quantity: string;
  /** The names of the Recipes that need it, once each, in the order of the Meals. */
  recipes: string[];
  /** Every Recipe takes it as a staple, so it is not bought unless asked for. */
  pantry: boolean;
  /** The open Shopping List item of the same name, which the quantity would be added to. */
  existing?: { id: string; quantity: string; note: string };
}

/** An amount: grams, millilitres, or a count of some other unit (or none). */
interface Part {
  kind: "mass" | "volume" | "other";
  /** For "other": the folded singular unit, "" for none. */
  unit: string;
  /** The unit as written, to show it. */
  label: string;
  value: number;
}

const MASS: Record<string, number> = { g: 1, kg: 1000 };
const VOLUME: Record<string, number> = { ml: 1, cl: 10, dl: 100, l: 1000 };

/** The first word of a unit without its plural: "colheres de sopa" and "colher de sopa" agree. */
function singularUnit(unit: string): string {
  const words = fold(unit).trim().split(/\s+/);
  const first = words[0] ?? "";
  words[0] = /eres$/.test(first) ? first.slice(0, -2) : first.replace(/s$/, "");
  return words.join(" ");
}

function isPlural(unit: string): boolean {
  const first = fold(unit).trim().split(/\s+/)[0] ?? "";
  return first !== "" && singularUnit(first) !== first;
}

function partOf(value: number, unit: string): Part {
  const u = fold(unit).trim();
  if (u in MASS) return { kind: "mass", unit: "", label: "g", value: value * MASS[u] };
  if (u in VOLUME) return { kind: "volume", unit: "", label: "ml", value: value * VOLUME[u] };
  return { kind: "other", unit: singularUnit(unit), label: unit.trim(), value };
}

const sameKind = (a: Part, b: Part) => a.kind === b.kind && a.unit === b.unit;

/** Adds the part to the first one of its kind, or appends it. */
function addPart(parts: Part[], part: Part): void {
  const found = parts.find((p) => sameKind(p, part));
  if (found) {
    found.value += part.value;
    // Several of a unit read in the plural ("2 latas"), one in the singular.
    if (found.kind === "other" && found.label !== part.label) {
      found.label = [found.label, part.label].find((l) => isPlural(l)) ?? found.label;
    }
  } else parts.push({ ...part });
}

function formatPart(part: Part, language: string): string {
  if (part.kind === "mass") {
    return part.value >= 1000
      ? `${formatNumber(part.value / 1000, language)} kg`
      : `${formatNumber(part.value, language)} g`;
  }
  if (part.kind === "volume") {
    return part.value >= 1000
      ? `${formatNumber(part.value / 1000, language)} l`
      : `${formatNumber(part.value, language)} ml`;
  }
  // Whole eggs, whole onions: a count of nothing in particular is rounded up.
  if (part.unit === "") return formatNumber(Math.ceil(part.value - 1e-9), language);
  const unit = part.value > 1 && !isPlural(part.label) ? pluralised(part.label) : part.label;
  return `${formatNumber(part.value, language)} ${unit}`;
}

/** The unit in the plural ("lata" to "latas", "colher de sopa" to "colheres de sopa"). */
function pluralised(label: string): string {
  const [first = "", ...rest] = label.trim().split(" ");
  const plural = /^(tbsp|tsp)$/.test(first)
    ? first
    : first === "pinch"
      ? "pinches"
      : first.endsWith("r")
        ? `${first}es`
        : first.endsWith("m")
          ? `${first.slice(0, -1)}ns`
          : `${first}s`;
  return [plural, ...rest].join(" ");
}

function formatParts(parts: Part[], language: string): string {
  return parts
    .filter((p) => p.value > 0)
    .map((p) => formatPart(p, language))
    .join(" + ");
}

/** Reads "400 g", "2,5 kg", "3", "1 lata + 2 kg" into parts; null when any piece isn't a number. */
function parseParts(text: string): Part[] | null {
  const parts: Part[] = [];
  for (const piece of text.split("+")) {
    const m = /^\s*(\d+(?:[.,]\d+)?)\s*(.*?)\s*$/.exec(piece);
    if (!m) return null;
    addPart(parts, partOf(Number(m[1].replace(",", ".")), m[2]));
  }
  return parts;
}

/**
 * The quantity of an open Shopping List item with more added: "2 kg" and "400 g" make "2,4 kg";
 * quantities that are not numbers of a unit that adds up are joined with " + ".
 */
export function mergeQuantity(existing: string, added: string, language = "pt-PT"): string {
  const a = existing.trim();
  const b = added.trim();
  if (!a) return b;
  if (!b) return a;
  const left = parseParts(a);
  const right = parseParts(b);
  if (!left || !right) return `${a} + ${b}`;
  for (const part of right) addPart(left, part);
  return formatParts(left, language);
}

/** The note with the Recipe names added once each, as far as the note can hold. */
export function mergeNote(existing: string, recipes: string[]): string {
  const names = existing
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  for (const name of recipes) {
    if (!names.some((n) => fold(n) === fold(name))) names.push(name);
  }
  return names.join(", ").slice(0, MAX_SHOPPING_TEXT).trim();
}

/** Names compared as the Shopping List does, a plural "s" ("cebolas") not telling them apart. */
function nameKey(name: string): string {
  return fold(name)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function singularKey(key: string): string {
  return key
    .split(" ")
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w))
    .join(" ");
}

const sameName = (a: string, b: string) => a === b || singularKey(a) === singularKey(b);

/**
 * The dates the Meals are bought for: from today to Sunday in the current week, else the
 * whole week shown (a week ahead; a past week is rare).
 */
export function shoppingDates(week: PlainDate[], today: PlainDate): PlainDate[] {
  const current = week.length > 0 && week[0] <= today && today <= week[week.length - 1];
  return current ? week.filter((d) => d >= today) : week;
}

/**
 * What to buy for the Meals, a line per ingredient: each Recipe's quantities scaled to the
 * Meal's servings, the same ingredient of several Recipes summed (g and kg, ml and l add up;
 * other units add only to the same unit, else the parts are joined with " + "). Free-text
 * Meals and deleted Recipes add nothing. Staples come last, and a line says when an open item
 * of the Shopping List has the same name.
 */
export function shoppingFromMeals(
  meals: Pick<Meal, "recipeId" | "servings">[],
  recipes: Pick<Recipe, "id" | "name" | "servings" | "ingredients">[],
  openItems: Pick<ShoppingItem, "id" | "name" | "quantity" | "note" | "boughtAt">[],
  language = "pt-PT",
): MealShoppingLine[] {
  const groups: { key: string; name: string; parts: Part[]; recipes: string[]; pantry: boolean }[] =
    [];
  for (const meal of meals) {
    const recipe = recipes.find((r) => r.id === meal.recipeId);
    if (!recipe) continue;
    const factor = recipe.servings > 0 ? (meal.servings ?? recipe.servings) / recipe.servings : 1;
    for (const ing of recipe.ingredients) {
      const key = nameKey(ing.name);
      if (!key) continue;
      let group = groups.find((g) => sameName(g.key, key));
      if (!group) {
        group = { key, name: ing.name.trim(), parts: [], recipes: [], pantry: true };
        groups.push(group);
      }
      if (ing.quantity !== null) addPart(group.parts, partOf(ing.quantity * factor, ing.unit));
      if (!group.recipes.includes(recipe.name)) group.recipes.push(recipe.name);
      group.pantry &&= ing.pantry;
    }
  }
  const open = openItems.filter((i) => !i.boughtAt);
  const lines = groups.map<MealShoppingLine>((g) => {
    const found = open.find((i) => sameName(nameKey(i.name), g.key));
    return {
      key: g.key,
      name: g.name,
      quantity: formatParts(g.parts, language).slice(0, MAX_SHOPPING_TEXT),
      recipes: g.recipes,
      pantry: g.pantry,
      ...(found && { existing: { id: found.id, quantity: found.quantity, note: found.note } }),
    };
  });
  const rank = (l: MealShoppingLine) => SHOPPING_SECTIONS.indexOf(shoppingSection(l.name));
  return lines.sort(
    (a, b) =>
      Number(a.pantry) - Number(b.pantry) ||
      rank(a) - rank(b) ||
      a.name.localeCompare(b.name, language),
  );
}
