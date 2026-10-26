import type { PlainDate } from "./plain-date";

/** A change of the clocks, as the wall clock reads it: at 02:00 they go back to 01:00. */
export type ClockChange = { date: PlainDate; from: string; to: string };

const STEP = 15 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

/** The time zone's offset from UTC at `ms`, in minutes. */
function offsetAt(format: Intl.DateTimeFormat, ms: number): number {
  const name = format.formatToParts(ms).find((p) => p.type === "timeZoneName")?.value ?? "";
  const match = /([+-])(\d{2}):?(\d{2})?/.exec(name);
  if (!match) return 0;
  return (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

function wallClock(ms: number, offset: number) {
  const iso = new Date(ms + offset * 60 * 1000).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/**
 * The first change of the clocks from the start of `today` for `days` days in the time zone, or
 * null; the Briefing says it, as nobody wants to be an hour early on Sunday.
 */
export function clockChangeWithin(
  timeZone: string,
  today: PlainDate,
  days: number,
): ClockChange | null {
  const format = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" });
  const start =
    Date.parse(`${today}T00:00:00Z`) -
    offsetAt(format, Date.parse(`${today}T12:00:00Z`)) * 60 * 1000;
  let before = offsetAt(format, start);
  for (let ms = start + STEP; ms <= start + days * DAY; ms += STEP) {
    const after = offsetAt(format, ms);
    if (after !== before) {
      const old = wallClock(ms, before);
      const now = wallClock(ms, after);
      return { date: now.date, from: old.time, to: now.time };
    }
    before = after;
  }
  return null;
}
