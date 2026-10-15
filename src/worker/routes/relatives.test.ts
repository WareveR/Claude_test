import { describe, expect, it } from "vitest";
import type { Relative } from "../../core/family-tree";
import { setUpFamily, type TestBrowser } from "../test/client";

const tree = async (browser: TestBrowser) =>
  (await (await browser.get("/relatives")).json()) as Relative[];

async function add(browser: TestBrowser, body: Record<string, unknown>) {
  const res = await browser.post("/relatives", body);
  expect(res.status).toBe(201);
  return (await res.json()) as Relative;
}

describe("Family Tree", () => {
  it("adds Relatives with their parents, partners and children", async () => {
    const browser = await setUpFamily();
    const baby = await add(browser, { name: " Leonor ", sex: "f", birthDate: "2026-03-01" });
    expect(baby).toMatchObject({ name: "Leonor", nickname: "", parentIds: [], partnerIds: [] });
    // A mother added from the baby's card.
    const mum = await add(browser, {
      name: "Rita",
      nickname: "Mamã",
      sex: "f",
      childIds: [baby.id],
      notes: "Gosta de jardins.",
    });
    const dad = await add(browser, {
      name: "David",
      sex: "m",
      partnerIds: [mum.id],
      childIds: [baby.id],
    });
    const all = await tree(browser);
    expect(all.find((r) => r.id === baby.id)!.parentIds.sort()).toEqual([mum.id, dad.id].sort());
    expect(all.find((r) => r.id === mum.id)).toMatchObject({
      partnerIds: [dad.id],
      notes: "Gosta de jardins.",
    });

    // A third parent, or someone as their own grandparent, is refused.
    const third = await browser.post("/relatives", { name: "X", childIds: [baby.id] });
    expect(third.status).toBe(400);
    const loop = await browser.request("PATCH", `/relatives/${mum.id}`, { parentIds: [baby.id] });
    expect(await loop.json()).toMatchObject({ field: "parentIds" });
    const bad = await browser.post("/relatives", { name: "Y", birthDate: "1950-13-01" });
    expect(await bad.json()).toMatchObject({ field: "birthDate" });
  });

  it("changes details and links, and deletes a Relative keeping the others", async () => {
    const browser = await setUpFamily();
    const gran = await add(browser, { name: "Rosa", sex: "f" });
    const grandpa = await add(browser, { name: "João", sex: "m" });
    const mum = await add(browser, { name: "Rita", parentIds: [gran.id] });
    const changed = await browser.request("PATCH", `/relatives/${mum.id}`, {
      parentIds: [gran.id, grandpa.id],
      deathDate: null,
      birthPlace: "Porto",
    });
    expect(await changed.json()).toMatchObject({ birthPlace: "Porto" });
    await browser.request("PATCH", `/relatives/${gran.id}`, { partnerIds: [grandpa.id] });
    expect((await tree(browser)).find((r) => r.id === grandpa.id)!.partnerIds).toEqual([gran.id]);

    expect((await browser.request("DELETE", `/relatives/${gran.id}`)).status).toBe(204);
    const left = await tree(browser);
    expect(left.map((r) => r.name).sort()).toEqual(["João", "Rita"]);
    expect(left.find((r) => r.id === mum.id)!.parentIds).toEqual([grandpa.id]);
    expect(left.find((r) => r.id === grandpa.id)!.partnerIds).toEqual([]);
    expect((await browser.request("DELETE", `/relatives/${gran.id}`)).status).toBe(404);
  });
});
