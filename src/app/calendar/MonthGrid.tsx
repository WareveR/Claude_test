import { Link } from "react-router";
import { lastDate } from "../../core/entry-time";
import { monthWeeks } from "../../core/layout";
import { formatPlainDate, weekday, type PlainDate } from "../../core/plain-date";
import type { EntryType } from "../entry-types/model";
import type { Entry } from "../entries/model";
import { importanceClass } from "./EntryBlock";

export function entriesOn(entries: Entry[], day: PlainDate): Entry[] {
  return entries
    .filter((e) => e.time.startDate <= day && lastDate(e.time) >= day)
    .sort((a, b) => {
      if (a.time.allDay !== b.time.allDay) return a.time.allDay ? -1 : 1;
      const at = a.time.allDay ? "" : a.time.startTime;
      const bt = b.time.allDay ? "" : b.time.startTime;
      return at.localeCompare(bt);
    });
}

/** A month grid: each day shows its first Entries as coloured lines; tapping picks the day. */
export function MonthGrid({
  month,
  entries,
  types,
  today,
  selected,
  locale,
  dayLink,
}: {
  month: PlainDate;
  entries: Entry[];
  types: EntryType[];
  today: PlainDate;
  selected: PlainDate | null;
  locale: string;
  dayLink: (day: PlainDate) => string;
}) {
  const weeks = monthWeeks(month);
  const colorOf = (e: Entry) => types.find((t) => t.id === e.entryTypeId)?.color ?? "#607d8b";
  return (
    <div className="bg-surface">
      <div className="grid grid-cols-7 border-b border-line text-center text-xs font-semibold">
        {weeks[0].map((day) => (
          <div
            key={day}
            className={`py-1 first-letter:uppercase ${weekday(day) >= 5 ? "bg-weekend text-weekend-ink" : ""}`}
          >
            {formatPlainDate(day, locale, { weekday: "short" })}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((day) => {
          const inMonth = day.slice(0, 7) === month.slice(0, 7);
          const dayEntries = entriesOn(entries, day);
          return (
            <Link
              key={day}
              to={dayLink(day)}
              data-testid={`month-day-${day}`}
              aria-current={day === selected ? "date" : undefined}
              className={`flex min-h-16 flex-col gap-0.5 border-b border-l border-line p-0.5 text-left ${weekday(day) >= 5 ? "bg-weekend" : ""} ${inMonth ? "" : "opacity-40"} ${day === selected ? "outline-2 -outline-offset-2 outline-accent" : ""}`}
            >
              <span
                className={`self-start px-1 text-xs tabular-nums ${day === today ? "rounded-full bg-accent text-accent-ink" : weekday(day) >= 5 ? "text-weekend-ink" : ""}`}
              >
                {Number(day.slice(8))}
              </span>
              {dayEntries.slice(0, 3).map((e) => (
                <span
                  key={e.id}
                  style={{ backgroundColor: colorOf(e) }}
                  className={`truncate rounded px-0.5 text-[10px] leading-tight text-white ${importanceClass(e)}`}
                >
                  {e.title}
                </span>
              ))}
              {dayEntries.length > 3 && (
                <span className="text-[10px] text-muted">+{dayEntries.length - 3}</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
