import { describe, expect, it } from "vitest";
import { giftsFor, parseGift, seesGiftsFor, type GiftIdea } from "./gifts";

const gift = (over: Partial<GiftIdea>): GiftIdea => ({
  id: "g",
  personId: "bia",
  text: "Lego",
  link: "",
  occasion: "any",
  givenOn: null,
  createdBy: null,
  createdAt: "2026-11-01",
  changedAt: "2026-11-01",
  ...over,
});

describe("Gift Ideas", () => {
  it("are cleaned, for any time unless said", () => {
    expect(parseGift({ personId: "bia", text: " Lego " })).toEqual({
      gift: { personId: "bia", text: "Lego", link: "", occasion: "any", givenOn: null },
    });
    expect(parseGift({ personId: "bia", text: "" })).toEqual({ field: "text" });
    expect(parseGift({ personId: "bia", text: "x", link: "javascript:alert(1)" })).toEqual({
      field: "link",
    });
    expect(parseGift({ personId: "bia", text: "x", occasion: "easter" })).toEqual({
      field: "occasion",
    });
  });

  it("are kept from the Person they are for", () => {
    expect(seesGiftsFor({ personId: "bia" }, "bia")).toBe(false);
    expect(seesGiftsFor({ personId: "rui" }, "bia")).toBe(true);
    expect(seesGiftsFor({ personId: null }, "bia")).toBe(true);
  });

  it("are picked by occasion, those not given first", () => {
    const list = [
      gift({ id: "given", givenOn: "2026-01-01" }),
      gift({ id: "xmas", occasion: "christmas", createdAt: "2026-11-03" }),
      gift({ id: "bday", occasion: "birthday" }),
      gift({ id: "any", createdAt: "2026-11-02" }),
    ];
    expect(giftsFor(list, "christmas").map((g) => g.id)).toEqual(["any", "xmas", "given"]);
    expect(giftsFor(list, "birthday").map((g) => g.id)).toEqual(["bday", "any", "given"]);
  });
});
