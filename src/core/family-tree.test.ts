import { describe, expect, it } from "vitest";
import {
  ageOf,
  connection,
  isDescendant,
  kinship,
  layoutTree,
  siblingsOf,
  type Relative,
  type Sex,
} from "./family-tree";

function rel(id: string, sex: Sex, parentIds: string[] = [], partnerIds: string[] = []): Relative {
  return {
    id,
    name: id,
    nickname: "",
    sex,
    birthDate: null,
    deathDate: null,
    birthPlace: "",
    photoKey: null,
    notes: "",
    parentIds,
    partnerIds,
  };
}

// Great-grandparents gg1+gg2 → grandma (+grandpa) → mum (+dad) → baby, sister;
// grandma's brother uncle → his son cousinDad → cousin (baby's second cousin);
// mum's sister aunt → firstCousin; dad's mother inLawGran.
const family: Relative[] = [
  rel("gg1", "m", [], ["gg2"]),
  rel("gg2", "f", [], ["gg1"]),
  rel("grandma", "f", ["gg1", "gg2"], ["grandpa"]),
  rel("grandpa", "m", [], ["grandma"]),
  rel("greatUncle", "m", ["gg1", "gg2"]),
  rel("cousinDad", "m", ["greatUncle"]),
  rel("secondCousin", "f", ["cousinDad"]),
  rel("mum", "f", ["grandma", "grandpa"], ["dad"]),
  rel("aunt", "f", ["grandma", "grandpa"]),
  rel("firstCousin", "m", ["aunt"]),
  rel("dadsMum", "f"),
  rel("dad", "m", ["dadsMum"], ["mum"]),
  rel("baby", "f", ["mum", "dad"]),
  rel("sister", "f", ["mum", "dad"]),
  rel("halfBrother", "m", ["dad", "exWife"]),
  rel("exWife", "f"),
];

const word = (a: string, b: string) => {
  const k = kinship(family, a, b);
  return k.kind === "blood" || k.kind === "affinity" ? k.word : k.kind;
};

describe("family tree kinship", () => {
  it("names the direct line both ways, with its civil degree", () => {
    expect(word("baby", "mum")).toBe("parent");
    expect(word("baby", "grandma")).toBe("grandparent");
    expect(word("baby", "gg2")).toBe("greatGrandparent");
    expect(word("gg1", "baby")).toBe("greatGrandchild");
    expect(kinship(family, "baby", "grandma")).toMatchObject({ degree: 2, line: "direct" });
  });

  it("names the side lines", () => {
    expect(word("baby", "sister")).toBe("sibling");
    expect(word("baby", "halfBrother")).toBe("halfSibling");
    expect(word("baby", "aunt")).toBe("uncle");
    expect(word("aunt", "baby")).toBe("nephew");
    expect(word("baby", "firstCousin")).toBe("cousin");
    expect(word("baby", "greatUncle")).toBe("greatUncle");
    expect(word("mum", "secondCousin")).toBe("distantCousin");
    expect(kinship(family, "baby", "firstCousin")).toMatchObject({
      degree: 4,
      line: "collateral",
      ancestorIds: ["grandma", "grandpa"],
    });
    expect(kinship(family, "baby", "secondCousin")).toMatchObject({
      word: "nthCousin",
      count: 2,
      degree: 6,
    });
  });

  it("names family by marriage", () => {
    expect(word("mum", "dad")).toBe("partner");
    expect(word("dad", "grandma")).toBe("parentInLaw");
    expect(word("grandma", "dad")).toBe("childInLaw");
    expect(word("dad", "aunt")).toBe("siblingInLaw");
    expect(word("mum", "halfBrother")).toBe("stepChild");
    expect(kinship(family, "dad", "firstCousin")).toMatchObject({
      kind: "via",
      viaId: "mum",
      viaSide: "a",
      inner: { word: "nephew" },
    });
    expect(word("grandma", "dadsMum")).toBe("none");
  });

  it("finds the chain between two Relatives", () => {
    expect(connection(family, "baby", "firstCousin")).toEqual([
      "baby",
      "mum",
      "grandma",
      "aunt",
      "firstCousin",
    ]);
    expect(connection(family, "baby", "nobody")).toEqual([]);
  });

  it("knows siblings and descendants", () => {
    expect(siblingsOf(family, "baby").map((r) => r.id)).toEqual(["sister", "halfBrother"]);
    expect(isDescendant(family, "grandma", "baby")).toBe(true);
    expect(isDescendant(family, "baby", "grandma")).toBe(false);
  });

  it("works out ages, at death too", () => {
    expect(ageOf({ birthDate: "2000-10-16", deathDate: null }, "2026-10-15")).toBe(25);
    expect(ageOf({ birthDate: "2000-10-15", deathDate: null }, "2026-10-15")).toBe(26);
    expect(ageOf({ birthDate: "1920-01-01", deathDate: "2001-06-30" }, "2026-10-15")).toBe(81);
    expect(ageOf({ birthDate: null, deathDate: null }, "2026-10-15")).toBeNull();
  });
});

describe("family tree layout", () => {
  it("puts generations in rows from the root, partners together", () => {
    const { rows } = layoutTree(family, "baby");
    expect(rows.map((r) => r.generation)).toEqual([-3, -2, -1, 0]);
    const units = (g: number) => rows.find((r) => r.generation === g)!.units;
    expect(units(-3)).toEqual([["gg2", "gg1"]]);
    expect(units(-1)).toContainEqual(["mum", "dad"]);
    expect(units(0).flat().sort()).toEqual(
      ["baby", "firstCousin", "halfBrother", "secondCousin", "sister"].sort(),
    );
    // Every Relative shows once.
    expect(rows.flatMap((r) => r.units.flat()).sort()).toEqual(family.map((r) => r.id).sort());
  });

  it("keeps children under their parents", () => {
    const { rows } = layoutTree(family, "baby");
    const flat = (g: number) => rows.find((r) => r.generation === g)!.units.flat();
    const parents = flat(-1);
    const children = flat(0);
    // The aunt's son comes on the aunt's side of the row.
    const auntLeft = parents.indexOf("aunt") < parents.indexOf("mum");
    const cousinLeft = children.indexOf("firstCousin") < children.indexOf("baby");
    expect(cousinLeft).toBe(auntLeft);
  });
});
