import type { ClockTime } from "./entry-time";
import { daysBetween, type PlainDate } from "./plain-date";
import type { FamilyNow } from "./task";

/** When something starts, counted from now, for a sentence like "dentro de 3 dias, às 17:00". */
export type RelativeWhen =
  { kind: "now" } | { kind: "relative"; text: string; time: ClockTime | null };

const minutesOf = (time: ClockTime) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/**
 * "hoje", "amanhã", "dentro de 3 dias", "dentro de 2 horas", "há 3 semanas", or that it is
 * happening now; the clock time goes alongside when the day is counted, not the hours.
 */
export function relativeWhen(
  start: { date: PlainDate; time: ClockTime | null },
  end: { date: PlainDate; time: ClockTime | null },
  now: FamilyNow,
  locale: string,
): RelativeWhen {
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const startsIn =
    daysBetween(now.today, start.date) * 1440 +
    (start.time ? minutesOf(start.time) : 0) -
    now.minutes;
  const endsIn =
    daysBetween(now.today, end.date) * 1440 + (end.time ? minutesOf(end.time) : 1440) - now.minutes;
  if (startsIn <= 0 && endsIn > 0) return { kind: "now" };
  if (start.time && startsIn > 0 && startsIn < 6 * 60) {
    const text =
      startsIn < 60
        ? format.format(startsIn, "minute")
        : format.format(Math.round(startsIn / 60), "hour");
    return { kind: "relative", text, time: null };
  }
  const days = daysBetween(now.today, start.date);
  const size = Math.abs(days);
  const text =
    size < 14
      ? format.format(days, "day")
      : size < 60
        ? format.format(Math.round(days / 7), "week")
        : format.format(Math.round(days / 30.44), "month");
  return { kind: "relative", text, time: size < 14 ? start.time : null };
}
