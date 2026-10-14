import { describe, expect, it } from "vitest";
import { monthMotif, monthOfPath, monthPalette } from "./month-theme";

describe("monthOfPath", () => {
  const today = "2026-10-14";
  it("reads the month a calendar view shows", () => {
    expect(monthOfPath("/month/2026-12", today)).toBe(12);
    expect(monthOfPath("/day/2027-03-08", today)).toBe(3);
    expect(monthOfPath("/agenda/2027-01-05", today)).toBe(1);
  });
  it("gives a week the month of its Thursday", () => {
    expect(monthOfPath("/week/2026-10-26", today)).toBe(10);
    expect(monthOfPath("/week/2026-11-30", today)).toBe(12);
  });
  it("falls back to today's month elsewhere", () => {
    expect(monthOfPath("/year/2027", today)).toBe(10);
    expect(monthOfPath("/tasks", today)).toBe(10);
    expect(monthOfPath("/month/nonsense", today)).toBe(10);
  });
});

describe("month looks", () => {
  it("has twelve palettes and drawings", () => {
    for (let m = 1; m <= 12; m++) {
      expect(monthPalette(m).header).toMatch(/^#[0-9a-f]{6}$/);
      expect(monthMotif(m)).toMatch(/^<(path|circle|g) /);
    }
  });
});
