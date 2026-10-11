import { describe, expect, it } from "vitest";
import { descendantIds, leafProgress, settleDone, wouldNestInItself } from "./task-tree";

// A trip: clothes (socks, shirt), food (pasta), and passports at the top.
const items = [
  { id: "clothes", parentId: null, doneAt: null },
  { id: "socks", parentId: "clothes", doneAt: "t1" },
  { id: "shirt", parentId: "clothes", doneAt: null },
  { id: "food", parentId: null, doneAt: null },
  { id: "pasta", parentId: "food", doneAt: null },
  { id: "passports", parentId: null, doneAt: "t2" },
];

describe("leafProgress", () => {
  it("counts the items that hold none, overall and inside one", () => {
    expect(leafProgress(items)).toEqual({ done: 2, total: 4 });
    expect(leafProgress(items, "clothes")).toEqual({ done: 1, total: 2 });
  });

  it("treats a list without parents as flat", () => {
    expect(
      leafProgress([
        { id: "a", doneAt: "x" },
        { id: "b", doneAt: null },
      ]),
    ).toEqual({
      done: 1,
      total: 2,
    });
  });
});

describe("descendantIds and wouldNestInItself", () => {
  const deep = [...items, { id: "wool", parentId: "socks", doneAt: null }];
  it("finds everything inside, at any depth", () => {
    expect(descendantIds(deep, "clothes")).toEqual(["socks", "wool", "shirt"]);
  });
  it("refuses to put an item inside itself or its own items", () => {
    expect(wouldNestInItself(deep, "clothes", "wool")).toBe(true);
    expect(wouldNestInItself(deep, "clothes", "clothes")).toBe(true);
    expect(wouldNestInItself(deep, "wool", "food")).toBe(false);
    expect(wouldNestInItself(deep, "wool", null)).toBe(false);
  });
});

describe("settleDone", () => {
  it("ticks everything inside an item and keeps earlier ticks", () => {
    expect(settleDone(items, "now", { id: "clothes", done: true })).toEqual([
      { id: "clothes", doneAt: "now" },
      { id: "shirt", doneAt: "now" },
    ]);
  });

  it("ticks the item holding the last undone one", () => {
    expect(settleDone(items, "now", { id: "pasta", done: true })).toEqual([
      { id: "food", doneAt: "now" },
      { id: "pasta", doneAt: "now" },
    ]);
  });

  it("unticks the items holding one that is unticked, and everything inside it", () => {
    const allDone = items.map((i) => ({ ...i, doneAt: "t" }));
    expect(settleDone(allDone, "now", { id: "socks", done: false })).toEqual([
      { id: "clothes", doneAt: null },
      { id: "socks", doneAt: null },
    ]);
    expect(settleDone(allDone, "now", { id: "food", done: false })).toEqual([
      { id: "food", doneAt: null },
      { id: "pasta", doneAt: null },
    ]);
  });

  it("brings items with items in line without a tick, after adding or moving one", () => {
    const foodDone = items.map((i) =>
      i.id === "food" || i.id === "pasta" ? { ...i, doneAt: "t" } : i,
    );
    expect(
      settleDone([...foodDone, { id: "rice", parentId: "food", doneAt: null }], "now"),
    ).toEqual([{ id: "food", doneAt: null }]);
  });
});
