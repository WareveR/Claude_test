import { describe, expect, it } from "vitest";
import { clockChangeWithin } from "./clock-change";
import { addDays } from "./plain-date";

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

  it("matches a quarter-hour scan from every day of 2026", () => {
    // The plain way: look at the offset every 15 minutes for the whole window. Offsets are
    // remembered, as the windows of neighbouring days overlap.
    const offsets = new Map<string, number>();
    const scan = (timeZone: string, today: string, days: number) => {
      const format = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" });
      const offset = (ms: number) => {
        const key = `${timeZone} ${ms}`;
        if (offsets.has(key)) return offsets.get(key)!;
        const name = format.formatToParts(ms).find((p) => p.type === "timeZoneName")!.value;
        const match = /([+-])(\d{2}):?(\d{2})?/.exec(name);
        const minutes = match
          ? (match[1] === "-" ? -1 : 1) * (+match[2] * 60 + +(match[3] ?? 0))
          : 0;
        offsets.set(key, minutes);
        return minutes;
      };
      const clock = (ms: number, minutes: number) => new Date(ms + minutes * 60_000).toISOString();
      const start =
        Date.parse(`${today}T00:00:00Z`) - offset(Date.parse(`${today}T12:00:00Z`)) * 60_000;
      for (let ms = start + 900_000; ms <= start + days * 86_400_000; ms += 900_000) {
        const [before, after] = [offset(ms - 900_000), offset(ms)];
        if (before !== after) {
          return {
            date: clock(ms, after).slice(0, 10),
            from: clock(ms, before).slice(11, 16),
            to: clock(ms, after).slice(11, 16),
          };
        }
      }
      return null;
    };
    for (const timeZone of ["Europe/Lisbon", "America/New_York", "Australia/Lord_Howe"]) {
      for (let day = 0; day < 365; day++) {
        const today = addDays("2026-01-01", day);
        expect(clockChangeWithin(timeZone, today, 7), `${timeZone} ${today}`).toEqual(
          scan(timeZone, today, 7),
        );
      }
    }
  }, 20_000);
});
