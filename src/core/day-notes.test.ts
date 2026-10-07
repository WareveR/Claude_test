import * as A from "astronomy-engine";
import { describe, expect, it } from "vitest";
import { dayNotes, easter, moonNow, specialDays, sunTimes } from "./day-notes";

const LISBON = { latitude: 38.72, longitude: -9.14 };
const TZ = "Europe/Lisbon";
const keys = (notes: Map<string, { key: string }[]>, date: string) =>
  (notes.get(date) ?? []).map((n) => n.key);

describe("day notes", () => {
  it("finds Easter", () => {
    expect(easter(2026)).toBe("2026-04-05");
    expect(easter(2027)).toBe("2027-03-28");
    expect(easter(2025)).toBe("2025-04-20");
  });

  it("puts Portugal's special days on their dates", () => {
    const days = new Map(specialDays(2026).map(([date, key]) => [key, date]));
    expect(days.get("special.mothersDay")).toBe("2026-05-03");
    expect(days.get("special.carnival")).toBe("2026-02-17");
    expect(days.get("special.fathersDay")).toBe("2026-03-19");
  });

  it("shows only the chosen layers", () => {
    const notes = dayNotes(A, {
      from: "2026-10-01",
      to: "2026-10-31",
      timeZone: TZ,
      layers: [],
      place: null,
    });
    expect(notes.size).toBe(0);
  });

  it("marks Portugal's school breaks and the return to school", () => {
    const notes = dayNotes(A, {
      from: "2026-12-01",
      to: "2027-01-31",
      timeZone: TZ,
      layers: ["school"],
      place: null,
    });
    expect(keys(notes, "2026-12-16")).toEqual(["school.christmasBreak"]);
    expect(keys(notes, "2027-01-04")).toEqual(["school.back"]);
  });

  it("marks the Moon's phases", () => {
    const notes = dayNotes(A, {
      from: "2026-10-01",
      to: "2026-10-31",
      timeZone: TZ,
      layers: ["moon"],
      place: null,
    });
    expect(keys(notes, "2026-10-26")).toEqual(["moon.full"]);
    expect(keys(notes, "2026-10-10")).toEqual(["moon.new"]);
    expect([...notes.values()].flat()).toHaveLength(4);
  });

  it("tells the Moon's phase now and when the next phases come", () => {
    const moon = moonNow(A, new Date("2026-10-07T12:00:00Z"), TZ);
    expect(moon.phase).toBe("waningCrescent");
    expect(moon.lit).toBeGreaterThan(0);
    expect(moon.lit).toBeLessThan(50);
    expect(moon.next.map((n) => [n.key, n.date])).toEqual([
      ["moon.new", "2026-10-10"],
      ["moon.firstQuarter", expect.stringMatching(/^2026-10-1[78]$/)],
    ]);
    expect(moonNow(A, new Date("2026-10-26T12:00:00Z"), TZ).phase).toBe("full");
  });

  it("marks the start of each season", () => {
    const notes = dayNotes(A, {
      from: "2026-01-01",
      to: "2026-12-31",
      timeZone: TZ,
      layers: ["seasons"],
      place: null,
    });
    expect(keys(notes, "2026-03-20")).toEqual(["season.spring"]);
    expect(keys(notes, "2026-06-21")).toEqual(["season.summer"]);
    expect(keys(notes, "2026-09-23")).toEqual(["season.autumn"]);
    expect(keys(notes, "2026-12-21")).toEqual(["season.winter"]);
  });

  it("marks the nights the clocks change", () => {
    const notes = dayNotes(A, {
      from: "2026-01-01",
      to: "2026-12-31",
      timeZone: TZ,
      layers: ["clock"],
      place: null,
    });
    expect(keys(notes, "2026-03-29")).toEqual(["clock.forward"]);
    expect(keys(notes, "2026-10-25")).toEqual(["clock.back"]);
    expect([...notes.values()].flat()).toHaveLength(2);
  });

  it("shows the 2026 solar eclipse that can be seen from Lisbon", () => {
    const notes = dayNotes(A, {
      from: "2026-08-01",
      to: "2026-08-31",
      timeZone: TZ,
      layers: ["sky"],
      place: LISBON,
    });
    expect(keys(notes, "2026-08-12")).toEqual(expect.arrayContaining(["sky.perseids"]));
    expect(keys(notes, "2026-08-12").some((k) => k.startsWith("sky.solarEclipse."))).toBe(true);
  });

  it("gives sunrise and sunset in the Family's clock", () => {
    const { rise, set } = sunTimes(A, "2026-06-21", TZ, LISBON);
    expect(rise).toMatch(/^06:1\d$/);
    expect(set).toMatch(/^21:0\d$/);
  });
});
