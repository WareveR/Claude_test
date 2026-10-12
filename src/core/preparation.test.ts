import { describe, expect, it } from "vitest";
import { preparationFor } from "./preparation";

describe("preparationFor", () => {
  it("finds a list by a word in the title, in either language", () => {
    expect(preparationFor("Natação", "activity")).toBe("swimming");
    expect(preparationFor("Swimming lesson", null)).toBe("swimming");
    expect(preparationFor("Supermercado", "home")).toBe("shopping");
    expect(preparationFor("Ginásio", "activity")).toBe("gymBag");
    expect(preparationFor("Voo para Paris", "general")).toBe("flight");
  });

  it("falls back to the type's list, and leaves the rest alone", () => {
    expect(preparationFor("consulta dentista mamã", "appointment")).toBe("appointment");
    expect(preparationFor("Jantar com amigos", "meal")).toBeNull();
    expect(preparationFor("Festa da Rute", "birthday")).toBeNull();
    expect(preparationFor("Comprar pão", "general")).toBeNull();
  });
});
