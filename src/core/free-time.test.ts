import { describe, expect, it } from "vitest";
import { clockOf, freeSlots, type BusyTime } from "./free-time";

const at = (
  date: string,
  start: string,
  end: string | null,
  personIds: string[] = [],
): BusyTime => ({
  time: {
    allDay: false,
    startDate: date,
    startTime: start,
    endDate: end ? date : null,
    endTime: end,
  },
  personIds,
});
const show = (slots: ReturnType<typeof freeSlots>) =>
  slots.map((s) => `${s.date} ${clockOf(s.start)}-${clockOf(s.end)}`);
const base = {
  personIds: ["ana", "rui"],
  from: "2026-11-18",
  to: "2026-11-18",
  sleep: { start: 23, end: 7 },
  minutes: 60,
  today: "2026-11-17",
  nowMinutes: 0,
};

describe("Free time", () => {
  it("is the waking hours left between the Persons' Entries", () => {
    const busy = [
      at("2026-11-18", "09:00", "17:30", ["ana"]),
      at("2026-11-18", "18:00", null, ["rui"]),
      at("2026-11-18", "20:00", "21:00", ["bia"]),
    ];
    expect(show(freeSlots({ ...base, busy }))).toEqual([
      "2026-11-18 07:00-09:00",
      "2026-11-18 19:00-23:00",
    ]);
  });

  it("counts Family-wide Entries for everyone and leaves out all-day ones", () => {
    const busy: BusyTime[] = [
      at("2026-11-18", "07:00", "22:30"),
      { time: { allDay: true, startDate: "2026-11-18", endDate: "2026-11-18" }, personIds: [] },
    ];
    expect(show(freeSlots({ ...base, busy, minutes: 30 }))).toEqual(["2026-11-18 22:30-23:00"]);
  });

  it("starts today after now, on the quarter hour, and skips past days", () => {
    expect(
      show(
        freeSlots({
          ...base,
          busy: [],
          from: "2026-11-16",
          to: "2026-11-17",
          nowMinutes: 20 * 60 + 5,
        }),
      ),
    ).toEqual(["2026-11-17 20:15-23:00"]);
  });

  it("follows an Entry across midnight", () => {
    const busy: BusyTime[] = [
      {
        time: {
          allDay: false,
          startDate: "2026-11-17",
          startTime: "22:00",
          endDate: "2026-11-18",
          endTime: "10:00",
        },
        personIds: [],
      },
    ];
    expect(show(freeSlots({ ...base, busy, minutes: 120 }))).toEqual(["2026-11-18 10:00-23:00"]);
  });
});
