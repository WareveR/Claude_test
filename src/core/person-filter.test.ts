import { describe, expect, it } from "vitest";
import {
  checklistMatches,
  isFiltering,
  matchesFilter,
  NO_FILTER,
  parseFilter,
} from "./person-filter";

describe("Person Filter", () => {
  const kids = { personIds: ["ana", "bia"], familyWide: true };

  it("shows everything when nothing is picked", () => {
    expect(matchesFilter(["dad"], NO_FILTER)).toBe(true);
    expect(matchesFilter([], NO_FILTER)).toBe(true);
    expect(isFiltering(NO_FILTER)).toBe(false);
  });

  it("matches any of the picked Persons", () => {
    expect(matchesFilter(["ana"], kids)).toBe(true);
    expect(matchesFilter(["dad", "bia"], kids)).toBe(true);
    expect(matchesFilter(["dad"], kids)).toBe(false);
  });

  it("includes Family-wide items unless switched off", () => {
    expect(matchesFilter([], kids)).toBe(true);
    expect(matchesFilter([], { ...kids, familyWide: false })).toBe(false);
    expect(matchesFilter(["dad"], { personIds: [], familyWide: false })).toBe(true);
  });

  it("shows a Checklist when any of its Tasks matches", () => {
    expect(checklistMatches([["dad"], ["bia"]], kids)).toBe(true);
    expect(checklistMatches([["dad"]], kids)).toBe(false);
    expect(checklistMatches([], { ...kids, familyWide: false })).toBe(false);
  });

  it("reads a stored filter defensively", () => {
    expect(parseFilter(null)).toEqual(NO_FILTER);
    expect(parseFilter({ personIds: ["ana", 3], familyWide: false })).toEqual({
      personIds: ["ana"],
      familyWide: false,
    });
  });
});
