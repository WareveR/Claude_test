import { describe, expect, it } from "vitest";
import { binsOn, isWasteCollection } from "./waste";

describe("rubbish collection", () => {
  it("accepts bins with their weekdays and refuses anything else", () => {
    expect(isWasteCollection([])).toBe(true);
    expect(isWasteCollection([{ bin: "paper", weekdays: [1, 4] }])).toBe(true);
    expect(isWasteCollection([{ bin: "metal", weekdays: [1] }])).toBe(false);
    expect(isWasteCollection([{ bin: "paper", weekdays: [7] }])).toBe(false);
    expect(isWasteCollection([{ bin: "paper", weekdays: [1, 1] }])).toBe(false);
    expect(
      isWasteCollection([
        { bin: "paper", weekdays: [1] },
        { bin: "paper", weekdays: [2] },
      ]),
    ).toBe(false);
    expect(isWasteCollection({ bin: "paper" })).toBe(false);
  });

  it("lists the bins of a weekday in a fixed order", () => {
    const collection = [
      { bin: "glass" as const, weekdays: [2] },
      { bin: "general" as const, weekdays: [0, 2, 4] },
    ];
    expect(binsOn(collection, 2)).toEqual(["general", "glass"]);
    expect(binsOn(collection, 1)).toEqual([]);
  });
});
