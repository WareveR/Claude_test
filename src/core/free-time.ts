import { minutesOf, type EntryTime } from "./entry-time";
import { addDays, daysBetween, type PlainDate } from "./plain-date";
import type { SleepHours } from "./sleep-hours";

/** A stretch of free time on one day, in minutes from midnight. */
export type FreeSlot = { date: PlainDate; start: number; end: number };

/** A timed Occurrence and whose it is; no Persons means the whole Family's. */
export type BusyTime = { time: EntryTime; personIds: string[] };

/** A timed Entry with no end takes this long. */
export const DEFAULT_MINUTES = 60;
/** Free stretches start on the quarter hour. */
const STEP = 15;

/**
 * The free stretches, at least `minutes` long, from `from` to `to` in which none of `personIds`
 * has a timed Entry, nor has the whole Family, outside the Sleeping Hours and after `nowMinutes`
 * on `today`. A Private Entry counts like any other: only its time is used. All-day Entries
 * (a holiday, a Birthday) don't fill the hours.
 */
export function freeSlots({
  busy,
  personIds,
  from,
  to,
  sleep,
  minutes,
  today,
  nowMinutes,
}: {
  busy: BusyTime[];
  personIds: string[];
  from: PlainDate;
  to: PlainDate;
  sleep: SleepHours;
  minutes: number;
  today: PlainDate;
  nowMinutes: number;
}): FreeSlot[] {
  const wanted = new Set(personIds);
  const blocking = busy.filter(
    (b) =>
      !b.time.allDay &&
      (b.personIds.length === 0 || wanted.size === 0 || b.personIds.some((p) => wanted.has(p))),
  );
  const slots: FreeSlot[] = [];
  for (let i = 0; i <= daysBetween(from, to); i++) {
    const date = addDays(from, i);
    if (date < today) continue;
    // The waking hours; Sleeping Hours that don't wrap midnight leave two stretches.
    const awake: [number, number][] =
      sleep.start > sleep.end
        ? [[sleep.end * 60, sleep.start * 60]]
        : sleep.start === sleep.end
          ? [[0, 24 * 60]]
          : [
              [0, sleep.start * 60],
              [sleep.end * 60, 24 * 60],
            ];
    const taken = blocking
      .map((b) => onDay(b.time, date))
      .filter((r): r is [number, number] => r !== null)
      .sort((a, b) => a[0] - b[0]);
    for (const [open, close] of awake) {
      let cursor = date === today ? Math.max(open, roundUp(nowMinutes)) : open;
      for (const [start, end] of [...taken, [close, close] as [number, number]]) {
        if (end <= cursor) continue;
        const stop = Math.min(start, close);
        if (stop - cursor >= minutes) slots.push({ date, start: cursor, end: stop });
        cursor = Math.max(cursor, roundUp(end));
        if (cursor >= close) break;
      }
    }
  }
  return slots;
}

function roundUp(minutes: number) {
  return Math.ceil(minutes / STEP) * STEP;
}

/** The minutes a timed Occurrence takes on `date`, or null when it doesn't touch it. */
function onDay(time: EntryTime, date: PlainDate): [number, number] | null {
  if (time.allDay) return null;
  const start = minutesOf(time.startTime);
  const endDate = time.endDate ?? time.startDate;
  let end = time.endTime ? minutesOf(time.endTime) : start + DEFAULT_MINUTES;
  if (!time.endTime && end > 24 * 60) end = 24 * 60;
  if (date < time.startDate || date > endDate) return null;
  const first = date === time.startDate ? start : 0;
  const last = date === endDate ? end : 24 * 60;
  return last > first ? [first, last] : null;
}

/** "18:30" from minutes after midnight. */
export function clockOf(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
