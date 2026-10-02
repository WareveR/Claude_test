import { lastDate, moveStart, overlaps, type EntryTime } from "./entry-time";
import { addDays, type PlainDate } from "./plain-date";
import { occurrenceDates, type Repetition } from "./repetition";

export type Occurrence<O = object> = {
  /** The date this Occurrence was due to start on; it names the Occurrence. */
  date: PlainDate;
  time: EntryTime;
  /** Fields this Occurrence changes on its own, if any. */
  override: (O & { time?: EntryTime }) | null;
};

/** One Occurrence skipped or edited alone, named by its original date. */
export type OccurrenceException<O = object> = {
  date: PlainDate;
  skipped: boolean;
  override: (O & { time?: EntryTime }) | null;
};

function lengthInDays(time: EntryTime): number {
  return Math.round((Date.parse(lastDate(time)) - Date.parse(time.startDate)) / 86_400_000);
}

/**
 * The Occurrences of an Entry touching a date window. A one-off Entry has one Occurrence;
 * a repeating one has one per Repetition date, each keeping the Entry's time shape.
 */
export function occurrencesOf<O = object>(
  entry: {
    time: EntryTime;
    repetition: Repetition | null;
    exceptions?: OccurrenceException<O>[];
  },
  from: PlainDate,
  to: PlainDate,
): Occurrence<O>[] {
  if (!entry.repetition) {
    return overlaps(entry.time, from, to)
      ? [{ date: entry.time.startDate, time: entry.time, override: null }]
      : [];
  }
  const exceptions = new Map((entry.exceptions ?? []).map((e) => [e.date, e]));
  // An Occurrence starting a few days before the window can still reach into it, and an
  // edited one may have moved a few days.
  const reach = lengthInDays(entry.time) + EDIT_REACH_DAYS;
  return occurrenceDates(
    entry.time.startDate,
    entry.repetition,
    addDays(from, -reach),
    addDays(to, EDIT_REACH_DAYS),
  )
    .flatMap((date): Occurrence<O>[] => {
      const exception = exceptions.get(date);
      if (exception?.skipped) return [];
      const override = exception?.override ?? null;
      return [{ date, time: override?.time ?? moveStart(entry.time, date), override }];
    })
    .filter((o) => overlaps(o.time, from, to));
}

/** How far an edited Occurrence may be found from its original date when expanding a window. */
const EDIT_REACH_DAYS = 31;
