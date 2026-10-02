import { describe, expect, it } from "vitest";
import { occurrencesOf } from "./occurrences";

describe("occurrencesOf", () => {
  it("gives a one-off Entry one Occurrence when it touches the window", () => {
    const time = { allDay: true as const, startDate: "2026-08-01", endDate: "2026-08-15" };
    expect(occurrencesOf({ time, repetition: null }, "2026-08-10", "2026-08-16")).toHaveLength(1);
    expect(occurrencesOf({ time, repetition: null }, "2026-08-16", "2026-08-22")).toHaveLength(0);
  });

  it("repeats a weekly overnight shift, reaching into the next day", () => {
    const shift = {
      time: {
        allDay: false as const,
        startDate: "2026-10-02",
        startTime: "22:00",
        endDate: "2026-10-03",
        endTime: "06:00",
      },
      repetition: { frequency: "weekly" as const, interval: 1, end: { type: "never" as const } },
    };
    // The window starts on the Saturday the Friday shift ends on.
    const occurrences = occurrencesOf(shift, "2026-10-10", "2026-10-16");
    expect(occurrences.map((o) => o.date)).toEqual(["2026-10-09", "2026-10-16"]);
    expect(occurrences[0].time).toMatchObject({ endDate: "2026-10-10", endTime: "06:00" });
  });

  it("repeats a yearly multi-day holiday", () => {
    const holiday = {
      time: { allDay: true as const, startDate: "2026-12-24", endDate: "2026-12-26" },
      repetition: { frequency: "yearly" as const, interval: 1, end: { type: "never" as const } },
    };
    const [christmas] = occurrencesOf(holiday, "2027-12-26", "2027-12-31");
    expect(christmas).toEqual({
      date: "2027-12-24",
      time: { allDay: true, startDate: "2027-12-24", endDate: "2027-12-26" },
    });
  });
});
