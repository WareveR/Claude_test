import { describe, expect, it } from "vitest";
import { setUpFamily, TestBrowser } from "../test/client";

type Meal = {
  id: string;
  date: string;
  slot: string;
  recipeId: string | null;
  text: string;
  servings: number | null;
};

const meals = async (browser: TestBrowser, from = "2026-11-16", to = "2026-11-22") =>
  (await (await browser.get(`/meals?from=${from}&to=${to}`)).json()) as Meal[];

const put = (browser: TestBrowser, date: string, slot: string, body: unknown) =>
  browser.request("PUT", `/meals/${date}/${slot}`, body);

async function newRecipe(browser: TestBrowser, name: string) {
  return (await (await browser.post("/recipes", { name })).json()) as { id: string };
}

describe("Meal plan", () => {
  it("plans free text, then a recipe in the same slot, then removes it", async () => {
    const browser = await setUpFamily();
    const free = await put(browser, "2026-11-16", "lunch", {
      recipeId: null,
      text: "  Restos ",
      servings: null,
    });
    expect(free.status).toBe(200);
    const first = (await free.json()) as Meal;
    expect(first).toMatchObject({
      date: "2026-11-16",
      slot: "lunch",
      recipeId: null,
      text: "Restos",
      servings: null,
    });

    // The same slot again replaces the Meal; the name is kept with it.
    const bacalhau = await newRecipe(browser, "Bacalhau à Brás");
    const replaced = (await (
      await put(browser, "2026-11-16", "lunch", { recipeId: bacalhau.id, text: "", servings: 6 })
    ).json()) as Meal;
    expect(replaced).toMatchObject({
      id: first.id,
      recipeId: bacalhau.id,
      text: "Bacalhau à Brás",
      servings: 6,
    });
    expect(await meals(browser)).toHaveLength(1);

    expect((await browser.delete("/meals/2026-11-16/lunch")).status).toBe(204);
    expect(await meals(browser)).toEqual([]);
    expect((await browser.delete("/meals/2026-11-16/lunch")).status).toBe(404);
  });

  it("lists a range by date, lunch before dinner", async () => {
    const browser = await setUpFamily();
    for (const [date, slot] of [
      ["2026-11-18", "dinner"],
      ["2026-11-17", "dinner"],
      ["2026-11-17", "lunch"],
      ["2026-11-18", "lunch"],
      ["2026-11-23", "lunch"],
    ]) {
      await put(browser, date, slot, { recipeId: null, text: "x", servings: null });
    }
    expect((await meals(browser)).map((m) => `${m.date} ${m.slot}`)).toEqual([
      "2026-11-17 lunch",
      "2026-11-17 dinner",
      "2026-11-18 lunch",
      "2026-11-18 dinner",
    ]);
  });

  it("keeps a meal as text when its recipe is deleted", async () => {
    const browser = await setUpFamily();
    const sopa = await newRecipe(browser, "Sopa");
    await put(browser, "2026-11-16", "dinner", { recipeId: sopa.id, text: "", servings: null });
    expect((await browser.delete(`/recipes/${sopa.id}`)).status).toBe(204);
    expect(await meals(browser)).toMatchObject([{ recipeId: null, text: "Sopa" }]);
  });

  it("refuses what is not valid, naming the field", async () => {
    const browser = await setUpFamily();
    const ok = { recipeId: null, text: "Restos", servings: null };
    const bad: [string, unknown][] = [
      ["recipeId", "no-such-recipe"],
      ["recipeId", 3],
      ["text", ""],
      ["text", "   "],
      ["text", "x".repeat(201)],
      ["text", 5],
      ["servings", 0],
      ["servings", 51],
      ["servings", 2.5],
      ["servings", "4"],
    ];
    for (const [field, value] of bad) {
      const res = await put(browser, "2026-11-16", "lunch", { ...ok, [field]: value });
      expect([field, res.status]).toEqual([field, 400]);
      expect(await res.json()).toEqual({ error: "invalid", field });
    }
    // A recipe needs no text; no recipe and no text is refused.
    const sopa = await newRecipe(browser, "Sopa");
    expect(
      (await put(browser, "2026-11-16", "lunch", { recipeId: sopa.id, text: "" })).status,
    ).toBe(200);
    expect((await put(browser, "2026-11-16", "dinner", {})).status).toBe(400);
    expect((await put(browser, "2026-02-30", "lunch", ok)).status).toBe(400);
    expect((await put(browser, "2026-11-16", "breakfast", ok)).status).toBe(400);
    expect(
      (await put(browser, "2026-11-16", "dinner", { ...ok, text: "x".repeat(200) })).status,
    ).toBe(200);
    expect((await put(browser, "2026-11-17", "dinner", { ...ok, servings: 50 })).status).toBe(200);
  });

  it("checks the range asked for", async () => {
    const browser = await setUpFamily();
    const status = async (query: string) => (await browser.get(`/meals${query}`)).status;
    expect(await status("")).toBe(400);
    expect(await status("?from=2026-11-16")).toBe(400);
    expect(await status("?from=2026-02-30&to=2026-03-02")).toBe(400);
    expect(await status("?from=2026-11-16&to=2026-11-15")).toBe(400);
    expect(await status("?from=2026-11-16&to=2026-11-16")).toBe(200);
    // 62 days at most.
    expect(await status("?from=2026-11-01&to=2027-01-01")).toBe(200);
    expect(await status("?from=2026-11-01&to=2027-01-02")).toBe(400);
  });

  it("needs a signed-in device", async () => {
    expect((await new TestBrowser().get("/meals?from=2026-11-16&to=2026-11-22")).status).toBe(401);
    expect(
      (await new TestBrowser().request("PUT", "/meals/2026-11-16/lunch", { text: "x" })).status,
    ).toBe(401);
    expect((await new TestBrowser().delete("/meals/2026-11-16/lunch")).status).toBe(401);
  });
});
