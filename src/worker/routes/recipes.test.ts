import { describe, expect, it } from "vitest";
import { setUpFamily, TestBrowser } from "../test/client";

type Recipe = {
  id: string;
  name: string;
  servings: number;
  minutes: number | null;
  tags: string[];
  ingredients: { quantity: number | null; unit: string; name: string; pantry: boolean }[];
  steps: string;
  source: string;
  notes: string;
  photoKey: string | null;
  favourite: boolean;
};

const recipes = async (browser: TestBrowser) =>
  (await (await browser.get("/recipes")).json()) as Recipe[];

const BACALHAU = {
  name: " Bacalhau à Brás ",
  servings: 6,
  minutes: 45,
  tags: ["fish", "Festa"],
  ingredients: [
    { quantity: 400, unit: "g", name: "bacalhau", pantry: false },
    { quantity: null, unit: "", name: "sal", pantry: true },
  ],
  steps: "Desfiar\nMisturar",
  source: "https://example.com/bacalhau",
  notes: "Com batata palha",
};

describe("Recipe Book", () => {
  it("adds, reads, changes, favours and deletes a recipe", async () => {
    const browser = await setUpFamily();
    const created = await browser.post("/recipes", BACALHAU);
    expect(created.status).toBe(201);
    const recipe = (await created.json()) as Recipe;
    expect(recipe).toMatchObject({ ...BACALHAU, name: "Bacalhau à Brás" });
    expect(recipe.favourite).toBe(false);
    expect(recipe.photoKey).toBeNull();

    const read = await browser.get(`/recipes/${recipe.id}`);
    expect(await read.json()).toMatchObject({ id: recipe.id, ingredients: BACALHAU.ingredients });

    // A change takes only the fields sent.
    const changed = await browser.request("PATCH", `/recipes/${recipe.id}`, {
      favourite: true,
      servings: 2,
      minutes: null,
      photoKey: "abc",
    });
    expect(await changed.json()).toMatchObject({
      favourite: true,
      servings: 2,
      minutes: null,
      photoKey: "abc",
      name: "Bacalhau à Brás",
      tags: ["fish", "Festa"],
    });

    expect((await browser.delete(`/recipes/${recipe.id}`)).status).toBe(204);
    expect(await recipes(browser)).toEqual([]);
    expect((await browser.delete(`/recipes/${recipe.id}`)).status).toBe(404);
    expect((await browser.get(`/recipes/${recipe.id}`)).status).toBe(404);
  });

  it("starts from defaults and lists by name", async () => {
    const browser = await setUpFamily();
    await browser.post("/recipes", { name: "Sopa" });
    await browser.post("/recipes", { name: "Arroz" });
    const list = await recipes(browser);
    expect(list.map((r) => r.name)).toEqual(["Arroz", "Sopa"]);
    expect(list[0]).toMatchObject({
      servings: 4,
      minutes: null,
      tags: [],
      ingredients: [],
      steps: "",
      source: "",
      notes: "",
      favourite: false,
    });
  });

  it("takes an id chosen by the device, once", async () => {
    const browser = await setUpFamily();
    const id = "device-chosen-id-1";
    expect((await browser.post("/recipes", { id, name: "Pão" })).status).toBe(201);
    expect((await browser.post("/recipes", { id, name: "Pão" })).status).toBe(409);
    expect((await browser.post("/recipes", { id: "x", name: "Pão" })).status).toBe(400);
  });

  it("refuses what is not valid, naming the field", async () => {
    const browser = await setUpFamily();
    const ingredient = { quantity: 1, unit: "g", name: "x", pantry: false };
    const bad: [string, unknown][] = [
      ["name", "  "],
      ["name", "x".repeat(201)],
      ["servings", 0],
      ["servings", 51],
      ["servings", 2.5],
      ["minutes", 0],
      ["minutes", 2001],
      ["minutes", "5"],
      ["tags", "soup"],
      ["tags", Array(21).fill("a")],
      ["tags", ["x".repeat(41)]],
      ["tags", [3]],
      ["ingredients", Array(101).fill(ingredient)],
      ["ingredients", [{ ...ingredient, name: "" }]],
      ["ingredients", [{ ...ingredient, name: "x".repeat(201) }]],
      ["ingredients", [{ ...ingredient, unit: "x".repeat(41) }]],
      ["ingredients", [{ ...ingredient, quantity: -1 }]],
      ["ingredients", [{ ...ingredient, quantity: 100_001 }]],
      ["ingredients", [{ ...ingredient, quantity: "2" }]],
      ["ingredients", [{ ...ingredient, pantry: "yes" }]],
      ["ingredients", ["sal"]],
      ["steps", "x".repeat(20_001)],
      ["source", "x".repeat(501)],
      ["notes", "x".repeat(5001)],
      ["photoKey", 3],
      ["favourite", "yes"],
    ];
    for (const [field, value] of bad) {
      const res = await browser.post("/recipes", { name: "Ovos", [field]: value });
      expect([field, res.status]).toEqual([field, 400]);
      expect(await res.json()).toEqual({ error: "invalid", field });
    }
    expect((await browser.post("/recipes", {})).status).toBe(400);
    expect(await recipes(browser)).toEqual([]);

    const ovos = (await (await browser.post("/recipes", { name: "Ovos" })).json()) as Recipe;
    expect((await browser.request("PATCH", `/recipes/${ovos.id}`, { name: "" })).status).toBe(400);
    expect(
      (await browser.request("PATCH", `/recipes/${ovos.id}`, { favourite: "yes" })).status,
    ).toBe(400);
    expect((await browser.request("PATCH", "/recipes/nope", { notes: "x" })).status).toBe(404);
  });

  it("accepts the limits", async () => {
    const browser = await setUpFamily();
    const res = await browser.post("/recipes", {
      name: "x".repeat(200),
      servings: 50,
      minutes: 2000,
      tags: Array(20).fill("x".repeat(40)),
      ingredients: Array(100).fill({
        quantity: 100_000,
        unit: "x".repeat(40),
        name: "y",
        pantry: true,
      }),
      steps: "x".repeat(20_000),
      source: "x".repeat(500),
      notes: "x".repeat(5000),
    });
    expect(res.status).toBe(201);
  });

  it("needs a signed-in device", async () => {
    expect((await new TestBrowser().get("/recipes")).status).toBe(401);
    expect((await new TestBrowser().post("/recipes", { name: "x" })).status).toBe(401);
  });
});
