import { describe, expect, it } from "vitest";
import {
  forStore,
  groupShopping,
  matchSuggestions,
  onListOn,
  openStores,
  rankSuggestions,
  sameNameOnList,
  storeNamedIn,
  suggestionFor,
  type ShoppingItem,
} from "./shopping";

const LISBON = "Europe/Lisbon";

function item(name: string, more: Partial<ShoppingItem> = {}): ShoppingItem {
  return {
    id: name,
    name,
    quantity: "",
    note: "",
    store: "",
    boughtAt: null,
    createdAt: "2026-10-01T10:00:00.000Z",
    changedAt: "2026-10-01T10:00:00.000Z",
    ...more,
  };
}

describe("onListOn", () => {
  it("keeps an open item whatever the day", () => {
    expect(onListOn({ boughtAt: null }, "2026-12-31", LISBON)).toBe(true);
  });

  it("keeps a bought item only on its day in the Family Time Zone", () => {
    // 23:30 UTC on 11 October is 00:30 on the 12th in Lisbon (summer time).
    const boughtAt = "2026-10-11T23:30:00.000Z";
    expect(onListOn({ boughtAt }, "2026-10-12", LISBON)).toBe(true);
    expect(onListOn({ boughtAt }, "2026-10-13", LISBON)).toBe(false);
    expect(onListOn({ boughtAt: "2026-10-11T22:30:00.000Z" }, "2026-10-12", LISBON)).toBe(false);
  });
});

describe("stores", () => {
  const items = [
    item("Leite", { store: "Lidl" }),
    item("Pão", { store: "lidl" }),
    item("Café", { store: "Continente" }),
    item("Arroz"),
    item("Ovos", { store: "Aldi", boughtAt: "2026-10-12T08:00:00.000Z" }),
  ];

  it("lists the shops of the open items once each", () => {
    expect(openStores(items)).toEqual(["Continente", "Lidl"]);
  });

  it("shows a shop's items and those for any shop", () => {
    expect(forStore(items, "LIDL").map((i) => i.name)).toEqual(["Leite", "Pão", "Arroz"]);
    expect(forStore(items, "")).toHaveLength(5);
  });

  it("finds the shop a title names, as a whole word", () => {
    const stores = ["Continente", "Lidl", "Pingo Doce"];
    expect(storeNamedIn("Compras no LIDL", stores)).toBe("Lidl");
    expect(storeNamedIn("Supermercado pingo doce", stores)).toBe("Pingo Doce");
    expect(storeNamedIn("Supermercado", stores)).toBe("");
    expect(storeNamedIn("Lidlândia", stores)).toBe("");
  });
});

describe("groupShopping", () => {
  it("groups open items by section in shop order and puts the bought ones apart", () => {
    const groups = groupShopping([
      item("Detergente"),
      item("Maçãs", { createdAt: "2026-10-02T00:00:00.000Z" }),
      item("Bananas", { createdAt: "2026-10-01T00:00:00.000Z" }),
      item("Leite", { boughtAt: "2026-10-12T08:00:00.000Z" }),
      item("Iogurtes", { boughtAt: "2026-10-12T09:00:00.000Z" }),
    ]);
    expect(groups.sections.map((s) => [s.section, s.items.map((i) => i.name)])).toEqual([
      ["produce", ["Bananas", "Maçãs"]],
      ["cleaning", ["Detergente"]],
    ]);
    expect(groups.bought.map((i) => i.name)).toEqual(["Iogurtes", "Leite"]);
  });
});

describe("suggestions", () => {
  const history = [
    item("leite", { createdAt: "2026-09-01T00:00:00.000Z", store: "Aldi" }),
    item("Pão", { createdAt: "2026-09-02T00:00:00.000Z" }),
    item("Leite", { createdAt: "2026-09-10T00:00:00.000Z", store: "Lidl" }),
    item("Leite de aveia", { createdAt: "2026-09-11T00:00:00.000Z" }),
    item("Pao", { createdAt: "2026-09-05T00:00:00.000Z" }),
    item("Café", { createdAt: "2026-09-20T00:00:00.000Z" }),
  ];
  const ranked = rankSuggestions(history);

  it("ranks names by how often they were added, the latest first among equals", () => {
    expect(ranked.map((s) => [s.name, s.count])).toEqual([
      ["Leite", 2],
      ["Pao", 2],
      ["Café", 1],
      ["Leite de aveia", 1],
    ]);
    expect(ranked[0].store).toBe("Lidl");
  });

  it("matches the start of the name or of a word, leaving out what is on the list", () => {
    expect(matchSuggestions(ranked, "lei", []).map((s) => s.name)).toEqual([
      "Leite",
      "Leite de aveia",
    ]);
    expect(matchSuggestions(ranked, "AVE", []).map((s) => s.name)).toEqual(["Leite de aveia"]);
    expect(matchSuggestions(ranked, "cafe", []).map((s) => s.name)).toEqual(["Café"]);
    expect(matchSuggestions(ranked, "lei", [item("LEITE")]).map((s) => s.name)).toEqual([
      "Leite de aveia",
    ]);
    expect(matchSuggestions(ranked, " ", [])).toEqual([]);
  });

  it("finds a name whatever its case or accents", () => {
    expect(suggestionFor(ranked, "pão")?.name).toBe("Pao");
    expect(sameNameOnList([item("Maçãs")], "macas")?.name).toBe("Maçãs");
    expect(sameNameOnList([item("Maçãs")], "peras")).toBeUndefined();
  });
});
