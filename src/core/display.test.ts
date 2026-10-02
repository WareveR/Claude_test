import { describe, expect, it } from "vitest";
import {
  AUTO_RETURN_MS,
  boardDays,
  displayAllows,
  inOvernightWindow,
  msUntilMidnight,
} from "./display";

describe("boardDays", () => {
  it("starts today and covers seven days", () => {
    expect(boardDays("2026-09-30", 0)).toEqual([
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
    ]);
  });

  it("moves a whole week at a time, either way", () => {
    expect(boardDays("2026-09-30", 1)[0]).toBe("2026-10-07");
    expect(boardDays("2026-09-30", -2)[0]).toBe("2026-09-16");
  });
});

describe("msUntilMidnight", () => {
  it("counts to midnight in the Family Time Zone, not the device's", () => {
    // 23:30 in Lisbon (UTC+1 in summer) is 22:30 UTC.
    expect(msUntilMidnight("Europe/Lisbon", new Date("2026-07-01T22:30:00Z"))).toBe(30 * 60_000);
    expect(msUntilMidnight("UTC", new Date("2026-07-01T22:30:00Z"))).toBe(90 * 60_000);
  });

  it("includes the seconds already gone", () => {
    expect(msUntilMidnight("UTC", new Date("2026-07-01T23:59:30Z"))).toBe(30_000);
  });
});

describe("inOvernightWindow", () => {
  it("is open from 02:00 up to 05:00 in the Family Time Zone", () => {
    expect(inOvernightWindow("Europe/Lisbon", new Date("2026-07-01T00:59:00Z"))).toBe(false);
    expect(inOvernightWindow("Europe/Lisbon", new Date("2026-07-01T01:00:00Z"))).toBe(true);
    expect(inOvernightWindow("Europe/Lisbon", new Date("2026-07-01T03:59:00Z"))).toBe(true);
    expect(inOvernightWindow("Europe/Lisbon", new Date("2026-07-01T04:00:00Z"))).toBe(false);
  });
});

describe("displayAllows", () => {
  it("allows the board and an Entry's details only", () => {
    expect(displayAllows("/display")).toBe(true);
    expect(displayAllows("/entries/abc123")).toBe(true);
    expect(displayAllows("/entries/new")).toBe(false);
    expect(displayAllows("/settings")).toBe(false);
    expect(displayAllows("/tasks/abc")).toBe(false);
    expect(displayAllows("/day/2026-10-02")).toBe(false);
    expect(displayAllows("/")).toBe(false);
  });
});

it("returns to today after three minutes", () => {
  expect(AUTO_RETURN_MS).toBe(180_000);
});
