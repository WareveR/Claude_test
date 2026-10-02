/**
 * A calendar date with no time and no time zone, written "YYYY-MM-DD".
 * Wall-clock values like this are how the app stores dates (ADR-0002).
 */
export type PlainDate = string;

const PLAIN_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isPlainDate(value: string): value is PlainDate {
  const match = PLAIN_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addDays(date: PlainDate, days: number): PlainDate {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
