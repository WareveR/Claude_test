import Holidays from "date-holidays";
import { describe, expect, it } from "vitest";
import { isHolidayPlaces, publicHolidays } from "./holidays";

describe("Public Holidays", () => {
  it("lists Portugal's national holidays for 2026 in Portuguese", () => {
    const days = publicHolidays(Holidays, [{ country: "PT" }], "2026-01-01", "2026-12-31", "pt-PT");
    expect([...days.keys()]).toEqual([
      "2026-01-01",
      "2026-04-03",
      "2026-04-05",
      "2026-04-25",
      "2026-05-01",
      "2026-06-04",
      "2026-06-10",
      "2026-08-15",
      "2026-10-05",
      "2026-11-01",
      "2026-12-01",
      "2026-12-08",
      "2026-12-25",
    ]);
    expect(days.get("2026-04-25")).toEqual(["Dia da Liberdade"]);
  });

  it("names them in the device's language and keeps to the window", () => {
    const days = publicHolidays(Holidays, [{ country: "PT" }], "2026-12-20", "2027-01-02", "en");
    expect([...days.keys()]).toEqual(["2026-12-25", "2027-01-01"]);
    expect(days.get("2026-12-25")).toEqual(["Christmas Day"]);
  });

  it("merges several countries without repeating a shared day", () => {
    const days = publicHolidays(
      Holidays,
      [{ country: "PT" }, { country: "ES" }],
      "2026-12-25",
      "2026-12-25",
      "en",
    );
    expect(days.get("2026-12-25")).toEqual(["Christmas Day"]);
  });

  it("gives the same holidays as a fresh calendar on every call", () => {
    const places = [
      { country: "PT" },
      { country: "ES", state: "MD" },
      { country: "DE", state: "BY" },
    ];
    for (const language of ["pt-PT", "en", "pt-PT"]) {
      for (const [from, to] of [
        ["2026-01-01", "2026-12-31"],
        ["2026-12-20", "2028-01-10"],
        ["2026-01-01", "2026-12-31"],
      ]) {
        const fresh = new Map<string, string[]>();
        for (const place of places) {
          const calendar = new Holidays(place.country, place.state ?? "");
          for (let year = +from.slice(0, 4); year <= +to.slice(0, 4); year++) {
            for (const h of calendar.getHolidays(year, language.slice(0, 2))) {
              const date = h.date.slice(0, 10);
              if (h.type !== "public" || date < from || date > to) continue;
              const names = fresh.get(date) ?? [];
              if (!names.includes(h.name)) names.push(h.name);
              fresh.set(date, names);
            }
          }
        }
        const days = publicHolidays(Holidays, places, from, to, language);
        expect([...days].sort()).toEqual([...fresh].sort());
      }
    }
  });

  it("validates the Family's holiday places", () => {
    expect(isHolidayPlaces([{ country: "PT" }, { country: "ES", state: "MD" }])).toBe(true);
    expect(isHolidayPlaces([{ country: "portugal" }])).toBe(false);
    expect(isHolidayPlaces([{ country: "ES", region: "x" }])).toBe(false);
  });
});
