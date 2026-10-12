import { describe, expect, it } from "vitest";
import { foldName, SHOPPING_SECTIONS, shoppingSection } from "./shopping-sections";

describe("shoppingSection", () => {
  it.each([
    ["Bananas", "produce"],
    ["Maçãs", "produce"],
    ["LIMÕES", "produce"],
    ["tomatoes", "produce"],
    ["Peito de frango", "meatFish"],
    ["Bacalhau", "meatFish"],
    ["Leite meio-gordo", "dairyEggs"],
    ["ovos", "dairyEggs"],
    ["Greek yoghurt", "dairyEggs"],
    ["Pão", "bakery"],
    ["pães de forma", "bakery"],
    ["Arroz agulha", "pantry"],
    ["Azeite", "pantry"],
    ["Água com gás", "drinks"],
    ["Vinho tinto", "drinks"],
    ["Ervilhas congeladas", "frozen"],
    ["Gelado de baunilha", "frozen"],
    ["Detergente da loiça", "cleaning"],
    ["Lixívia", "cleaning"],
    ["Papel higiénico", "hygiene"],
    ["Pasta de dentes", "hygiene"],
    ["Fraldas", "baby"],
    ["Leite em pó", "baby"],
    ["Ração do gato", "pets"],
    ["Comida de cão", "pets"],
    ["Pilhas AA", "cleaning"],
    ["Prenda para a Ana", "other"],
    ["", "other"],
  ])("puts %s in %s", (name, section) => {
    expect(shoppingSection(name)).toBe(section);
  });

  it("matches whole words only", () => {
    // "sal" is in the pantry, but not inside "salmão" or "salsicha".
    expect(shoppingSection("Salmão")).toBe("meatFish");
    expect(shoppingSection("Salsichas")).toBe("meatFish");
    expect(shoppingSection("Saleiro")).toBe("other");
  });

  it("lists the sections in shop-walk order with other last", () => {
    expect(SHOPPING_SECTIONS[0]).toBe("produce");
    expect(SHOPPING_SECTIONS.at(-1)).toBe("other");
  });
});

describe("foldName", () => {
  it("drops case, accents and punctuation", () => {
    expect(foldName("  Pão-de-Ló! ")).toBe("pao de lo");
  });
});
