import { useRef, type ReactNode } from "react";
import { Link } from "react-router";
import { DAYS_ROW, DAYS_ROW_STICKY } from "./bands";
import { YEAR_COLUMNS, yearRowOffset } from "../../core/layout";
import { addDays, daysInMonth, formatPlainDate, type PlainDate } from "../../core/plain-date";
import type { EntryType } from "../entry-types/model";
import type { Shown as Entry } from "../entries/model";
import { EntryIcon, importanceClass } from "./EntryBlock";
import { entriesOn } from "./MonthGrid";
import { TODAY_PILL, TODAY_TINT } from "./today";

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

/**
 * The months' (and the Persons') names: they stay at the left while the days scroll sideways
 * under them, as the weekday letters stay at the top.
 */
export const NAMES_COLUMN = "sticky left-0 z-10 bg-surface";
/** One width for the names column whether the year shows the Family or each Person, so the corner
 * and the days stay put when switching; a long name is cut short instead. */
export const NAMES_WIDTH = "w-20";
/** A month's name in the names column, the same in both. */
export const MONTH_NAME = "pr-1 text-left text-xs font-semibold lg:text-sm";

const TABLE = "w-full min-w-[56rem] table-fixed border-collapse text-[10px] lg:text-xs";

/**
 * The year's sheet, which scrolls sideways on a narrow screen. Its weekday letters are a table of
 * their own: a row inside a sideways scroller cannot stick under the bar, so the letters stick
 * outside it and follow its sideways scroll (and it theirs). `corner` sits over the names column;
 * `children` are the year's table bodies.
 */
export function YearSheet({
  corner,
  locale,
  testId,
  children,
}: {
  corner?: ReactNode;
  locale: string;
  testId?: string;
  children: ReactNode;
}) {
  const head = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  // Each scroller carries the other along, so the letters stay over their days.
  const follow = (to: HTMLDivElement | null, left: number) => {
    if (to && to.scrollLeft !== left) to.scrollLeft = left;
  };
  // Both tables share their columns' widths.
  const columns = (
    <colgroup>
      <col className={NAMES_WIDTH} />
      {Array.from({ length: YEAR_COLUMNS }, (_, c) => (
        <col key={c} />
      ))}
    </colgroup>
  );
  return (
    <div className="calendar-sheet relative bg-surface px-2 pb-2">
      {/* Under the bar on a phone; on a wide screen the year scrolls in its own box, at its top.
          Its shadows fill the sheet's margins beside it, so no day shows through there. */}
      <div
        ref={head}
        onScroll={(e) => follow(body.current, e.currentTarget.scrollLeft)}
        data-testid="days-row"
        className={`${DAYS_ROW_STICKY} overflow-x-auto bg-surface shadow-[-0.5rem_0_var(--color-surface),0.5rem_0_var(--color-surface)] [scrollbar-width:none] lg:top-0`}
      >
        <table className={TABLE}>
          {columns}
          <thead>
            <tr>
              <th className={NAMES_COLUMN}>{corner}</th>
              {yearWeekdayLetters(locale).map((letter, c) => (
                <th
                  key={c}
                  className={`${DAYS_ROW} ${isWeekendColumn(c) ? "bg-weekend text-weekend-ink" : "text-muted"}`}
                >
                  {letter}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>
      <div
        ref={body}
        onScroll={(e) => follow(head.current, e.currentTarget.scrollLeft)}
        data-testid={testId}
        className="overflow-x-auto"
      >
        <table className={TABLE}>
          {columns}
          {children}
        </table>
      </div>
    </div>
  );
}

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
  dayLink,
  monthLink,
  selected,
  corner,
}: {
  year: number;
  entries: Entry[];
  types: EntryType[];
  today: PlainDate;
  locale: string;
  /** Public Holiday names by date. */
  holidays?: Map<string, string[]>;
  /** Where tapping a day goes. */
  dayLink: (day: PlainDate) => string;
  /** Where tapping a month's name goes. */
  monthLink: (first: PlainDate) => string;
  /** The day in focus, outlined. */
  selected?: PlainDate;
  /** Above the months' names, on the weekday letters' row. */
  corner?: ReactNode;
}) {
  const typeOf = (e: Entry) => types.find((t) => t.id === e.entryTypeId);
  const colorOf = (e: Entry) => typeOf(e)?.color ?? "#607d8b";

  return (
    <YearSheet corner={corner} locale={locale}>
      <tbody>
        {Array.from({ length: 12 }, (_, m) => (
          <tr key={m}>
            <th className={`${NAMES_COLUMN} ${MONTH_NAME}`}>
              <Link
                to={monthLink(`${year}-${String(m + 1).padStart(2, "0")}-01`)}
                data-testid={`year-month-${m + 1}`}
                className="block first-letter:uppercase hover:underline"
              >
                {formatPlainDate(`${year}-${String(m + 1).padStart(2, "0")}-01`, locale, {
                  month: "long",
                })}
              </Link>
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
                  className={`border-t border-l border-line/60 p-0 align-top ${names ? "bg-holiday" : isWeekendColumn(c) ? "bg-weekend" : ""} ${day === today ? TODAY_TINT : ""}`}
                >
                  <Link
                    to={dayLink(day)}
                    data-testid={`year-day-${day}`}
                    title={[...(names ?? []), ...dayEntries.map((e) => e.title)].join("\n")}
                    data-high={high ? "true" : undefined}
                    data-today={day === today || undefined}
                    aria-current={day === selected ? "date" : undefined}
                    className={`flex min-h-10 flex-col gap-px p-0.5 lg:min-h-16 ${day === selected ? "outline-2 -outline-offset-2 outline-accent" : ""}`}
                  >
                    <span
                      style={
                        high && day !== today
                          ? { backgroundColor: colorOf(high), color: "white" }
                          : undefined
                      }
                      className={`self-start leading-tight font-semibold tabular-nums ${day === today ? TODAY_PILL : `rounded-sm px-0.5 ${!high && names ? "text-holiday-ink" : !high && isWeekendColumn(c) ? "text-weekend-ink" : ""}`}`}
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
                        <span className="hidden items-center gap-0.5 lg:flex">
                          <span className="shrink-0">
                            <EntryIcon entry={e} type={typeOf(e)} size={10} />
                          </span>
                          <span className="min-w-0 truncate">{e.title}</span>
                        </span>
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
    </YearSheet>
  );
}
