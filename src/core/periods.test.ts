import { describe, expect, it } from "vitest";
import { neighbourWindows, periodWindow, stepPeriod } from "./periods";

describe("periodWindow", () => {
  it("covers what each view draws", () => {
    expect(periodWindow("day", "2026-10-14")).toEqual({ from: "2026-10-14", to: "2026-10-14" });
    expect(periodWindow("week", "2026-10-12")).toEqual({ from: "2026-10-12", to: "2026-10-18" });
    // October 2026 starts on a Thursday and ends on a Saturday: the grid's whole weeks.
    expect(periodWindow("month", "2026-10-01")).toEqual({ from: "2026-09-28", to: "2026-11-01" });
    expect(periodWindow("year", "2026-01-01")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(periodWindow("agenda", "2026-10-14")).toEqual({ from: "2026-10-14", to: "2026-11-12" });
  });
});

describe("stepPeriod", () => {
  it("moves a period back or forward", () => {
    expect(stepPeriod("day", "2026-03-01", -1)).toBe("2026-02-28");
    expect(stepPeriod("week", "2026-12-28", 1)).toBe("2027-01-04");
    expect(stepPeriod("month", "2026-12-01", 1)).toBe("2027-01-01");
    expect(stepPeriod("month", "2026-01-01", -1)).toBe("2025-12-01");
    expect(stepPeriod("year", "2026-01-01", -1)).toBe("2025-01-01");
    expect(stepPeriod("agenda", "2026-10-14", 1)).toBe("2026-11-13");
  });
});

describe("neighbourWindows", () => {
  it("gives the previous then the next period's window", () => {
    expect(neighbourWindows("month", "2026-10-01")).toEqual([
      { from: "2026-08-31", to: "2026-10-04" },
      { from: "2026-10-26", to: "2026-12-06" },
    ]);
    expect(neighbourWindows("day", "2026-10-14")).toEqual([
      { from: "2026-10-13", to: "2026-10-13" },
      { from: "2026-10-15", to: "2026-10-15" },
    ]);
    expect(neighbourWindows("year", "2026-01-01")).toEqual([
      { from: "2025-01-01", to: "2025-12-31" },
      { from: "2027-01-01", to: "2027-12-31" },
    ]);
  });
});
