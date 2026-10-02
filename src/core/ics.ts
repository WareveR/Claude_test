import { tzOffset, tzScan } from "@date-fns/tz";
import type { EntryTime } from "./entry-time";
import type { OccurrenceException } from "./occurrences";
import { addDays, type PlainDate } from "./plain-date";
import { occurrenceDates, type Repetition } from "./repetition";

/** What the Calendar Feed needs of an Entry; exceptions carry any overridden fields. */
export type FeedEntry = {
  id: string;
  title: string;
  time: EntryTime;
  location: string;
  notes: string;
  private: boolean;
  repetition: Repetition | null;
  exceptions: OccurrenceException<Partial<FeedFields>>[];
  changedAt: string;
};

type FeedFields = { title: string; location: string; notes: string; private: boolean };

export type FeedOptions = {
  name: string;
  timeZone: string;
  /** Shown instead of a Private Entry's title. */
  busy: string;
  now: Date;
};

const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

/** Escapes a TEXT value (RFC 5545 §3.3.11). */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Folds a content line at 75 octets, never splitting a UTF-8 character (§3.1). */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (size + bytes > limit) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += bytes;
  }
  out.push(current);
  return out.join("\r\n ");
}

const compactDate = (date: PlainDate) => date.replace(/-/g, "");
const compactTime = (time: string) => `${time.replace(":", "")}00`;

function utcStamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** The UTC instant of a wall-clock date and time in a time zone. */
export function wallClockToUtc(date: PlainDate, time: string, timeZone: string): Date {
  const naive = Date.parse(`${date}T${time}:00Z`);
  const guess = naive - tzOffset(timeZone, new Date(naive)) * 60_000;
  return new Date(naive - tzOffset(timeZone, new Date(guess)) * 60_000);
}

function start(time: EntryTime, date: PlainDate, timeZone: string) {
  return time.allDay
    ? `;VALUE=DATE:${compactDate(date)}`
    : `;TZID=${timeZone}:${compactDate(date)}T${compactTime(time.startTime)}`;
}

function timeLines(time: EntryTime, timeZone: string): string[] {
  if (time.allDay) {
    return [
      `DTSTART;VALUE=DATE:${compactDate(time.startDate)}`,
      // DTEND is exclusive for dates.
      `DTEND;VALUE=DATE:${compactDate(addDays(time.endDate, 1))}`,
    ];
  }
  const lines = [`DTSTART${start(time, time.startDate, timeZone)}`];
  if (time.endDate && time.endTime) {
    lines.push(`DTEND;TZID=${timeZone}:${compactDate(time.endDate)}T${compactTime(time.endTime)}`);
  }
  return lines;
}

/**
 * RRULE text for a Repetition. A monthly or yearly day missing from a month falls on the
 * month's last day, as in the app; BYSETPOS=-1 over the candidate days says the same.
 */
export function rrule(repetition: Repetition, time: EntryTime, timeZone: string): string {
  const parts = [`FREQ=${repetition.frequency.toUpperCase()}`];
  if (repetition.interval > 1) parts.push(`INTERVAL=${repetition.interval}`);
  const day = Number(time.startDate.slice(8, 10));
  const month = Number(time.startDate.slice(5, 7));
  if (repetition.frequency === "weekly") {
    const days = [...new Set(repetition.weekdays ?? [])].sort();
    if (days.length > 0) parts.push(`BYDAY=${days.map((d) => WEEKDAYS[d]).join(",")}`);
    parts.push("WKST=MO");
  } else if (repetition.frequency === "monthly" && day > 28) {
    const candidates = Array.from({ length: day - 27 }, (_, i) => 28 + i);
    parts.push(`BYMONTHDAY=${candidates.join(",")}`, "BYSETPOS=-1");
  } else if (repetition.frequency === "yearly" && month === 2 && day === 29) {
    parts.push("BYMONTH=2", "BYMONTHDAY=28,29", "BYSETPOS=-1");
  }
  const end = repetition.end;
  if (end.type === "count") parts.push(`COUNT=${end.count}`);
  if (end.type === "until") {
    // With a time zone, UNTIL must be in UTC; the whole last day still counts.
    parts.push(
      time.allDay
        ? `UNTIL=${compactDate(end.date)}`
        : `UNTIL=${utcStamp(wallClockToUtc(end.date, "23:59", timeZone))}`,
    );
  }
  return `RRULE:${parts.join(";")}`;
}

/** Observances for the Family Time Zone, from a year before `now` to ten years after. */
export function vtimezone(timeZone: string, now: Date): string[] {
  const year = now.getUTCFullYear();
  const from = new Date(Date.UTC(year - 1, 0, 1));
  const changes = tzScan(timeZone, { start: from, end: new Date(Date.UTC(year + 11, 0, 1)) });
  const offset = (minutes: number) => {
    const sign = minutes < 0 ? "-" : "+";
    const abs = Math.abs(minutes);
    return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}${String(abs % 60).padStart(2, "0")}`;
  };
  const initial = tzOffset(timeZone, from);
  const lines = [
    "BEGIN:VTIMEZONE",
    `TZID:${timeZone}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    `TZOFFSETFROM:${offset(initial)}`,
    `TZOFFSETTO:${offset(initial)}`,
    "END:STANDARD",
  ];
  for (const change of changes) {
    const before = change.offset - change.change;
    // DTSTART is the wall-clock time the change happens at, read in the offset before it.
    const local = new Date(change.date.getTime() + before * 60_000);
    const kind = change.change > 0 ? "DAYLIGHT" : "STANDARD";
    lines.push(
      `BEGIN:${kind}`,
      `DTSTART:${utcStamp(local).replace("Z", "")}`,
      `TZOFFSETFROM:${offset(before)}`,
      `TZOFFSETTO:${offset(change.offset)}`,
      `END:${kind}`,
    );
  }
  lines.push("END:VTIMEZONE");
  return lines;
}

function eventLines(
  entry: FeedEntry,
  fields: FeedFields,
  time: EntryTime,
  options: FeedOptions,
  extra: string[],
): string[] {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${entry.id}`,
    `DTSTAMP:${utcStamp(new Date(entry.changedAt))}`,
    ...timeLines(time, options.timeZone),
    ...extra,
  ];
  if (fields.private) {
    lines.push(`SUMMARY:${escapeText(options.busy)}`, "CLASS:PRIVATE");
  } else {
    lines.push(`SUMMARY:${escapeText(fields.title)}`);
    if (fields.location) lines.push(`LOCATION:${escapeText(fields.location)}`);
    if (fields.notes) lines.push(`DESCRIPTION:${escapeText(fields.notes)}`);
  }
  lines.push("END:VEVENT");
  return lines;
}

/** The first date a series really falls on, so DTSTART is always an Occurrence. */
function firstOccurrence(entry: FeedEntry): PlainDate | null {
  const startDate = entry.time.startDate;
  const [first] = occurrenceDates(startDate, entry.repetition!, startDate, addDays(startDate, 400));
  return first ?? null;
}

function moved(time: EntryTime, date: PlainDate): EntryTime {
  const days = Math.round((Date.parse(date) - Date.parse(time.startDate)) / 86_400_000);
  if (time.allDay) return { ...time, startDate: date, endDate: addDays(time.endDate, days) };
  return {
    ...time,
    startDate: date,
    endDate: time.endDate ? addDays(time.endDate, days) : null,
  };
}

/** VEVENTs for one Entry: the series with RRULE and EXDATE, plus one per edited Occurrence. */
export function entryEvents(entry: FeedEntry, options: FeedOptions): string[] {
  const base: FeedFields = {
    title: entry.title,
    location: entry.location,
    notes: entry.notes,
    private: entry.private,
  };
  if (!entry.repetition) return eventLines(entry, base, entry.time, options, []);

  const first = firstOccurrence(entry);
  if (!first) return [];
  const time = moved(entry.time, first);
  const exdates = entry.exceptions
    .filter((e) => e.skipped)
    .map((e) => `EXDATE${start(time, e.date, options.timeZone)}`);
  const lines = eventLines(entry, base, time, options, [
    rrule(entry.repetition, time, options.timeZone),
    ...exdates,
  ]);
  for (const exception of entry.exceptions) {
    if (exception.skipped || !exception.override) continue;
    const { time: overrideTime, ...fields } = exception.override;
    lines.push(
      ...eventLines(
        entry,
        { ...base, ...fields },
        overrideTime ?? moved(entry.time, exception.date),
        options,
        [`RECURRENCE-ID${start(time, exception.date, options.timeZone)}`],
      ),
    );
  }
  return lines;
}

/** A whole .ics calendar, CRLF line endings, lines folded. */
export function calendar(entries: FeedEntry[], options: FeedOptions): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Family Calendar//Calendar Feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(options.name)}`,
    `X-WR-TIMEZONE:${options.timeZone}`,
    ...vtimezone(options.timeZone, options.now),
    ...entries.flatMap((entry) => entryEvents(entry, options)),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
