import type { PlainDate } from "./plain-date";

/**
 * The age a Birthday Occurrence celebrates, when the birth year is known: the Occurrence's year
 * minus the start date's year. Null when the year is unknown or the Occurrence is the birth itself.
 */
export function birthdayAge(
  startDate: PlainDate,
  occurrenceDate: PlainDate,
  birthYearKnown: boolean,
): number | null {
  if (!birthYearKnown) return null;
  const age = Number(occurrenceDate.slice(0, 4)) - Number(startDate.slice(0, 4));
  return age > 0 ? age : null;
}

/** A Birthday's title as the views show it: "Grandma Rosa, 80", or just the name. */
export function birthdayTitle(title: string, age: number | null) {
  return age === null ? title : `${title}, ${age}`;
}
