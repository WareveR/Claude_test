import { addDays, daysInMonth, isPlainDate, weekday, type PlainDate } from "./plain-date";

/** How an Entry (or Task, or Checklist) repeats: plain fields, never RRULE text (#37). */
export type Repetition = {
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  /** Every N days, weeks, months or years. */
  interval: number;
  /** Weekly only: the weekdays it falls on, Monday = 0 … Sunday = 6. */
  weekdays?: number[];
  end: { type: "never" } | { type: "until"; date: PlainDate } | { type: "count"; count: number };
};

const FREQUENCIES = ["daily", "weekly", "monthly", "yearly"];

export function isRepetition(value: unknown): value is Repetition {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  if (!FREQUENCIES.includes(r.frequency as string)) return false;
  if (!Number.isInteger(r.interval) || (r.interval as number) < 1) return false;
  if (r.weekdays !== undefined) {
    if (!Array.isArray(r.weekdays) || r.weekdays.length === 0) return false;
    if (!r.weekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) return false;
  }
  const end = r.end as Record<string, unknown> | undefined;
  if (!end) return false;
  if (end.type === "never") return true;
  if (end.type === "until") return typeof end.date === "string" && isPlainDate(end.date);
  if (end.type === "count") return Number.isInteger(end.count) && (end.count as number) >= 1;
  return false;
}

function parts(date: PlainDate) {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

function make(y: number, m: number, d: number): PlainDate {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** The k-th date of a monthly or yearly series; a missing day falls on the month's last day. */
function nthMonthly(start: PlainDate, months: number): PlainDate {
  const { y, m, d } = parts(start);
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return make(year, month, Math.min(d, daysInMonth(year, month)));
}

/**
 * The dates a repeating series starts on, from its first date, up to and including `to`.
 * The end rule (until a date, or a number of times) is applied; nothing before `from` is
 * returned, though the count still includes them.
 */
export function occurrenceDates(
  start: PlainDate,
  repetition: Repetition,
  from: PlainDate,
  to: PlainDate,
): PlainDate[] {
  const { frequency, interval, end } = repetition;
  const until = end.type === "until" && end.date < to ? end.date : to;
  const limit = end.type === "count" ? end.count : Infinity;
  const out: PlainDate[] = [];
  let produced = 0;
  const emit = (date: PlainDate) => {
    produced++;
    if (date >= from) out.push(date);
  };

  if (frequency === "daily") {
    for (let date = start; date <= until && produced < limit; date = addDays(date, interval)) {
      emit(date);
    }
  } else if (frequency === "weekly") {
    const days = [...new Set(repetition.weekdays ?? [weekday(start)])].sort();
    const firstMonday = addDays(start, -weekday(start));
    for (
      let monday = firstMonday;
      monday <= until && produced < limit;
      monday = addDays(monday, 7 * interval)
    ) {
      for (const day of days) {
        const date = addDays(monday, day);
        if (date < start || date > until || produced >= limit) continue;
        emit(date);
      }
    }
  } else {
    const step = frequency === "monthly" ? interval : 12 * interval;
    for (let k = 0; produced < limit; k++) {
      const date = nthMonthly(start, k * step);
      if (date > until) break;
      emit(date);
    }
  }
  return out;
}
