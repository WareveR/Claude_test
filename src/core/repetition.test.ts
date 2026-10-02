import { describe, expect, it } from "vitest";
import { isRepetition, occurrenceDates, type Repetition } from "./repetition";

const never = { type: "never" } as const;
const rep = (r: Partial<Repetition> & Pick<Repetition, "frequency">): Repetition => ({
  interval: 1,
  end: never,
  ...r,
});

describe("occurrenceDates", () => {
  it("repeats every 2 weeks", () => {
    expect(
      occurrenceDates(
        "2026-10-05",
        rep({ frequency: "weekly", interval: 2 }),
        "2026-10-01",
        "2026-11-10",
      ),
    ).toEqual(["2026-10-05", "2026-10-19", "2026-11-02"]);
  });

  it("repeats weekly on Tuesday and Thursday", () => {
    expect(
      occurrenceDates(
        "2026-10-06",
        rep({ frequency: "weekly", weekdays: [1, 3] }),
        "2026-10-01",
        "2026-10-16",
      ),
    ).toEqual(["2026-10-06", "2026-10-08", "2026-10-13", "2026-10-15"]);
  });

  it("starts weekly series on the first chosen weekday on or after the start", () => {
    // Starts on a Wednesday; Tuesday that week is before the start.
    expect(
      occurrenceDates(
        "2026-10-07",
        rep({ frequency: "weekly", weekdays: [1, 3] }),
        "2026-10-01",
        "2026-10-14",
      ),
    ).toEqual(["2026-10-08", "2026-10-13"]);
  });

  it("ends after a number of times, counting ones before the window", () => {
    expect(
      occurrenceDates(
        "2026-10-01",
        rep({ frequency: "daily", end: { type: "count", count: 5 } }),
        "2026-10-04",
        "2026-12-31",
      ),
    ).toEqual(["2026-10-04", "2026-10-05"]);
  });

  it("ends on a date, that date included", () => {
    expect(
      occurrenceDates(
        "2026-10-01",
        rep({ frequency: "weekly", end: { type: "until", date: "2026-10-15" } }),
        "2026-10-01",
        "2026-12-31",
      ),
    ).toEqual(["2026-10-01", "2026-10-08", "2026-10-15"]);
  });

  it("puts a monthly Entry on the 31st on the last day of shorter months", () => {
    expect(
      occurrenceDates("2026-01-31", rep({ frequency: "monthly" }), "2026-01-01", "2026-05-31"),
    ).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
  });

  it("repeats every 6 months", () => {
    expect(
      occurrenceDates(
        "2026-03-15",
        rep({ frequency: "monthly", interval: 6 }),
        "2026-01-01",
        "2027-12-31",
      ),
    ).toEqual(["2026-03-15", "2026-09-15", "2027-03-15", "2027-09-15"]);
  });

  it("puts a yearly 29 February on 28 February in other years", () => {
    expect(
      occurrenceDates("2028-02-29", rep({ frequency: "yearly" }), "2028-01-01", "2032-12-31"),
    ).toEqual(["2028-02-29", "2029-02-28", "2030-02-28", "2031-02-28", "2032-02-29"]);
  });

  it("returns nothing before the start", () => {
    expect(
      occurrenceDates("2026-10-05", rep({ frequency: "daily" }), "2026-09-01", "2026-09-30"),
    ).toEqual([]);
  });
});

describe("isRepetition", () => {
  it("accepts valid rules and refuses broken ones", () => {
    expect(isRepetition(rep({ frequency: "weekly", weekdays: [0, 6] }))).toBe(true);
    expect(isRepetition({ frequency: "hourly", interval: 1, end: never })).toBe(false);
    expect(isRepetition(rep({ frequency: "daily", interval: 0 }))).toBe(false);
    expect(isRepetition(rep({ frequency: "weekly", weekdays: [7] }))).toBe(false);
  });
});
