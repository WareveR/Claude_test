import { describe, expect, it } from "vitest";
import { addDays, daysInMonth, isPlainDate } from "./plain-date";

describe("PlainDate", () => {
  it("accepts real dates only", () => {
    expect(isPlainDate("2026-10-02")).toBe(true);
    expect(isPlainDate("2028-02-29")).toBe(true);
    expect(isPlainDate("2026-02-29")).toBe(false);
    expect(isPlainDate("2026-13-01")).toBe(false);
    expect(isPlainDate("2/10/2026")).toBe(false);
  });

  it("knows how long each month is", () => {
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2028, 2)).toBe(29);
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});
