import { monthWeeks } from "./layout";
import { addDays, addMonths, daysBetween, weekday, type PlainDate } from "./plain-date";

/** The calendar views that step a period at a time with their arrows and swipes. */
export type Period = "day" | "week" | "month" | "year" | "agenda";

/** The dates a view asks for, both ends included. */
export type DateWindow = { from: PlainDate; to: PlainDate };

/** How many days the agenda lists at a time. */
export const AGENDA_DAYS = 30;

/**
 * The window a view shows from its first date: the day; the week from its Monday; the month's
 * whole weeks, as its grid draws them; the year from 1 January; the agenda's days from its first.
 */
export function periodWindow(period: Period, first: PlainDate): DateWindow {
  switch (period) {
    case "day":
      return { from: first, to: first };
    case "week":
      return { from: first, to: addDays(first, 6) };
    case "month": {
      const weeks = monthWeeks(first);
      return { from: weeks[0][0], to: weeks[weeks.length - 1][6] };
    }
    case "year":
      return { from: first, to: `${first.slice(0, 4)}-12-31` };
    case "agenda":
      return { from: first, to: addDays(first, AGENDA_DAYS - 1) };
  }
}

/** The first date of the period before (-1) or after (+1) the one starting at `first`. */
export function stepPeriod(period: Period, first: PlainDate, step: -1 | 1): PlainDate {
  switch (period) {
    case "day":
      return addDays(first, step);
    case "week":
      return addDays(first, 7 * step);
    case "month":
      return addMonths(first, step);
    case "year":
      return addMonths(first, 12 * step);
    case "agenda":
      return addDays(first, AGENDA_DAYS * step);
  }
}

/** The windows of the periods either side of the one starting at `first`: previous, then next. */
export function neighbourWindows(period: Period, first: PlainDate): DateWindow[] {
  return [-1 as const, 1 as const].map((step) =>
    periodWindow(period, stepPeriod(period, first, step)),
  );
}

/**
 * The day another view opens on: the day last in focus while the period shown holds it; else that
 * day moved by whole periods into this one (same weekday, day of the month, or date of the year),
 * so the arrows carry it along; else today when the period holds it, else the period's first day.
 * A month holds only its own days.
 */
export function focusDay(
  period: Period,
  first: PlainDate,
  focus: PlainDate | null,
  today: PlainDate,
): PlainDate {
  const last =
    period === "month" ? addDays(addMonths(first, 1), -1) : periodWindow(period, first).to;
  const shown = (day: PlainDate) => day >= first && day <= last;
  if (focus && shown(focus)) return focus;
  if (focus) return carried(period, first, focus);
  if (shown(today)) return today;
  return first;
}

/** The day in focus moved by whole periods into the one starting at `first`. */
function carried(period: Period, first: PlainDate, focus: PlainDate): PlainDate {
  const months = (date: PlainDate) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
  switch (period) {
    case "day":
      return first;
    case "week":
      return addDays(first, weekday(focus));
    case "month":
      return addMonths(focus, months(first) - months(focus));
    case "year":
      return addMonths(focus, 12 * (Number(first.slice(0, 4)) - Number(focus.slice(0, 4))));
    case "agenda": {
      const offset = daysBetween(first, focus) % AGENDA_DAYS;
      return addDays(first, offset < 0 ? offset + AGENDA_DAYS : offset);
    }
  }
}
