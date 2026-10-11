import { describe, expect, it } from "vitest";
import { releaseNumber } from "./release-number";

describe("releaseNumber", () => {
  it("is the base when nothing was merged since", () => {
    expect(releaseNumber("1.0.0", [])).toBe("1.0.0");
  });

  it("counts features in the middle number and fixes in the last, oldest first", () => {
    expect(
      releaseNumber("1.0.0", [
        "Agenda view (#174)",
        "Fix: the week skips a day (#180)",
        "fix the readback pause (#181)",
        "Search (#178)",
        "Fix: search misses accents (#182)",
      ]),
    ).toBe("1.2.1");
  });

  it("doesn't take a word that only starts with fix for a fix", () => {
    expect(releaseNumber("2.3.4", ["Fixture data for tests"])).toBe("2.4.0");
  });
});
