import { describe, expect, it } from "vitest";
import {
  busyHours,
  DEFAULT_SLEEP_HOURS,
  hourHeights,
  hourTops,
  isSleepHour,
  isSleepHours,
  minutesAtY,
  openingHour,
  yOfMinutes,
} from "./sleep-hours";

const FULL = 44;

describe("Sleeping Hours", () => {
  it("wrap midnight", () => {
    const sleep = DEFAULT_SLEEP_HOURS;
    expect([22, 23, 0, 6, 7].map((h) => isSleepHour(sleep, h))).toEqual([
      false,
      true,
      true,
      true,
      false,
    ]);
  });

  it("can also sit within one day, or be none at all", () => {
    expect([0, 1, 7, 8].map((h) => isSleepHour({ start: 1, end: 8 }, h))).toEqual([
      false,
      true,
      true,
      false,
    ]);
    expect(isSleepHour({ start: 5, end: 5 }, 5)).toBe(false);
  });

  it("are whole hours of the day", () => {
    expect(isSleepHours({ start: 23, end: 7 })).toBe(true);
    expect(isSleepHours({ start: 24, end: 7 })).toBe(false);
    expect(isSleepHours({ start: 22.5, end: 7 })).toBe(false);
    expect(isSleepHours({ start: "23", end: 7 })).toBe(false);
    expect(isSleepHours(null)).toBe(false);
  });
});

describe("busy hours", () => {
  it("are the hours a span touches, not the one it ends at", () => {
    expect([...busyHours([{ start: 120, end: 150 }])]).toEqual([2]);
    expect([...busyHours([{ start: 90, end: 180 }])]).toEqual([1, 2]);
    expect([...busyHours([{ start: 0, end: 24 * 60 }])]).toHaveLength(24);
  });
});

describe("hour rows", () => {
  it("are half height in the Sleeping Hours unless something is on", () => {
    const heights = hourHeights(DEFAULT_SLEEP_HOURS, new Set([2]), FULL);
    expect(heights[0]).toBe(22);
    expect(heights[2]).toBe(44);
    expect(heights[7]).toBe(44);
    expect(heights[23]).toBe(22);
    expect(hourTops(heights)[24]).toBe(7 * 22 + 17 * 44);
  });

  it("map minutes to heights and back", () => {
    const heights = hourHeights(DEFAULT_SLEEP_HOURS, new Set(), FULL);
    expect(yOfMinutes(heights, 0)).toBe(0);
    expect(yOfMinutes(heights, 30)).toBe(11);
    expect(yOfMinutes(heights, 7 * 60)).toBe(7 * 22);
    expect(yOfMinutes(heights, 7 * 60 + 30)).toBe(7 * 22 + 22);
    expect(yOfMinutes(heights, 24 * 60)).toBe(hourTops(heights)[24]);
    for (const minutes of [0, 15, 59, 60, 420, 455, 1380, 1439]) {
      expect(minutesAtY(heights, yOfMinutes(heights, minutes))).toBeCloseTo(minutes);
    }
    expect(minutesAtY(heights, -5)).toBe(0);
    expect(minutesAtY(heights, 99_999)).toBe(24 * 60);
  });
});

describe("the opening hour", () => {
  it("is the wake-up hour", () => {
    expect(openingHour(DEFAULT_SLEEP_HOURS, new Set([9, 23]))).toBe(7);
    expect(openingHour({ start: 0, end: 0 }, new Set())).toBe(0);
  });

  it("is the row above the earliest Sleeping Hour with something on", () => {
    expect(openingHour(DEFAULT_SLEEP_HOURS, new Set([5, 2, 9]))).toBe(1);
    expect(openingHour(DEFAULT_SLEEP_HOURS, new Set([0]))).toBe(0);
    expect(openingHour({ start: 1, end: 8 }, new Set([6]))).toBe(5);
  });
});
