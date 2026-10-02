import { lastDate, moveStart, overlaps, type EntryTime } from "./entry-time";
import { addDays, type PlainDate } from "./plain-date";
import { occurrenceDates, type Repetition } from "./repetition";

export type Occurrence = {
  /** The date this Occurrence was due to start on; it names the Occurrence. */
  date: PlainDate;
  time: EntryTime;
};

function lengthInDays(time: EntryTime): number {
  return Math.round((Date.parse(lastDate(time)) - Date.parse(time.startDate)) / 86_400_000);
}

/**
 * The Occurrences of an Entry touching a date window. A one-off Entry has one Occurrence;
 * a repeating one has one per Repetition date, each keeping the Entry's time shape.
 */
export function occurrencesOf(
  entry: { time: EntryTime; repetition: Repetition | null },
  from: PlainDate,
  to: PlainDate,
): Occurrence[] {
  if (!entry.repetition) {
    return overlaps(entry.time, from, to) ? [{ date: entry.time.startDate, time: entry.time }] : [];
  }
  // An Occurrence starting a few days before the window can still reach into it.
  const reach = lengthInDays(entry.time);
  return occurrenceDates(entry.time.startDate, entry.repetition, addDays(from, -reach), to)
    .map((date) => ({ date, time: moveStart(entry.time, date) }))
    .filter((o) => overlaps(o.time, from, to));
}
