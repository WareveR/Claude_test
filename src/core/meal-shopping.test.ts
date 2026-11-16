import { describe, expect, it } from "vitest";
import { mergeNote, mergeQuantity, shoppingDates, shoppingFromMeals } from "./meal-shopping";
import { parseIngredient, type Recipe } from "./recipe";

function recipe(id: string, name: string, servings: number, lines: string[]): Recipe {
  return {
    id,
    name,
    servings,
    minutes: null,
    tags: [],
    ingredients: lines.map(parseIngredient),
    steps: "",
    source: "",
    notes: "",
    photoKey: null,
    favourite: false,
    createdAt: "",
    changedAt: "",
  };
}

const meal = (recipeId: string | null, servings: number | null = null) => ({ recipeId, servings });
const open = (
  id: string,
  name: string,
  quantity = "",
  note = "",
  boughtAt: string | null = null,
) => ({
  id,
  name,
  quantity,
  note,
  boughtAt,
});

describe("shoppingFromMeals", () => {
  const bacalhau = recipe("a", "Bacalhau à Brás", 4, [
    "400 g bacalhau",
    "200 g cebola",
    "4 ovos",
    "q.b. sal",
  ]);
  const sopa = recipe("b", "Sopa de grão", 4, [
    "200 g cebola",
    "1 lata grão",
    "2 dl azeite",
    "sal",
  ]);

  it("lists nothing without recipe meals", () => {
    expect(shoppingFromMeals([], [bacalhau], [])).toEqual([]);
    expect(shoppingFromMeals([meal(null), meal("gone")], [bacalhau], [])).toEqual([]);
  });

  it("sums the same ingredient of several recipes and names the recipes", () => {
    const lines = shoppingFromMeals([meal("a"), meal("b")], [bacalhau, sopa], [], "pt-PT");
    const onion = lines.find((l) => l.name === "cebola")!;
    expect(onion.quantity).toBe("400 g");
    expect(onion.recipes).toEqual(["Bacalhau à Brás", "Sopa de grão"]);
    expect(onion.pantry).toBe(false);
    expect(onion.existing).toBeUndefined();
  });

  it("scales to the meal's servings, else the recipe's", () => {
    const lines = shoppingFromMeals([meal("a", 2), meal("b")], [bacalhau, sopa], [], "pt-PT");
    expect(lines.find((l) => l.name === "bacalhau")!.quantity).toBe("200 g");
    expect(lines.find((l) => l.name === "cebola")!.quantity).toBe("300 g");
    expect(lines.find((l) => l.name === "grão")!.quantity).toBe("1 lata");
  });

  it("rounds up unitless counts to whole numbers", () => {
    const lines = shoppingFromMeals([meal("a", 3)], [bacalhau], [], "pt-PT");
    expect(lines.find((l) => l.name === "ovos")!.quantity).toBe("3");
    const odd = recipe("c", "Omelete", 4, ["1 ovo"]);
    expect(shoppingFromMeals([meal("c", 1)], [odd], [])[0].quantity).toBe("1");
    expect(shoppingFromMeals([meal("c", 3), meal("c", 2)], [odd], [])[0].quantity).toBe("2");
  });

  it("adds grams and kilos, millilitres and litres", () => {
    const r = recipe("r", "R", 1, ["800 g batatas", "1 kg batatas", "2 dl leite", "1 l leite"]);
    const lines = shoppingFromMeals([meal("r")], [r], [], "pt-PT");
    expect(lines.find((l) => l.name === "batatas")!.quantity).toBe("1,8 kg");
    expect(lines.find((l) => l.name === "leite")!.quantity).toBe("1,2 l");
    const en = shoppingFromMeals([meal("r")], [r], [], "en-GB");
    expect(en.find((l) => l.name === "batatas")!.quantity).toBe("1.8 kg");
  });

  it("shows kilos and litres only from 1000, else grams and millilitres", () => {
    const r = recipe("r", "R", 1, ["500 g a", "500 g a", "5 cl b", "1,5 dl b"]);
    const lines = shoppingFromMeals([meal("r")], [r], [], "pt-PT");
    expect(lines.find((l) => l.name === "a")!.quantity).toBe("1 kg");
    expect(lines.find((l) => l.name === "b")!.quantity).toBe("200 ml");
  });

  it("adds the same other unit and joins incompatible ones with +", () => {
    const r = recipe("r", "R", 1, ["400 g tomate", "1 lata tomate", "2 latas tomate", "1 tomate"]);
    const lines = shoppingFromMeals([meal("r")], [r], [], "pt-PT");
    expect(lines[0].quantity).toBe("400 g + 3 latas + 1");
  });

  it("pluralises a unit that adds up past one", () => {
    const r = recipe("r", "R", 1, ["1 colher de sopa mel", "1 colher de sopa mel"]);
    expect(shoppingFromMeals([meal("r")], [r], [], "pt-PT")[0].quantity).toBe("2 colheres de sopa");
  });

  it("gives no quantity for q.b. and counts a line as pantry only when every source is", () => {
    const lines = shoppingFromMeals([meal("a")], [bacalhau], [], "pt-PT");
    const salt = lines.find((l) => l.name === "sal")!;
    expect(salt.quantity).toBe("");
    expect(salt.pantry).toBe(true);
    const mixed = recipe("m", "M", 1, ["q.b. sal", "1 kg sal"]);
    const sal = shoppingFromMeals([meal("m")], [mixed], [], "pt-PT");
    expect(sal[0].quantity).toBe("1 kg");
    const both = recipe("n", "N", 1, ["q.b. azeite"]);
    const mix = shoppingFromMeals([meal("n"), meal("m")], [both, mixed], [], "pt-PT");
    expect(mix.find((l) => l.name === "azeite")!.pantry).toBe(true);
    const odd = recipe("o", "O", 1, ["sal marinho"]);
    expect(odd.ingredients[0].pantry).toBe(true);
  });

  it("treats a plural and a singular, and accents and case, as one ingredient", () => {
    const x = recipe("x", "X", 1, [
      "2 Cebolas",
      "1 cebola",
      "100 g Grão-de-bico",
      "100 g grao de bico",
    ]);
    const lines = shoppingFromMeals([meal("x")], [x], [], "pt-PT");
    expect(lines).toHaveLength(2);
    const onion = lines.find((l) => l.name === "Cebolas")!;
    expect(onion.quantity).toBe("3");
    expect(lines.find((l) => l.name === "Grão-de-bico")!.quantity).toBe("200 g");
  });

  it("never renames a name by stripping an s", () => {
    const x = recipe("x", "X", 1, ["1 arroz", "1 gás"]);
    const names = shoppingFromMeals([meal("x")], [x], []).map((l) => l.name);
    expect(names.sort()).toEqual(["arroz", "gás"]);
  });

  it("sees a plural in any word of the name", () => {
    const x = recipe("x", "X", 1, ["1 cebola roxa", "1 cebolas roxas"]);
    expect(shoppingFromMeals([meal("x")], [x], [open("1", "Cebolas Roxas")])[0].existing?.id).toBe(
      "1",
    );
    expect(shoppingFromMeals([meal("x")], [x], [])).toHaveLength(1);
  });

  it("does not merge short different words", () => {
    const x = recipe("x", "X", 1, ["1 ovo", "1 ovos"]);
    expect(shoppingFromMeals([meal("x")], [x], [])).toHaveLength(1);
    const y = recipe("y", "Y", 1, ["1 as", "1 a"]);
    expect(shoppingFromMeals([meal("y")], [y], [])).toHaveLength(2);
  });

  it("repeats a recipe planned twice by adding it twice, with its name once", () => {
    const lines = shoppingFromMeals([meal("a"), meal("a")], [bacalhau], [], "pt-PT");
    const fish = lines.find((l) => l.name === "bacalhau")!;
    expect(fish.quantity).toBe("800 g");
    expect(fish.recipes).toEqual(["Bacalhau à Brás"]);
  });

  it("finds the open item of the same name, not a bought one", () => {
    const items = [
      open("1", "Cebolas", "2 kg", "Sopa", "2026-01-01T00:00:00Z"),
      open("2", "cebola", "2 kg", "Caldo"),
    ];
    const lines = shoppingFromMeals([meal("a")], [bacalhau], items, "pt-PT");
    expect(lines.find((l) => l.name === "cebola")!.existing).toEqual({
      id: "2",
      quantity: "2 kg",
      note: "Caldo",
    });
    expect(lines.find((l) => l.name === "bacalhau")!.existing).toBeUndefined();
    const boughtOnly = shoppingFromMeals([meal("a")], [bacalhau], [items[0]], "pt-PT");
    expect(boughtOnly.find((l) => l.name === "cebola")!.existing).toBeUndefined();
  });

  it("sorts what is to buy first by section, then name, and staples last", () => {
    const r = recipe("r", "R", 1, [
      "1 sabonete",
      "1 pão",
      "1 maçã",
      "1 bacalhau",
      "q.b. sal",
      "1 abacate",
    ]);
    const names = shoppingFromMeals([meal("r")], [r], [], "pt-PT").map((l) => l.name);
    expect(names.at(-1)).toBe("sal");
    expect(names.indexOf("bacalhau")).toBeLessThan(names.indexOf("pão"));
    expect(names.indexOf("pão")).toBeLessThan(names.indexOf("sabonete"));
    expect(names.indexOf("abacate")).toBeLessThan(names.indexOf("maçã"));
  });

  it("copes with a recipe of zero servings", () => {
    const z = recipe("z", "Z", 0, ["2 ovos"]);
    expect(shoppingFromMeals([meal("z", 4)], [z], [])[0].quantity).toBe("2");
  });
});

describe("mergeQuantity", () => {
  it("adds compatible units", () => {
    expect(mergeQuantity("2 kg", "400 g")).toBe("2,4 kg");
    expect(mergeQuantity("2 kg", "400 g", "en-GB")).toBe("2.4 kg");
    expect(mergeQuantity("1 l", "2 dl")).toBe("1,2 l");
    expect(mergeQuantity("2", "3")).toBe("5");
    expect(mergeQuantity("2,5 latas", "1 lata")).toBe("3,5 latas");
  });

  it("joins what does not add up", () => {
    expect(mergeQuantity("2 kg", "1 lata")).toBe("2 kg + 1 lata");
    expect(mergeQuantity("um pouco", "400 g")).toBe("um pouco + 400 g");
    expect(mergeQuantity("400 g", "q.b.")).toBe("400 g + q.b.");
  });

  it("adds into a joined quantity", () => {
    expect(mergeQuantity("400 g + 1 lata", "100 g")).toBe("500 g + 1 lata");
  });

  it("skips an empty side", () => {
    expect(mergeQuantity("", "400 g")).toBe("400 g");
    expect(mergeQuantity("2 kg", "")).toBe("2 kg");
    expect(mergeQuantity(" ", " ")).toBe("");
  });
});

describe("mergeNote", () => {
  it("appends recipe names once each", () => {
    expect(mergeNote("", ["A", "B"])).toBe("A, B");
    expect(mergeNote("A", ["a", "B"])).toBe("A, B");
    expect(mergeNote("Para o sábado", ["Sopa"])).toBe("Para o sábado, Sopa");
  });
  it("is capped", () => {
    expect(mergeNote("x".repeat(195), ["Bacalhau", "Sopa"]).length).toBeLessThanOrEqual(200);
  });
});

describe("shoppingDates", () => {
  const week = [
    "2026-11-16",
    "2026-11-17",
    "2026-11-18",
    "2026-11-19",
    "2026-11-20",
    "2026-11-21",
    "2026-11-22",
  ];
  it("runs from today to Sunday in the current week", () => {
    expect(shoppingDates(week, "2026-11-19")).toEqual(week.slice(3));
    expect(shoppingDates(week, "2026-11-22")).toEqual(["2026-11-22"]);
  });
  it("is the whole week ahead or past", () => {
    expect(shoppingDates(week, "2026-11-15")).toEqual(week);
    expect(shoppingDates(week, "2026-11-23")).toEqual(week);
  });
});
