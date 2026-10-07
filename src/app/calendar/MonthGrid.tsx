import { Link } from "react-router";
import { lastDate } from "../../core/entry-time";
import { monthWeeks } from "../../core/layout";
import { formatPlainDate, weekday, type PlainDate } from "../../core/plain-date";
import type { EntryType } from "../entry-types/model";
import type { Shown as Entry } from "../entries/model";
import type { ShownDay } from "../weather/model";
import { WeatherBadge } from "../weather/WeatherBadge";
import { importanceClass } from "./EntryBlock";

/** How many Entry lines a day shows before "+N", on narrow and on wide screens. */
const NARROW = 3;
const WIDE = 6;

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
  holidays = new Map(),
  weather = new Map(),
}: {
  month: PlainDate;
  entries: Entry[];
  types: EntryType[];
  today: PlainDate;
  selected: PlainDate | null;
  locale: string;
  dayLink: (day: PlainDate) => string;
  /** Public Holiday names by date. */
  holidays?: Map<string, string[]>;
  /** The forecast by date; shown small in each day, never tappable inside a link. */
  weather?: Map<string, ShownDay>;
}) {
  const weeks = monthWeeks(month);
  const colorOf = (e: Entry) => types.find((t) => t.id === e.entryTypeId)?.color ?? "#607d8b";
  return (
    <div className="flex flex-col bg-surface lg:min-h-0 lg:flex-1">
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
      <div className="grid grid-cols-7 lg:flex-1 lg:auto-rows-fr">
        {weeks.flat().map((day) => {
          const inMonth = day.slice(0, 7) === month.slice(0, 7);
          const dayEntries = entriesOn(entries, day);
          const names = holidays.get(day);
          const forecast = weather.get(day);
          return (
            <Link
              key={day}
              to={dayLink(day)}
              data-testid={`month-day-${day}`}
              aria-current={day === selected ? "date" : undefined}
              className={`flex min-h-16 flex-col gap-0.5 border-b border-l border-line p-0.5 text-left ${names ? "bg-holiday" : weekday(day) >= 5 ? "bg-weekend" : ""} ${inMonth ? "" : "opacity-40"} ${day === selected ? "outline-2 -outline-offset-2 outline-accent" : ""}`}
            >
              <span
                className={`self-start px-1 text-xs tabular-nums lg:text-sm ${day === today ? "rounded-full bg-accent text-accent-ink" : names ? "text-holiday-ink" : weekday(day) >= 5 ? "text-weekend-ink" : ""}`}
              >
                {Number(day.slice(8))}
              </span>
              {names && (
                <span
                  data-testid={`holiday-${day}`}
                  className="truncate text-[10px] leading-tight text-holiday-ink"
                >
                  {names.join(" · ")}
                </span>
              )}
              {forecast && (
                <WeatherBadge
                  day={forecast}
                  faded={forecast.faded}
                  size={12}
                  className="text-[10px] leading-tight"
                />
              )}
              {/* Wide screens have room for more lines per day. */}
              {dayEntries.slice(0, WIDE).map((e, i) => (
                <span
                  key={e.key}
                  style={{ backgroundColor: colorOf(e) }}
                  className={`truncate rounded px-0.5 text-[10px] leading-tight text-white lg:px-1 lg:py-0.5 lg:text-xs ${i >= NARROW ? "hidden lg:block" : ""} ${importanceClass(e)}`}
                >
                  {e.title}
                </span>
              ))}
              {dayEntries.length > NARROW && (
                <span
                  className={`text-[10px] text-muted ${dayEntries.length > WIDE ? "" : "lg:hidden"}`}
                >
                  <span className="lg:hidden">+{dayEntries.length - NARROW}</span>
                  <span className="hidden lg:inline">+{dayEntries.length - WIDE}</span>
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
