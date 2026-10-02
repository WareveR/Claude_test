import { addDays, minutesNowIn, type PlainDate } from "./plain-date";

/** Display Mode returns to today after the board has been left untouched this long. */
export const AUTO_RETURN_MS = 3 * 60 * 1000;

/** The seven days of the board's grid: today, moved a whole number of weeks. */
export function boardDays(today: PlainDate, weeksAway: number): PlainDate[] {
  const first = addDays(today, weeksAway * 7);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

/** Milliseconds until the next midnight on the wall clocks of the Family Time Zone. */
export function msUntilMidnight(timeZone: string, now: Date = new Date()): number {
  const sinceMidnight =
    minutesNowIn(timeZone, now) * 60_000 + now.getUTCSeconds() * 1000 + now.getUTCMilliseconds();
  return 24 * 60 * 60_000 - sinceMidnight;
}

/** Overnight, between 02:00 and 05:00 in the Family Time Zone, a waiting update may be applied. */
export function inOvernightWindow(timeZone: string, now: Date = new Date()): boolean {
  const minutes = minutesNowIn(timeZone, now);
  return minutes >= 2 * 60 && minutes < 5 * 60;
}

/** The addresses a Display Mode device may open: the board and an Entry's read-only details. */
export function displayAllows(pathname: string): boolean {
  return pathname === "/display" || /^\/entries\/(?!new$)[^/]+$/.test(pathname);
}
