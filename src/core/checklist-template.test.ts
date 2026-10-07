import { describe, expect, it } from "vitest";
import {
  BUILT_IN_TEMPLATE_TEXT,
  BUILT_IN_TEMPLATES,
  cleanItems,
  MAX_TEMPLATE_ITEMS,
  templateText,
} from "./checklist-template";
import { LANGUAGES } from "./languages";

describe("Checklist templates", () => {
  it("has every built-in template in both languages, with 6 to 12 items each", () => {
    for (const key of BUILT_IN_TEMPLATES) {
      for (const language of LANGUAGES) {
        const { name, items } = BUILT_IN_TEMPLATE_TEXT[key][language];
        expect(name).not.toBe("");
        expect(items.length).toBeGreaterThanOrEqual(6);
        expect(items.length).toBeLessThanOrEqual(12);
        expect(new Set(items).size).toBe(items.length);
      }
      expect(BUILT_IN_TEMPLATE_TEXT[key].en.items.length).toBe(
        BUILT_IN_TEMPLATE_TEXT[key]["pt-PT"].items.length,
      );
    }
  });

  it("reads an unedited built-in template in the device's language", () => {
    const stored = { builtinKey: "summerCleaning", name: null, items: null };
    expect(templateText(stored, "en").name).toBe("Summer cleaning");
    expect(templateText(stored, "pt-PT").name).toBe("Limpeza de verão");
    expect(templateText(stored, "pt-PT").items[0]).toBe("Lavar as janelas");
  });

  it("keeps an edited built-in template's own name and items in every language", () => {
    const renamed = { builtinKey: "shopping", name: "Mercado", items: null };
    expect(templateText(renamed, "en")).toEqual({
      name: "Mercado",
      items: BUILT_IN_TEMPLATE_TEXT.shopping.en.items,
    });
    const edited = { builtinKey: "shopping", name: null, items: ["Pão"] };
    expect(templateText(edited, "en")).toEqual({ name: "Shopping", items: ["Pão"] });
  });

  it("reads a custom template as stored", () => {
    expect(templateText({ builtinKey: null, name: "Picnic", items: ["Blanket"] }, "pt-PT")).toEqual(
      { name: "Picnic", items: ["Blanket"] },
    );
  });

  it("cleans item names and refuses what isn't a list of names", () => {
    expect(cleanItems([" Bread ", "", "  ", "Milk"])).toEqual(["Bread", "Milk"]);
    expect(cleanItems("Bread")).toBeNull();
    expect(cleanItems([1, 2])).toBeNull();
    expect(cleanItems(Array.from({ length: MAX_TEMPLATE_ITEMS + 1 }, () => "x"))).toBeNull();
    expect(cleanItems(["x".repeat(201)])).toBeNull();
  });
});
