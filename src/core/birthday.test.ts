import { describe, expect, it } from "vitest";
import { birthdayAge, birthdayTitle } from "./birthday";
import { occurrenceDates, type Repetition } from "./repetition";

const yearly: Repetition = { frequency: "yearly", interval: 1, end: { type: "never" } };

describe("birthdayAge", () => {
  it("is the years between birth and the Occurrence when the year is known", () => {
    expect(birthdayAge("1946-03-12", "2026-03-12", true)).toBe(80);
  });

  it("is unknown without the birth year", () => {
    expect(birthdayAge("2000-03-12", "2026-03-12", false)).toBeNull();
  });

  it("shows no age on the day of birth itself", () => {
    expect(birthdayAge("2026-03-12", "2026-03-12", true)).toBeNull();
  });
});

describe("birthdayTitle", () => {
  it("adds the age after the name", () => {
    expect(birthdayTitle("Grandma Rosa", 80)).toBe("Grandma Rosa, 80");
    expect(birthdayTitle("Grandma Rosa", null)).toBe("Grandma Rosa");
  });
});

describe("29 February Birthdays", () => {
  it("fall on 28 February in other years and on 29 February in leap years", () => {
    expect(occurrenceDates("2008-02-29", yearly, "2026-01-01", "2028-12-31")).toEqual([
      "2026-02-28",
      "2027-02-28",
      "2028-02-29",
    ]);
    expect(birthdayAge("2008-02-29", "2026-02-28", true)).toBe(18);
  });
});
