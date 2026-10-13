import { describe, expect, it } from "vitest";
import {
  MAX_SHOPPING_NAMES,
  readShoppingPhrase,
  saysWhen,
  shoppingToAdd,
  splitShoppingNames,
} from "./shopping-phrase";

describe("readShoppingPhrase in Portuguese", () => {
  it.each([
    ["comprar leite e ovos", ["Leite", "Ovos"]],
    ["Comprar leite, ovos e pão.", ["Leite", "Ovos", "Pão"]],
    ["compra o pão", ["Pão"]],
    ["temos de comprar mais fruta", ["Fruta"]],
    ["adiciona pão à lista de compras", ["Pão"]],
    ["Adicionar queijo e fiambre na lista de compras", ["Queijo", "Fiambre"]],
    ["põe arroz na lista das compras", ["Arroz"]],
    ["lista de compras: leite, café; açúcar", ["Leite", "Café", "Açúcar"]],
    ["falta detergente", ["Detergente"]],
    ["faltam ovos e farinha", ["Ovos", "Farinha"]],
    ["já não há manteiga", ["Manteiga"]],
    ["acabou o leite", ["Leite"]],
    ["acabaram-se os iogurtes e as bolachas", ["Iogurtes", "Bolachas"]],
    ["comprar 2 litros de leite", ["2 litros de leite"]],
    ["comprar detergente para a loiça e esponjas", ["Detergente para a loiça", "Esponjas"]],
  ])("%s", (sentence, names) => {
    expect(readShoppingPhrase(sentence)).toEqual(names);
  });
});

describe("readShoppingPhrase in English", () => {
  it.each([
    ["buy milk and eggs", ["Milk", "Eggs"]],
    ["Buy milk, eggs, and bread", ["Milk", "Eggs", "Bread"]],
    ["add bread to the shopping list", ["Bread"]],
    ["put apples and pears on the shopping list please", ["Apples", "Pears"]],
    ["shopping list: tea, coffee", ["Tea", "Coffee"]],
    ["we need some butter", ["Butter"]],
    ["we're out of washing up liquid", ["Washing up liquid"]],
    ["out of rice", ["Rice"]],
  ])("%s", (sentence, names) => {
    expect(readShoppingPhrase(sentence)).toEqual(names);
  });
});

describe("readShoppingPhrase leaves other sentences alone", () => {
  it.each([
    "comprar bilhetes para o cinema sábado às 20h",
    "comprar prenda da avó amanhã",
    "buy tickets for the concert on Friday",
    "buy flowers at 6pm",
    "comprar o passe dia 15",
    "dentista terça às 3",
    "jantar com a Ana",
    "we need to call the plumber",
    "falta pagar a luz",
    "faltam 3 dias para as férias",
    "add Ana to the calendar",
    "adiciona reunião à lista",
    "comprar",
    "",
  ])("%s", (sentence) => {
    expect(readShoppingPhrase(sentence)).toBeNull();
  });
});

describe("saysWhen", () => {
  it("sees days, times and dates but not quantities", () => {
    expect(saysWhen("às 20h")).toBe(true);
    expect(saysWhen("at 19:30")).toBe(true);
    expect(saysWhen("next week")).toBe(true);
    expect(saysWhen("no sábado")).toBe(true);
    expect(saysWhen("2 kg de batatas")).toBe(false);
    expect(saysWhen("6 ovos")).toBe(false);
    expect(saysWhen("2 hamburgers")).toBe(false);
  });
});

describe("splitShoppingNames", () => {
  it("splits on commas, semicolons, e and and, and keeps each name once", () => {
    expect(splitShoppingNames("leite, Leite e LEITE; ovos and pão")).toEqual([
      "Leite",
      "Ovos",
      "Pão",
    ]);
  });

  it("drops leading articles and trailing words that aren't the name", () => {
    expect(splitShoppingNames("o pão também, uns tomates por favor")).toEqual(["Pão", "Tomates"]);
  });

  it("keeps at most the limit", () => {
    const many = Array.from({ length: 40 }, (_, i) => `coisa ${i}`).join(", ");
    expect(splitShoppingNames(many)).toHaveLength(MAX_SHOPPING_NAMES);
  });
});

describe("shoppingToAdd", () => {
  it("leaves out names already open on the list, whatever their case or accents", () => {
    const items = [
      { name: "Pao", boughtAt: null },
      { name: "Leite", boughtAt: "2026-10-12T10:00:00.000Z" },
    ];
    expect(shoppingToAdd(["pão", "Leite", "Ovos", "ovos"], items)).toEqual({
      add: ["Leite", "Ovos"],
      already: ["pão"],
    });
  });
});
