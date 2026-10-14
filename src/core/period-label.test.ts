import { describe, expect, it } from "vitest";
import { periodLabel } from "./period-label";

describe("periodLabel", () => {
  it("names a year by its number", () => {
    expect(periodLabel("year", "2027-01-01", "2027-12-31", "pt-PT")).toEqual(["2027"]);
    expect(periodLabel("year", "2027-01-01", "2027-12-31", "en-GB")).toEqual(["2027"]);
  });

  it("names a month with a capital and its year", () => {
    expect(periodLabel("month", "2026-11-01", "2026-11-30", "pt-PT")).toEqual(["Novembro 2026"]);
    expect(periodLabel("month", "2026-11-01", "2026-11-30", "en-GB")).toEqual(["November 2026"]);
  });

  it("names a day with its weekday, short in Portuguese", () => {
    expect(periodLabel("day", "2026-10-26", "2026-10-26", "pt-PT")).toEqual([
      "Segunda, 26 Outubro 2026",
    ]);
    expect(periodLabel("day", "2026-10-26", "2026-10-26", "en-GB")).toEqual([
      "Monday, 26 October 2026",
    ]);
  });

  it("names a week across two months on three lines", () => {
    expect(periodLabel("range", "2026-10-26", "2026-11-01", "pt-PT")).toEqual([
      "26 Outubro",
      "1 Novembro",
      "2026",
    ]);
    expect(periodLabel("range", "2026-10-26", "2026-11-01", "en-GB")).toEqual([
      "26 October",
      "1 November",
      "2026",
    ]);
  });

  it("names a week across two years with both years", () => {
    expect(periodLabel("range", "2026-12-28", "2027-01-03", "pt-PT")).toEqual([
      "28 Dezembro 2026",
      "3 Janeiro 2027",
    ]);
    expect(periodLabel("range", "2026-12-28", "2027-01-03", "en-GB")).toEqual([
      "28 December 2026",
      "3 January 2027",
    ]);
  });
});
