import { describe, expect, it } from "vitest";
import { helpTip } from "./help";

const icon = { name: "Search", showsName: false, what: "Find anything.", more: "Words, quotes." };
const labelled = { ...icon, showsName: true };

describe("helpTip", () => {
  it("shows nothing when off", () => {
    expect(helpTip("off", icon)).toBeNull();
  });

  it("names only icon buttons at low", () => {
    expect(helpTip("low", icon)).toEqual({ name: "Search", what: null, more: null });
    expect(helpTip("low", labelled)).toBeNull();
  });

  it("adds what it does at medium and the detail at high", () => {
    expect(helpTip("medium", labelled)).toEqual({
      name: "Search",
      what: "Find anything.",
      more: null,
    });
    expect(helpTip("high", labelled)).toEqual({
      name: "Search",
      what: "Find anything.",
      more: "Words, quotes.",
    });
  });

  it("skips a labelled button with nothing more to say", () => {
    expect(helpTip("high", { ...labelled, what: null, more: null })).toBeNull();
    expect(helpTip("medium", { ...icon, what: null, more: null })).toEqual({
      name: "Search",
      what: null,
      more: null,
    });
  });

  it("shows nothing without a name", () => {
    expect(helpTip("high", { ...icon, name: "  " })).toBeNull();
  });
});
