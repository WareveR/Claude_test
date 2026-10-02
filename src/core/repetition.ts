import type { PlainDate } from "./plain-date";

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
  if (end.type === "until") return typeof end.date === "string";
  if (end.type === "count") return Number.isInteger(end.count) && (end.count as number) >= 1;
  return false;
}
