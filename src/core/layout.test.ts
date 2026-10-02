import { describe, expect, it } from "vitest";
import { layoutBars, layoutLanes } from "./layout";

describe("layoutLanes", () => {
  it("puts overlapping blocks side by side and lone ones full width", () => {
    const laid = layoutLanes([
      { id: "a", start: 540, end: 600 },
      { id: "b", start: 570, end: 660 },
      { id: "c", start: 720, end: 780 },
    ]);
    expect(laid.map(({ id, lane, lanes }) => ({ id, lane, lanes }))).toEqual([
      { id: "a", lane: 0, lanes: 2 },
      { id: "b", lane: 1, lanes: 2 },
      { id: "c", lane: 0, lanes: 1 },
    ]);
  });

  it("reuses a lane once it is free", () => {
    const laid = layoutLanes([
      { id: "a", start: 540, end: 600 },
      { id: "b", start: 550, end: 700 },
      { id: "c", start: 600, end: 650 },
    ]);
    expect(laid.find((b) => b.id === "c")).toMatchObject({ lane: 0, lanes: 2 });
  });
});

describe("layoutBars", () => {
  it("clips bars to the visible days and stacks overlapping ones", () => {
    const laid = layoutBars(
      [
        { id: "holiday", startDate: "2026-10-01", endDate: "2026-10-07" },
        { id: "trip", startDate: "2026-10-06", endDate: "2026-10-08" },
        { id: "later", startDate: "2026-10-10", endDate: "2026-10-10" },
      ],
      "2026-10-05",
      7,
    );
    expect(laid.map(({ id, column, span, row }) => ({ id, column, span, row }))).toEqual([
      { id: "holiday", column: 0, span: 3, row: 0 },
      { id: "trip", column: 1, span: 3, row: 1 },
      { id: "later", column: 5, span: 1, row: 0 },
    ]);
  });
});
