import { Link } from "react-router";
import { YEAR_COLUMNS, yearRowOffset } from "../../core/layout";
import { addDays, daysInMonth, formatPlainDate, type PlainDate } from "../../core/plain-date";
import type { EntryType } from "../entry-types/model";
import type { Shown as Entry } from "../entries/model";
import { importanceClass } from "./EntryBlock";
import { entriesOn } from "./MonthGrid";

const SATURDAY = "2026-08-01";
/** Entry lines a day shows before "+n". */
const LINES = 3;

/** The weekday letters over the 37 columns, Saturday first. */
export function yearWeekdayLetters(locale: string): string[] {
  return Array.from({ length: YEAR_COLUMNS }, (_, c) =>
    formatPlainDate(addDays(SATURDAY, c % 7), locale, { weekday: "narrow" }),
  );
}

export const isWeekendColumn = (column: number) => column % 7 < 2;

/** The day of the month in each of a month's 37 columns, or null where the month has none. */
export function monthColumns(year: number, month: number): (PlainDate | null)[] {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const offset = yearRowOffset(first);
  const length = daysInMonth(year, month);
  return Array.from({ length: YEAR_COLUMNS }, (_, c) => {
    const n = c - offset + 1;
    return n >= 1 && n <= length ? addDays(first, n - 1) : null;
  });
}

/**
 * The year at a glance: one row per month in a fixed 37-column Saturday-to-Sunday grid.
 * Each day shows its number at the top and its first Entries as coloured lines (with their
 * titles on wide screens); a High-importance day has its number filled with that colour.
 */
export function YearGrid({
  year,
  entries,
  types,
  today,
  locale,
  holidays = new Map(),
}: {
  year: number;
  entries: Entry[];
  types: EntryType[];
  today: PlainDate;
  locale: string;
  /** Public Holiday names by date. */
  holidays?: Map<string, string[]>;
}) {
  const colorOf = (e: Entry) => types.find((t) => t.id === e.entryTypeId)?.color ?? "#607d8b";
  const letters = yearWeekdayLetters(locale);

  return (
    <div className="relative overflow-x-auto bg-surface p-2">
      <table className="w-full min-w-[56rem] table-fixed border-collapse text-[10px] lg:text-xs">
        <thead>
          <tr>
            <th className="w-10" />
            {letters.map((letter, c) => (
              <th
                key={c}
                className={`font-semibold ${isWeekendColumn(c) ? "bg-weekend text-weekend-ink" : "text-muted"}`}
              >
                {letter}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 12 }, (_, m) => (
            <tr key={m}>
              <th className="pr-1 text-left font-semibold first-letter:uppercase">
                {formatPlainDate(`${year}-${String(m + 1).padStart(2, "0")}-01`, locale, {
                  month: "short",
                })}
              </th>
              {monthColumns(year, m + 1).map((day, c) => {
                if (!day) {
                  return (
                    <td
                      key={c}
                      className={`border-t border-line/60 ${isWeekendColumn(c) ? "bg-weekend/45" : ""}`}
                    />
                  );
                }
                const dayEntries = entriesOn(entries, day);
                const high = dayEntries.find((e) => e.importance === "high");
                const names = holidays.get(day);
                return (
                  <td
                    key={c}
                    className={`border-t border-l border-line/60 p-0 align-top ${names ? "bg-holiday" : isWeekendColumn(c) ? "bg-weekend" : ""}`}
                  >
                    <Link
                      to={`/month/${day.slice(0, 7)}?day=${day}`}
                      data-testid={`year-day-${day}`}
                      title={[...(names ?? []), ...dayEntries.map((e) => e.title)].join("\n")}
                      data-high={high ? "true" : undefined}
                      className={`flex min-h-10 flex-col gap-px p-0.5 lg:min-h-16 ${day === today ? "outline-2 -outline-offset-2 outline-accent" : ""}`}
                    >
                      <span
                        style={
                          high ? { backgroundColor: colorOf(high), color: "white" } : undefined
                        }
                        className={`self-start rounded-sm px-0.5 leading-tight font-semibold tabular-nums ${!high && names ? "text-holiday-ink" : !high && isWeekendColumn(c) ? "text-weekend-ink" : ""}`}
                      >
                        {Number(day.slice(8))}
                      </span>
                      {dayEntries.slice(0, LINES).map((e) => (
                        <span
                          key={e.key}
                          data-testid="year-entry"
                          style={{ backgroundColor: colorOf(e) }}
                          className={`block h-1 rounded-sm lg:h-auto lg:truncate lg:px-0.5 lg:text-[10px] lg:leading-tight lg:text-white ${importanceClass(e)}`}
                        >
                          <span className="hidden lg:inline">{e.title}</span>
                        </span>
                      ))}
                      {dayEntries.length > LINES && (
                        <span className="text-[9px] leading-none text-muted">
                          +{dayEntries.length - LINES}
                        </span>
                      )}
                    </Link>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
