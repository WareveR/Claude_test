import { describe, expect, it } from "vitest";
import { isShoppingEntry, preparationFor } from "./preparation";

describe("preparationFor", () => {
  it("finds a list by a word in the title, in either language", () => {
    expect(preparationFor("Natação", "activity")).toBe("swimming");
    expect(preparationFor("Swimming lesson", null)).toBe("swimming");
    expect(preparationFor("Ginásio", "activity")).toBe("gymBag");
    expect(preparationFor("Voo para Paris", "general")).toBe("flight");
  });

  it("falls back to the type's list, and leaves the rest alone", () => {
    expect(preparationFor("consulta dentista mamã", "appointment")).toBe("appointment");
    expect(preparationFor("Jantar com amigos", "meal")).toBeNull();
    expect(preparationFor("Festa da Rute", "birthday")).toBeNull();
    expect(preparationFor("Comprar pão", "general")).toBeNull();
  });

  it("gives a shopping trip no list of its own, even of its type", () => {
    expect(preparationFor("Supermercado", "home")).toBeNull();
    expect(preparationFor("Groceries", "appointment")).toBeNull();
    expect(preparationFor("Compras no Lidl", "general")).toBeNull();
  });
});

describe("isShoppingEntry", () => {
  it("finds a shopping trip by a word in its title, in either language", () => {
    expect(isShoppingEntry("Supermercado", "home")).toBe(true);
    expect(isShoppingEntry("Compras no Lidl", null)).toBe(true);
    expect(isShoppingEntry("Weekly groceries", "general")).toBe(true);
    expect(isShoppingEntry("Comprar pão", "general")).toBe(false);
    expect(isShoppingEntry("Natação e compras", "activity")).toBe(false);
    expect(isShoppingEntry("Compras", "birthday")).toBe(false);
  });
});
