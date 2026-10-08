import { addDays, type PlainDate } from "./plain-date";

/** A wall-clock time of day, "HH:mm", read in the Family Time Zone (ADR-0002). */
export type ClockTime = string;

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isClockTime(value: unknown): value is ClockTime {
  return typeof value === "string" && CLOCK.test(value);
}

export function minutesOf(time: ClockTime): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function clockTime(minutes: number): ClockTime {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * When an Entry happens. A Timed Entry has a wall-clock start and an optional end, possibly
 * days later; without an end it is a moment at its start. An All-day Entry covers whole days,
 * both ends included.
 */
export type EntryTime =
  | {
      allDay: false;
      startDate: PlainDate;
      startTime: ClockTime;
      endDate: PlainDate | null;
      endTime: ClockTime | null;
    }
  | { allDay: true; startDate: PlainDate; endDate: PlainDate };

function stamp(date: PlainDate, time: ClockTime) {
  return `${date}T${time}`;
}

/** Returns why the time is invalid, or null when it is fine. */
export function entryTimeProblem(time: EntryTime): string | null {
  if (time.allDay) return time.endDate < time.startDate ? "end_before_start" : null;
  if ((time.endDate === null) !== (time.endTime === null)) return "end_incomplete";
  if (time.endDate && time.endTime) {
    if (stamp(time.endDate, time.endTime) <= stamp(time.startDate, time.startTime)) {
      return "end_before_start";
    }
  }
  return null;
}

/** The last date the Entry touches. A Timed Entry ending at 00:00 stops the day before. */
export function lastDate(time: EntryTime): PlainDate {
  if (time.allDay) return time.endDate;
  if (!time.endDate || !time.endTime) return time.startDate;
  if (time.endTime === "00:00" && time.endDate > time.startDate) return addDays(time.endDate, -1);
  return time.endDate;
}

export function overlaps(time: EntryTime, from: PlainDate, to: PlainDate): boolean {
  return time.startDate <= to && lastDate(time) >= from;
}

/** How long a Timed Entry without an end is drawn in the time grid. */
export const MOMENT_MINUTES = 30;

/**
 * The part of a Timed Entry on one day, in minutes from midnight: a multi-day Entry runs to
 * midnight on its first day, fills the days between and stops at its end on the last day.
 */
export function daySpan(
  time: Extract<EntryTime, { allDay: false }>,
  date: PlainDate,
): { start: number; end: number; moment: boolean } | null {
  if (date < time.startDate || date > lastDate(time)) return null;
  const start = date === time.startDate ? minutesOf(time.startTime) : 0;
  if (!time.endDate || !time.endTime) {
    return { start, end: Math.min(start + MOMENT_MINUTES, 24 * 60), moment: true };
  }
  const end = date === time.endDate ? minutesOf(time.endTime) : 24 * 60;
  return { start, end: Math.max(end, start + 15), moment: false };
}

function dayNumber(date: PlainDate): number {
  return Math.round(Date.parse(date) / 86_400_000);
}

/** Moves an Entry's start and keeps its length, as a form does when the start changes. */
export function moveStart(time: EntryTime, startDate: PlainDate, startTime?: ClockTime): EntryTime {
  const days = dayNumber(startDate) - dayNumber(time.startDate);
  if (time.allDay) return { ...time, startDate, endDate: addDays(time.endDate, days) };
  const newStartTime = startTime ?? time.startTime;
  if (!time.endDate || !time.endTime) return { ...time, startDate, startTime: newStartTime };
  const length =
    (dayNumber(time.endDate) - dayNumber(time.startDate)) * 1440 +
    minutesOf(time.endTime) -
    minutesOf(time.startTime);
  const end = minutesOf(newStartTime) + length;
  return {
    allDay: false,
    startDate,
    startTime: newStartTime,
    endDate: addDays(startDate, Math.floor(end / 1440)),
    endTime: clockTime(((end % 1440) + 1440) % 1440),
  };
}

/** The step a dragged Entry's start snaps to, in minutes. */
export const DRAG_STEP_MINUTES = 15;

/**
 * Moves an Entry by whole days and, for a Timed Entry, by some minutes, keeping its length. A
 * move in minutes lands the start on a 15-minute step; a move of whole days keeps the time.
 */
export function shiftTime(time: EntryTime, days: number, minutes = 0): EntryTime {
  const date = addDays(time.startDate, days);
  if (time.allDay || minutes === 0) return moveStart(time, date);
  const moved = minutesOf(time.startTime) + minutes;
  const start = Math.round(moved / DRAG_STEP_MINUTES) * DRAG_STEP_MINUTES;
  const dayShift = Math.floor(start / 1440);
  return moveStart(time, addDays(date, dayShift), clockTime(start - dayShift * 1440));
}
