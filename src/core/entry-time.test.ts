import { describe, expect, it } from "vitest";
import {
  daySpan,
  entryTimeProblem,
  lastDate,
  moveStart,
  overlaps,
  shiftTime,
  type EntryTime,
} from "./entry-time";

const timed = (
  startDate: string,
  startTime: string,
  endDate: string | null = null,
  endTime: string | null = null,
): Extract<EntryTime, { allDay: false }> => ({
  allDay: false,
  startDate,
  startTime,
  endDate,
  endTime,
});

describe("Timed Entries", () => {
  it("can run from Friday 18:00 to Sunday 20:00", () => {
    const weekend = timed("2026-10-09", "18:00", "2026-10-11", "20:00");
    expect(entryTimeProblem(weekend)).toBeNull();
    expect(daySpan(weekend, "2026-10-09")).toEqual({ start: 1080, end: 1440, moment: false });
    expect(daySpan(weekend, "2026-10-10")).toEqual({ start: 0, end: 1440, moment: false });
    expect(daySpan(weekend, "2026-10-11")).toEqual({ start: 0, end: 1200, moment: false });
    expect(daySpan(weekend, "2026-10-12")).toBeNull();
  });

  it("without an end is a moment at its start", () => {
    const pickUp = timed("2026-10-09", "17:30");
    expect(lastDate(pickUp)).toBe("2026-10-09");
    expect(daySpan(pickUp, "2026-10-09")).toEqual({ start: 1050, end: 1080, moment: true });
  });

  it("must end after it starts, with both end date and time", () => {
    expect(entryTimeProblem(timed("2026-10-09", "18:00", "2026-10-09", "17:00"))).toBe(
      "end_before_start",
    );
    expect(entryTimeProblem(timed("2026-10-09", "18:00", "2026-10-09", null))).toBe(
      "end_incomplete",
    );
  });

  it("ending at midnight stops on the day before", () => {
    expect(lastDate(timed("2026-10-09", "20:00", "2026-10-10", "00:00"))).toBe("2026-10-09");
  });

  it("keeps its clock time on the day summer time ends", () => {
    // 25 October 2026 has 25 hours in Lisbon; a 10:00 class is still at 10:00.
    expect(daySpan(timed("2026-10-25", "10:00", "2026-10-25", "11:00"), "2026-10-25")).toEqual({
      start: 600,
      end: 660,
      moment: false,
    });
  });
});

describe("All-day Entries", () => {
  it("include both ends: 1 to 15 August covers the 15th", () => {
    const holiday: EntryTime = { allDay: true, startDate: "2026-08-01", endDate: "2026-08-15" };
    expect(overlaps(holiday, "2026-08-15", "2026-08-21")).toBe(true);
    expect(overlaps(holiday, "2026-08-16", "2026-08-22")).toBe(false);
  });

  it("can't end before they start", () => {
    expect(entryTimeProblem({ allDay: true, startDate: "2026-08-15", endDate: "2026-08-01" })).toBe(
      "end_before_start",
    );
  });
});

describe("moveStart", () => {
  it("keeps a Timed Entry's length when its start moves", () => {
    const dinner = timed("2026-10-09", "20:00", "2026-10-09", "23:00");
    expect(moveStart(dinner, "2026-10-16", "22:30")).toEqual(
      timed("2026-10-16", "22:30", "2026-10-17", "01:30"),
    );
  });

  it("moves an All-day Entry's whole range", () => {
    expect(
      moveStart({ allDay: true, startDate: "2026-08-01", endDate: "2026-08-15" }, "2026-08-03"),
    ).toEqual({ allDay: true, startDate: "2026-08-03", endDate: "2026-08-17" });
  });
});

describe("shiftTime", () => {
  it("moves a Timed Entry to another day and keeps its time and length", () => {
    const dinner = timed("2026-10-09", "20:10", "2026-10-09", "23:10");
    expect(shiftTime(dinner, 3)).toEqual(timed("2026-10-12", "20:10", "2026-10-12", "23:10"));
  });

  it("lands a start moved in minutes on a 15-minute step", () => {
    const call = timed("2026-10-09", "10:00", "2026-10-09", "10:30");
    expect(shiftTime(call, 0, 52)).toEqual(timed("2026-10-09", "10:45", "2026-10-09", "11:15"));
    expect(shiftTime(call, 1, -38)).toEqual(timed("2026-10-10", "09:15", "2026-10-10", "09:45"));
  });

  it("crosses midnight when moved late or early enough", () => {
    expect(shiftTime(timed("2026-10-09", "23:00"), 0, 75)).toEqual(timed("2026-10-10", "00:15"));
    expect(shiftTime(timed("2026-10-09", "00:30"), 0, -60)).toEqual(timed("2026-10-08", "23:30"));
  });

  it("moves an All-day Entry by whole days only", () => {
    const trip = { allDay: true, startDate: "2026-08-01", endDate: "2026-08-03" } as const;
    expect(shiftTime(trip, 2, 90)).toEqual({
      allDay: true,
      startDate: "2026-08-03",
      endDate: "2026-08-05",
    });
  });
});
