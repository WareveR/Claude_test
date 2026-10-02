import { Link } from "react-router";
import { YEAR_COLUMNS, yearRowOffset } from "../../core/layout";
import { addDays, daysInMonth, formatPlainDate, type PlainDate } from "../../core/plain-date";
import type { EntryType } from "../entry-types/model";
import type { Shown as Entry } from "../entries/model";
import { entriesOn } from "./MonthGrid";

const SATURDAY = "2026-08-01";

/**
 * The year at a glance: one row per month in a fixed 37-column Saturday-to-Sunday grid.
 * High-importance days are filled with their Entry Type's colour; other Entries show a dot.
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
  const weekdayLetters = Array.from({ length: 7 }, (_, i) =>
    formatPlainDate(addDays(SATURDAY, i), locale, { weekday: "narrow" }),
  );
  const isWeekendColumn = (column: number) => column % 7 < 2;

  return (
    <div className="overflow-x-auto bg-surface p-2">
      <table className="w-full table-fixed border-collapse text-[10px]">
        <thead>
          <tr>
            <th className="w-10" />
            {Array.from({ length: YEAR_COLUMNS }, (_, c) => (
              <th
                key={c}
                className={`font-semibold ${isWeekendColumn(c) ? "bg-weekend text-weekend-ink" : "text-muted"}`}
              >
                {weekdayLetters[c % 7]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 12 }, (_, m) => {
            const first = `${year}-${String(m + 1).padStart(2, "0")}-01`;
            const offset = yearRowOffset(first);
            const length = daysInMonth(year, m + 1);
            return (
              <tr key={m}>
                <th className="pr-1 text-left font-semibold first-letter:uppercase">
                  {formatPlainDate(first, locale, { month: "short" })}
                </th>
                {Array.from({ length: YEAR_COLUMNS }, (_, c) => {
                  const dayNumber = c - offset + 1;
                  if (dayNumber < 1 || dayNumber > length) {
                    return <td key={c} className={isWeekendColumn(c) ? "bg-weekend/45" : ""} />;
                  }
                  const day = addDays(first, dayNumber - 1);
                  const dayEntries = entriesOn(entries, day);
                  const high = dayEntries.find((e) => e.importance === "high");
                  const names = holidays.get(day);
                  return (
                    <td
                      key={c}
                      className={`p-px ${names ? "bg-holiday" : isWeekendColumn(c) ? "bg-weekend" : ""}`}
                    >
                      <Link
                        to={`/month/${day.slice(0, 7)}?day=${day}`}
                        data-testid={`year-day-${day}`}
                        title={names?.join(", ")}
                        data-high={high ? "true" : undefined}
                        style={
                          high ? { backgroundColor: colorOf(high), color: "white" } : undefined
                        }
                        className={`relative flex aspect-square items-center justify-center rounded-sm tabular-nums ${day === today ? "outline-2 outline-accent" : ""} ${!high && names ? "font-semibold text-holiday-ink" : !high && isWeekendColumn(c) ? "font-semibold text-weekend-ink" : ""}`}
                      >
                        {dayNumber}
                        {!high && dayEntries.length > 0 && (
                          <i
                            data-testid="year-dot"
                            style={{ backgroundColor: colorOf(dayEntries[0]) }}
                            className="absolute bottom-0 left-1/2 size-1 -translate-x-1/2 rounded-full"
                          />
                        )}
                      </Link>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
