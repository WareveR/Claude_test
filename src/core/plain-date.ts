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

function toUtc(date: PlainDate): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): PlainDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: PlainDate, days: number): PlainDate {
  const utc = toUtc(date);
  utc.setUTCDate(utc.getUTCDate() + days);
  return fromUtc(utc);
}

/** Adds months, keeping the day when it exists and otherwise taking the month's last day. */
/** Whole days from one date to another; negative when `to` comes first. */
export function daysBetween(from: PlainDate, to: PlainDate): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

export function addMonths(date: PlainDate, months: number): PlainDate {
  const [y, m, d] = date.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const year = first.getUTCFullYear();
  const month = first.getUTCMonth() + 1;
  return fromUtc(new Date(Date.UTC(year, month - 1, Math.min(d, daysInMonth(year, month)))));
}

/** Day of the week with Monday = 0 … Sunday = 6. */
export function weekday(date: PlainDate): number {
  return (toUtc(date).getUTCDay() + 6) % 7;
}

/** The Monday on or before the date: both v1 languages start the week on Monday. */
export function startOfWeek(date: PlainDate): PlainDate {
  return addDays(date, -weekday(date));
}

export function startOfMonth(date: PlainDate): PlainDate {
  return `${date.slice(0, 7)}-01`;
}

/** Today's date on the wall clocks of the given time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): PlainDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Formats a PlainDate in a language without letting any time zone shift it. */
export function formatPlainDate(
  date: PlainDate,
  language: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(language, { ...options, timeZone: "UTC" }).format(toUtc(date));
}

/** Minutes since midnight on the wall clocks of the given time zone. */
export function minutesNowIn(timeZone: string, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return get("hour") * 60 + get("minute");
}
