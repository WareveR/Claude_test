import { describe, expect, it } from "vitest";
import { clockChangeWithin } from "./clock-change";

describe("clockChangeWithin", () => {
  it("finds Lisbon's autumn change: at 02:00 the clocks go back to 01:00", () => {
    expect(clockChangeWithin("Europe/Lisbon", "2026-10-20", 7)).toEqual({
      date: "2026-10-25",
      from: "02:00",
      to: "01:00",
    });
  });

  it("finds the spring change: at 01:00 the clocks go forward to 02:00", () => {
    expect(clockChangeWithin("Europe/Lisbon", "2027-03-28", 7)).toEqual({
      date: "2027-03-28",
      from: "01:00",
      to: "02:00",
    });
  });

  it("is null when the clocks don't change in those days, or never do", () => {
    expect(clockChangeWithin("Europe/Lisbon", "2026-10-26", 7)).toBeNull();
    expect(clockChangeWithin("Europe/Lisbon", "2026-10-10", 7)).toBeNull();
    expect(clockChangeWithin("UTC", "2026-10-20", 7)).toBeNull();
  });

  it("works in other time zones", () => {
    expect(clockChangeWithin("America/New_York", "2026-10-30", 7)).toEqual({
      date: "2026-11-01",
      from: "02:00",
      to: "01:00",
    });
  });
});
