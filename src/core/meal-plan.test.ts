import { describe, expect, it } from "vitest";
import { isMealSlot, lastPlanned, rankForPicker, weekOf } from "./meal-plan";
import type { Recipe } from "./recipe";

function recipe(id: string, name: string, favourite = false): Recipe {
  return {
    id,
    name,
    servings: 4,
    minutes: null,
    tags: [],
    ingredients: [],
    steps: "",
    source: "",
    notes: "",
    photoKey: null,
    favourite,
    createdAt: "",
    changedAt: "",
  };
}

describe("weekOf", () => {
  it("gives Monday to Sunday for any day of the week", () => {
    const week = [
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
    ];
    for (const day of week) expect(weekOf(day)).toEqual(week);
  });

  it("crosses months and years", () => {
    expect(weekOf("2026-12-31")[0]).toBe("2026-12-28");
    expect(weekOf("2026-12-31")[6]).toBe("2027-01-03");
  });
});

describe("lastPlanned", () => {
  it("keeps the latest date of each recipe and skips free text", () => {
    const last = lastPlanned([
      { recipeId: "a", date: "2026-11-03" },
      { recipeId: "a", date: "2026-11-10" },
      { recipeId: "a", date: "2026-11-05" },
      { recipeId: null, date: "2026-11-11" },
      { recipeId: "b", date: "2026-10-01" },
    ]);
    expect(last.get("a")).toBe("2026-11-10");
    expect(last.get("b")).toBe("2026-10-01");
    expect(last.size).toBe(2);
  });
});

describe("rankForPicker", () => {
  const recipes = [
    recipe("a", "Arroz"),
    recipe("b", "Bacalhau", true),
    recipe("c", "Caldo verde"),
    recipe("d", "Dobrada", true),
  ];

  it("offers never planned first (favourites, then name), then the longest ago", () => {
    const meals = [
      { recipeId: "a", date: "2026-11-01" },
      { recipeId: "d", date: "2026-11-10" },
    ];
    expect(rankForPicker(recipes, meals, "").map((r) => r.id)).toEqual(["b", "c", "a", "d"]);
  });

  it("breaks a tie on the date by favourite", () => {
    const meals = [
      { recipeId: "a", date: "2026-11-01" },
      { recipeId: "b", date: "2026-11-01" },
    ];
    expect(rankForPicker(recipes, meals, "").map((r) => r.id)).toEqual(["d", "c", "b", "a"]);
  });

  it("narrows by the query", () => {
    expect(rankForPicker(recipes, [], "BACA").map((r) => r.id)).toEqual(["b"]);
  });
});

describe("isMealSlot", () => {
  it("knows the slots", () => {
    expect(isMealSlot("lunch")).toBe(true);
    expect(isMealSlot("dinner")).toBe(true);
    expect(isMealSlot("breakfast")).toBe(false);
  });
});
