import { birthdayAge, birthdayTitle } from "./birthday";
import type { EntryTime } from "./entry-time";
import { occurrencesOf, type OccurrenceException } from "./occurrences";
import { addDays, daysBetween, type PlainDate } from "./plain-date";
import type { Repetition } from "./repetition";

/** One thing the Wall counts the days to: "Férias no Algarve · 12 dias". */
export type Countdown = {
  /** "entry" is one marked to count the days; "birthday" and "christmas" come by themselves. */
  kind: "entry" | "birthday" | "christmas";
  /** The Entry's id; none for Christmas. */
  entryId: string | null;
  /** Empty for Christmas, which the device names in its language. */
  title: string;
  date: PlainDate;
  days: number;
};

/** How many the Wall shows. */
export const COUNTDOWNS_SHOWN = 3;
/** How far ahead it looks: a year, so next Christmas and every Birthday are in reach. */
export const COUNTDOWN_REACH_DAYS = 366;

type CountableEntry = {
  id: string;
  title: string;
  time: EntryTime;
  repetition: Repetition | null;
  exceptions?: OccurrenceException<{ title?: string }>[];
  birthYearKnown: boolean;
};

/**
 * The next few things to count the days to, soonest first: the Entries marked for it and the
 * Birthdays (their next Occurrence from today), and Christmas. An Entry already under way
 * counts as today. Ties keep the marked Entries first, then Birthdays, then Christmas.
 */
export function nextCountdowns(
  marked: CountableEntry[],
  birthdays: CountableEntry[],
  today: PlainDate,
  shown = COUNTDOWNS_SHOWN,
): Countdown[] {
  const to = addDays(today, COUNTDOWN_REACH_DAYS);
  const next = (entry: CountableEntry) =>
    occurrencesOf(entry, today, to).find((o) => o.date >= today || o.time.startDate <= today);
  const found: Countdown[] = [];
  for (const entry of marked) {
    const o = next(entry);
    if (!o) continue;
    const date = o.time.startDate < today ? today : o.time.startDate;
    found.push({
      kind: "entry",
      entryId: entry.id,
      title: o.override?.title ?? entry.title,
      date,
      days: daysBetween(today, date),
    });
  }
  for (const entry of birthdays) {
    const o = next(entry);
    if (!o) continue;
    const age = birthdayAge(entry.time.startDate, o.date, entry.birthYearKnown);
    found.push({
      kind: "birthday",
      entryId: entry.id,
      title: birthdayTitle(entry.title, age),
      date: o.time.startDate,
      days: daysBetween(today, o.time.startDate),
    });
  }
  const year = Number(today.slice(0, 4));
  const christmas: PlainDate = today <= `${year}-12-25` ? `${year}-12-25` : `${year + 1}-12-25`;
  found.push({
    kind: "christmas",
    entryId: null,
    title: "",
    date: christmas,
    days: daysBetween(today, christmas),
  });
  const order = { entry: 0, birthday: 1, christmas: 2 };
  return found.sort((a, b) => a.days - b.days || order[a.kind] - order[b.kind]).slice(0, shown);
}
