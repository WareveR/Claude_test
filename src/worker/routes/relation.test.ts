import { describe, expect, it } from "vitest";
import { setUpFamily, type TestBrowser } from "../test/client";

type Relative = {
  id: string;
  name: string;
  personId: string | null;
  parentIds: string[];
  partnerIds: string[];
};

async function person(browser: TestBrowser, name: string, extra = {}) {
  const res = await browser.post("/persons", { name, color: "#e07a5f", ...extra });
  return ((await res.json()) as { id: string }).id;
}

async function relate(browser: TestBrowser, a: string, relation: string, b: string) {
  const res = await browser.post(`/persons/${a}/relation`, { relation, personId: b });
  return { status: res.status, tree: res.status === 200 ? ((await res.json()) as Relative[]) : [] };
}

const of = (tree: Relative[], personId: string) => tree.find((r) => r.personId === personId)!;

describe("relations between Persons", () => {
  it("makes partners, and a child theirs too", async () => {
    const browser = await setUpFamily();
    const david = await person(browser, "David", { dateOfBirth: "1980-05-01" });
    const carla = await person(browser, "Carla");
    const bia = await person(browser, "Bia");
    expect((await relate(browser, david, "partner", carla)).status).toBe(200);
    const { tree } = await relate(browser, bia, "child", david);
    expect(of(tree, david)).toMatchObject({ name: "David", partnerIds: [of(tree, carla).id] });
    expect(of(tree, david)).toMatchObject({ birthDate: "1980-05-01" });
    expect(of(tree, bia).parentIds.sort()).toEqual([of(tree, david).id, of(tree, carla).id].sort());
  });

  it("links a Person to a Relative of the same name already in the tree", async () => {
    const browser = await setUpFamily();
    await browser.post("/relatives", { name: "Avó Rosa" });
    const rosa = await person(browser, "avó rosa");
    const ana = await person(browser, "Ana");
    const { tree } = await relate(browser, rosa, "parent", ana);
    expect(tree.filter((r) => r.name.toLowerCase() === "avó rosa")).toHaveLength(1);
    expect(of(tree, ana).parentIds).toEqual([of(tree, rosa).id]);
  });

  it("makes siblings share parents, or an unknown one when neither has any", async () => {
    const browser = await setUpFamily();
    const mulher = await person(browser, "Sara");
    const carla = await person(browser, "Carla");
    const { tree } = await relate(browser, carla, "sibling", mulher);
    const shared = of(tree, carla).parentIds;
    expect(shared).toHaveLength(1);
    expect(of(tree, mulher).parentIds).toEqual(shared);
    expect(tree.find((r) => r.id === shared[0])!.name).toBe("?");

    const rui = await person(browser, "Rui");
    const next = await relate(browser, rui, "sibling", carla);
    expect(of(next.tree, rui).parentIds).toEqual(shared);
  });

  it("refuses a third parent, a sibling with other parents and oneself", async () => {
    const browser = await setUpFamily();
    const [a, b, c, d] = [
      await person(browser, "A"),
      await person(browser, "B"),
      await person(browser, "C"),
      await person(browser, "D"),
    ];
    await relate(browser, a, "parent", d);
    await relate(browser, b, "parent", d);
    expect((await relate(browser, c, "parent", d)).status).toBe(409);
    await relate(browser, c, "parent", b);
    expect((await relate(browser, b, "sibling", d)).status).toBe(409);
    expect((await relate(browser, a, "partner", a)).status).toBe(400);
    expect((await relate(browser, a, "other", b)).status).toBe(204);
    expect((await relate(browser, a, "cousin", b)).status).toBe(400);
  });
});
