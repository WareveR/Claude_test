import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  daysInMonth,
  formatPlainDate,
  isPlainDate,
  startOfMonth,
  startOfWeek,
  todayIn,
  weekday,
} from "./plain-date";

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

  it("adds months, falling on the last day when the day is missing", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  });

  it("starts weeks on Monday", () => {
    expect(weekday("2026-10-05")).toBe(0);
    expect(weekday("2026-10-04")).toBe(6);
    expect(startOfWeek("2026-10-04")).toBe("2026-09-28");
    expect(startOfWeek("2026-10-05")).toBe("2026-10-05");
    expect(startOfMonth("2026-10-17")).toBe("2026-10-01");
  });

  it("reads today on the Family Time Zone's clocks", () => {
    const lateEvening = new Date("2026-10-02T23:30:00Z");
    expect(todayIn("Europe/Lisbon", lateEvening)).toBe("2026-10-03");
    expect(todayIn("America/New_York", lateEvening)).toBe("2026-10-02");
  });

  it("formats a date the same in every time zone", () => {
    expect(
      formatPlainDate("2026-10-02", "pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" }),
    ).toBe("02/10/2026");
    expect(formatPlainDate("2026-10-02", "en-GB", { weekday: "long" })).toBe("Friday");
  });
});
