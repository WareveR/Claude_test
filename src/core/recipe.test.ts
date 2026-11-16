import { describe, expect, it } from "vitest";
import {
  formatIngredient,
  isPantry,
  parseIngredient,
  searchRecipes,
  stepLines,
  type Ingredient,
  type Recipe,
} from "./recipe";

describe("parseIngredient", () => {
  it("reads a quantity, a short unit and a name", () => {
    expect(parseIngredient("400 g bacalhau")).toEqual({
      quantity: 400,
      unit: "g",
      name: "bacalhau",
      pantry: false,
    });
    expect(parseIngredient("400g bacalhau")).toMatchObject({ quantity: 400, unit: "g" });
  });

  it("reads a quantity without a unit", () => {
    expect(parseIngredient("2 cebolas")).toEqual({
      quantity: 2,
      unit: "",
      name: "cebolas",
      pantry: false,
    });
  });

  it("reads fractions and a decimal with comma or dot", () => {
    expect(parseIngredient("1/2 colher de chá de sal")).toEqual({
      quantity: 0.5,
      unit: "colher de chá",
      name: "sal",
      pantry: true,
    });
    expect(parseIngredient("1,5 kg batatas")).toMatchObject({ quantity: 1.5, unit: "kg" });
    expect(parseIngredient("1.5 kg batatas")).toMatchObject({ quantity: 1.5 });
    expect(parseIngredient("½ chávena de arroz")).toMatchObject({
      quantity: 0.5,
      unit: "chávena",
      name: "arroz",
    });
    expect(parseIngredient("1 1/2 chavenas de leite")).toMatchObject({
      quantity: 1.5,
      unit: "chavenas",
      name: "leite",
    });
  });

  it("knows English units and drops 'of'", () => {
    expect(parseIngredient("2 tbsp olive oil")).toMatchObject({ quantity: 2, unit: "tbsp" });
    expect(parseIngredient("3 cloves of garlic")).toMatchObject({ unit: "cloves", name: "garlic" });
  });

  it("does not take the start of a word for a unit", () => {
    expect(parseIngredient("2 laranjas")).toMatchObject({ unit: "", name: "laranjas" });
    expect(parseIngredient("3 dentes de alho")).toMatchObject({ unit: "dentes", name: "alho" });
  });

  it("reads q.b. as no quantity", () => {
    expect(parseIngredient("q.b. sal")).toEqual({
      quantity: null,
      unit: "",
      name: "sal",
      pantry: true,
    });
    expect(parseIngredient("Q.B. de pimenta")).toMatchObject({ quantity: null, name: "pimenta" });
  });

  it("takes a bare name whole", () => {
    expect(parseIngredient("sal")).toEqual({ quantity: null, unit: "", name: "sal", pantry: true });
    expect(parseIngredient("  salsa  fresca ")).toMatchObject({ name: "salsa fresca" });
    // A quantity and a unit with nothing to buy: the whole line is the name.
    expect(parseIngredient("400 g")).toMatchObject({ quantity: null, name: "400 g" });
  });
});

describe("isPantry", () => {
  it("knows staples, ignoring case and accents", () => {
    for (const name of ["Sal", "ÓLEO", "água", "Açúcar", "azeite virgem", "olive oil", "Sugar"]) {
      expect(isPantry(name)).toBe(true);
    }
    for (const name of ["salsa", "pimentos", "batatas", "salmão"])
      expect(isPantry(name)).toBe(false);
  });
});

describe("formatIngredient", () => {
  const bacalhau: Ingredient = { quantity: 400, unit: "g", name: "bacalhau", pantry: false };

  it("writes quantity, unit and name", () => {
    expect(formatIngredient(bacalhau)).toBe("400 g bacalhau");
    expect(formatIngredient(parseIngredient("1,5 kg batatas"))).toBe("1,5 kg batatas");
    expect(formatIngredient(parseIngredient("1,5 kg batatas"), 1, "en")).toBe("1.5 kg batatas");
    expect(formatIngredient(parseIngredient("2 cebolas"))).toBe("2 cebolas");
    expect(formatIngredient(parseIngredient("q.b. sal"))).toBe("q.b. sal");
  });

  it("joins a word unit with de", () => {
    expect(formatIngredient(parseIngredient("1/2 colher de chá de sal"))).toBe(
      "0,5 colher de chá de sal",
    );
    expect(formatIngredient(parseIngredient("3 cloves garlic"), 1, "en")).toBe(
      "3 cloves of garlic",
    );
    // In the unit's own language, whatever the device's.
    expect(formatIngredient(parseIngredient("3 dentes de alho"), 1, "en")).toBe("3 dentes de alho");
  });

  it("scales the quantity, to at most two decimals", () => {
    expect(formatIngredient(bacalhau, 1.5)).toBe("600 g bacalhau");
    expect(formatIngredient(parseIngredient("1 lata de atum"), 1 / 3)).toBe("0,33 lata de atum");
    expect(formatIngredient(parseIngredient("q.b. sal"), 2)).toBe("q.b. sal");
  });

  it("reads back what it wrote", () => {
    for (const line of ["400 g bacalhau", "0,5 colher de chá de sal", "2 cebolas", "q.b. sal"]) {
      expect(formatIngredient(parseIngredient(line))).toBe(line);
    }
  });
});

describe("stepLines", () => {
  it("gives the non-empty lines", () => {
    expect(stepLines("Cortar\n\n  Cozer  \n")).toEqual(["Cortar", "Cozer"]);
  });
});

describe("searchRecipes", () => {
  const recipe = (name: string, extra: Partial<Recipe> = {}): Recipe => ({
    id: name,
    name,
    servings: 4,
    minutes: null,
    tags: [],
    ingredients: [],
    steps: "",
    source: "",
    notes: "",
    photoKey: null,
    favourite: false,
    createdAt: "",
    changedAt: "",
    ...extra,
  });
  const caldo = recipe("Caldo verde", {
    tags: ["soup"],
    ingredients: [parseIngredient("500 g batatas"), parseIngredient("1 couve galega")],
  });
  const bacalhau = recipe("Bacalhau à Brás", {
    ingredients: [parseIngredient("400 g bacalhau"), parseIngredient("4 ovos")],
  });
  const arroz = recipe("Arroz de pato", { favourite: true });
  const all = [caldo, bacalhau, arroz];

  it("finds by name, tag or ingredient, ignoring case and accents", () => {
    expect(searchRecipes(all, "BRAS")).toEqual([bacalhau]);
    expect(searchRecipes(all, "batatas")).toEqual([caldo]);
    expect(searchRecipes(all, "soup")).toEqual([caldo]);
    expect(searchRecipes(all, "couve")).toEqual([caldo]);
  });

  it("needs every word, each anywhere", () => {
    expect(searchRecipes(all, "caldo batatas")).toEqual([caldo]);
    expect(searchRecipes(all, "caldo ovos")).toEqual([]);
  });

  it("finds a tag by its shown name", () => {
    expect(searchRecipes(all, "sopa", undefined, (t) => (t === "soup" ? "Sopa" : t))).toEqual([
      caldo,
    ]);
  });

  it("narrows to a tag and puts favourites first, then names", () => {
    expect(searchRecipes(all, "", "soup")).toEqual([caldo]);
    expect(searchRecipes(all, "")).toEqual([arroz, bacalhau, caldo]);
  });
});
