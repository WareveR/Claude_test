import { rrulestr } from "rrule";
import { describe, expect, it } from "vitest";
import type { EntryTime } from "./entry-time";
import {
  calendar,
  entryEvents,
  escapeText,
  foldLine,
  rrule,
  vtimezone,
  wallClockToUtc,
  type FeedEntry,
  type FeedOptions,
} from "./ics";
import { occurrenceDates, type Repetition } from "./repetition";

const OPTIONS: FeedOptions = {
  name: "Família",
  timeZone: "Europe/Lisbon",
  busy: "Ocupado",
  now: new Date("2026-10-02T12:00:00Z"),
};

const timed = (startDate: string, startTime = "09:00"): Extract<EntryTime, { allDay: false }> => ({
  allDay: false,
  startDate,
  startTime,
  endDate: startDate,
  endTime: "10:00",
});

const entry = (patch: Partial<FeedEntry> = {}): FeedEntry => ({
  id: "e1",
  title: "Natação",
  time: timed("2026-10-05"),
  location: "Piscina",
  notes: "Levar touca",
  private: false,
  repetition: null,
  exceptions: [],
  changedAt: "2026-10-01T08:00:00.000Z",
  ...patch,
});

describe("text", () => {
  it("escapes commas, semicolons, backslashes and newlines", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });

  it("folds lines at 75 octets without splitting characters", () => {
    const folded = foldLine(`SUMMARY:${"ã".repeat(60)}`);
    const lines = folded.split("\r\n");
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(lines.map((l, i) => (i ? l.slice(1) : l)).join("")).toBe(`SUMMARY:${"ã".repeat(60)}`);
  });
});

describe("RRULE", () => {
  // Calendar apps must expand our RRULE to exactly the dates the app shows.
  const cases: [string, string, Repetition][] = [
    [
      "daily every 3 days, 10 times",
      "2026-01-30",
      { frequency: "daily", interval: 3, end: { type: "count", count: 10 } },
    ],
    [
      "every other week on Mon, Wed, Fri until a date",
      "2026-01-05",
      {
        frequency: "weekly",
        interval: 2,
        weekdays: [0, 2, 4],
        end: { type: "until", date: "2026-06-30" },
      },
    ],
    [
      "weekly, start not on a picked day",
      "2026-01-07",
      { frequency: "weekly", interval: 1, weekdays: [0, 5], end: { type: "count", count: 9 } },
    ],
    [
      "monthly on the 31st",
      "2026-01-31",
      { frequency: "monthly", interval: 1, end: { type: "count", count: 24 } },
    ],
    [
      "every 2 months on the 30th",
      "2026-01-30",
      { frequency: "monthly", interval: 2, end: { type: "never" } },
    ],
    [
      "monthly on the 15th",
      "2026-01-15",
      { frequency: "monthly", interval: 1, end: { type: "until", date: "2027-03-15" } },
    ],
    [
      "yearly on 29 February",
      "2028-02-29",
      { frequency: "yearly", interval: 1, end: { type: "count", count: 6 } },
    ],
    ["yearly", "2026-07-14", { frequency: "yearly", interval: 1, end: { type: "never" } }],
  ];

  for (const [name, startDate, repetition] of cases) {
    it(`matches the app for ${name}`, () => {
      const expected = occurrenceDates(startDate, repetition, startDate, "2033-12-31");
      const time: EntryTime = { ...timed(expected[0], "00:00"), endDate: null, endTime: null };
      const rule = rrule(repetition, time, "UTC");
      const dtstart = `DTSTART:${expected[0].replace(/-/g, "")}T000000Z`;
      const got = rrulestr(`${dtstart}\n${rule}`)
        .between(new Date("2026-01-01T00:00:00Z"), new Date("2033-12-31T23:59:59Z"), true)
        .map((d) => d.toISOString().slice(0, 10));
      expect(got).toEqual(expected);
    });
  }

  it("writes UNTIL in UTC for Timed Entries and as a date for All-day ones", () => {
    const until: Repetition = {
      frequency: "daily",
      interval: 1,
      end: { type: "until", date: "2026-07-10" },
    };
    expect(rrule(until, timed("2026-07-01"), "Europe/Lisbon")).toBe(
      "RRULE:FREQ=DAILY;UNTIL=20260710T225900Z",
    );
    const allDay: EntryTime = { allDay: true, startDate: "2026-07-01", endDate: "2026-07-01" };
    expect(rrule(until, allDay, "Europe/Lisbon")).toBe("RRULE:FREQ=DAILY;UNTIL=20260710");
  });
});

describe("time zones", () => {
  it("converts wall-clock times across daylight saving", () => {
    expect(wallClockToUtc("2026-01-15", "09:00", "Europe/Lisbon").toISOString()).toBe(
      "2026-01-15T09:00:00.000Z",
    );
    expect(wallClockToUtc("2026-07-15", "09:00", "Europe/Lisbon").toISOString()).toBe(
      "2026-07-15T08:00:00.000Z",
    );
  });

  it("describes the Family Time Zone's changes", () => {
    const lines = vtimezone("Europe/Lisbon", OPTIONS.now).join("\n");
    expect(lines).toContain("TZID:Europe/Lisbon");
    expect(lines).toContain(
      "BEGIN:DAYLIGHT\nDTSTART:20260329T010000\nTZOFFSETFROM:+0000\nTZOFFSETTO:+0100\nEND:DAYLIGHT",
    );
    expect(lines).toContain(
      "BEGIN:STANDARD\nDTSTART:20261025T020000\nTZOFFSETFROM:+0100\nTZOFFSETTO:+0000\nEND:STANDARD",
    );
  });
});

describe("events", () => {
  it("writes a one-off Timed Entry with its id as UID", () => {
    const lines = entryEvents(entry(), OPTIONS);
    expect(lines).toEqual([
      "BEGIN:VEVENT",
      "UID:e1",
      "DTSTAMP:20261001T080000Z",
      "DTSTART;TZID=Europe/Lisbon:20261005T090000",
      "DTEND;TZID=Europe/Lisbon:20261005T100000",
      "SUMMARY:Natação",
      "LOCATION:Piscina",
      "DESCRIPTION:Levar touca",
      "END:VEVENT",
    ]);
  });

  it("writes All-day Entries with an exclusive end date", () => {
    const lines = entryEvents(
      entry({ time: { allDay: true, startDate: "2026-08-01", endDate: "2026-08-15" } }),
      OPTIONS,
    );
    expect(lines).toContain("DTSTART;VALUE=DATE:20260801");
    expect(lines).toContain("DTEND;VALUE=DATE:20260816");
  });

  it("shows a Private Entry only as busy", () => {
    const lines = entryEvents(entry({ private: true }), OPTIONS);
    expect(lines).toContain("SUMMARY:Ocupado");
    expect(lines).toContain("CLASS:PRIVATE");
    expect(lines.join("\n")).not.toMatch(/Natação|Piscina|touca/);
  });

  it("shows a Private Entry in full in the Family's own Export", () => {
    const lines = entryEvents(entry({ private: true }), { ...OPTIONS, revealPrivate: true });
    expect(lines).toContain("SUMMARY:Natação");
    expect(lines).toContain("LOCATION:Piscina");
    expect(lines).toContain("CLASS:PRIVATE");
  });

  it("writes skipped Occurrences as EXDATE and edited ones as RECURRENCE-ID", () => {
    const lines = entryEvents(
      entry({
        repetition: { frequency: "weekly", interval: 1, end: { type: "never" } },
        exceptions: [
          { date: "2026-10-12", skipped: true, override: null },
          {
            date: "2026-10-19",
            skipped: false,
            override: {
              title: "Natação (piscina fechada)",
              time: { ...timed("2026-10-20", "18:00"), endTime: "19:00" },
              private: true,
            },
          },
        ],
      }),
      OPTIONS,
    );
    expect(lines).toContain("RRULE:FREQ=WEEKLY;WKST=MO");
    expect(lines).toContain("EXDATE;TZID=Europe/Lisbon:20261012T090000");
    const edited = lines.slice(lines.indexOf("END:VEVENT") + 1);
    expect(edited).toEqual([
      "BEGIN:VEVENT",
      "UID:e1",
      "DTSTAMP:20261001T080000Z",
      "DTSTART;TZID=Europe/Lisbon:20261020T180000",
      "DTEND;TZID=Europe/Lisbon:20261020T190000",
      "RECURRENCE-ID;TZID=Europe/Lisbon:20261019T090000",
      "SUMMARY:Ocupado",
      "CLASS:PRIVATE",
      "END:VEVENT",
    ]);
  });

  it("wraps everything in a VCALENDAR with CRLF line endings", () => {
    const ics = calendar([entry()], OPTIONS);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("X-WR-CALNAME:Família\r\n");
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });
});
