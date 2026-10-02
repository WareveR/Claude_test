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

  it("validates the Family's holiday places", () => {
    expect(isHolidayPlaces([{ country: "PT" }, { country: "ES", state: "MD" }])).toBe(true);
    expect(isHolidayPlaces([{ country: "portugal" }])).toBe(false);
    expect(isHolidayPlaces([{ country: "ES", region: "x" }])).toBe(false);
  });
});
