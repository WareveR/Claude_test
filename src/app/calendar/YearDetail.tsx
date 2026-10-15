import type { ReactNode } from "react";
import { Link } from "react-router";
import { DAYS_ROW } from "./bands";
import { formatPlainDate, type PlainDate } from "../../core/plain-date";
import type { EntryType } from "../entry-types/model";
import type { Shown as Entry } from "../entries/model";
import type { Person } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { EntryIcon } from "./EntryBlock";
import { entriesOn } from "./MonthGrid";
import { TODAY_PILL, TODAY_TINT } from "./today";
import { isWeekendColumn, monthColumns, yearWeekdayLetters } from "./YearGrid";

/**
 * The year in detail, in the same 37 Saturday-to-Sunday columns as the year grid: each month
 * has a row of day numbers and under it one line per Person (and one for the whole Family),
 * each day coloured by the Entry Type of that line's first Entry.
 */
export function YearDetail({
  year,
  entries,
  types,
  persons,
  today,
  locale,
  familyLabel,
  holidays = new Map(),
  dayLink,
  monthLink,
  selected,
  corner,
}: {
  year: number;
  entries: Entry[];
  types: EntryType[];
  persons: Person[];
  today: PlainDate;
  locale: string;
  /** The line for Entries that are for no Person in particular. */
  familyLabel: string;
  /** Public Holiday names by date. */
  holidays?: Map<string, string[]>;
  /** Where tapping a day goes, from its number or any of its lines. */
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
  const lines: { id: string; person: Person | null; owns: (e: Entry) => boolean }[] = [
    ...persons
      .filter((p) => !p.archived)
      .map((p) => ({ id: p.id, person: p, owns: (e: Entry) => e.personIds.includes(p.id) })),
    { id: "family", person: null, owns: (e: Entry) => e.personIds.length === 0 },
  ];
  const shade = (day: PlainDate | null, c: number) =>
    day && holidays.has(day) ? "bg-holiday" : isWeekendColumn(c) ? "bg-weekend" : "";

  return (
    <div
      className="calendar-sheet relative overflow-x-auto bg-surface px-2 pb-2"
      data-testid="year-detail"
    >
      <table className="w-full min-w-[56rem] table-fixed border-collapse text-[10px] lg:text-xs">
        <thead>
          <tr>
            <th className="w-28">{corner}</th>
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
        {Array.from({ length: 12 }, (_, m) => {
          const columns = monthColumns(year, m + 1);
          return (
            <tbody key={m} className="border-t-2 border-line">
              <tr>
                <th className="pt-1 pr-1 text-left text-sm font-semibold">
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
                {columns.map((day, c) => (
                  <th
                    key={c}
                    data-testid={day === today ? "year-detail-today" : undefined}
                    data-today={day === today || undefined}
                    className={`pt-1 font-semibold tabular-nums ${shade(day, c)} ${day === today ? TODAY_TINT : day && holidays.has(day) ? "text-holiday-ink" : isWeekendColumn(c) ? "text-weekend-ink" : "text-muted"}`}
                  >
                    {/* Every day opens, with Entries or without. */}
                    {day && (
                      <Link
                        to={dayLink(day)}
                        data-testid={`year-detail-day-${day}`}
                        aria-current={day === selected ? "date" : undefined}
                        className={`block rounded-sm ${day === selected ? "outline-2 -outline-offset-1 outline-accent" : ""}`}
                      >
                        <span className={day === today ? TODAY_PILL : ""}>
                          {Number(day.slice(8))}
                        </span>
                      </Link>
                    )}
                  </th>
                ))}
              </tr>
              {lines.map((line) => (
                <tr key={line.id} data-testid={`year-line-${m + 1}-${line.id}`}>
                  <th className="truncate py-px pr-1 text-left font-normal">
                    <span className="flex items-center gap-1">
                      {line.person && (
                        <PersonAvatar person={{ ...line.person, photoKey: null }} size={16} />
                      )}
                      <span className="truncate">{line.person?.name ?? familyLabel}</span>
                    </span>
                  </th>
                  {columns.map((day, c) => {
                    const mine = day ? entriesOn(entries, day).filter(line.owns) : [];
                    return (
                      <td
                        key={c}
                        className={`border-l border-line/60 p-px ${day ? shade(day, c) : isWeekendColumn(c) ? "bg-weekend/45" : ""} ${day === today ? TODAY_TINT : ""}`}
                      >
                        {day && mine.length > 0 && (
                          <Link
                            to={dayLink(day)}
                            title={mine.map((e) => e.title).join(", ")}
                            data-testid={`year-cell-${day}-${line.id}`}
                            style={{ backgroundColor: colorOf(mine[0]) }}
                            className="relative flex h-4 items-center justify-center overflow-hidden rounded-sm text-white"
                          >
                            <EntryIcon entry={mine[0]} type={typeOf(mine[0])} size={10} />
                            {mine.length > 1 && (
                              <i className="absolute top-0.5 right-0.5 size-1 rounded-full bg-white" />
                            )}
                          </Link>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
