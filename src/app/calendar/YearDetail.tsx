import { Link } from "react-router";
import { formatPlainDate, type PlainDate } from "../../core/plain-date";
import type { EntryType } from "../entry-types/model";
import type { Shown as Entry } from "../entries/model";
import type { Person } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { entriesOn } from "./MonthGrid";
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
}) {
  const colorOf = (e: Entry) => types.find((t) => t.id === e.entryTypeId)?.color ?? "#607d8b";
  const lines: { id: string; person: Person | null; owns: (e: Entry) => boolean }[] = [
    ...persons
      .filter((p) => !p.archived)
      .map((p) => ({ id: p.id, person: p, owns: (e: Entry) => e.personIds.includes(p.id) })),
    { id: "family", person: null, owns: (e: Entry) => e.personIds.length === 0 },
  ];
  const shade = (day: PlainDate | null, c: number) =>
    day && holidays.has(day) ? "bg-holiday" : isWeekendColumn(c) ? "bg-weekend" : "";

  return (
    <div className="overflow-x-auto bg-surface p-2" data-testid="year-detail">
      <table className="w-full min-w-[56rem] table-fixed border-collapse text-[10px] lg:text-xs">
        <thead>
          <tr>
            <th className="w-28" />
            {yearWeekdayLetters(locale).map((letter, c) => (
              <th
                key={c}
                className={`font-semibold ${isWeekendColumn(c) ? "bg-weekend text-weekend-ink" : "text-muted"}`}
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
                <th className="pt-1 pr-1 text-left text-sm font-semibold first-letter:uppercase">
                  {formatPlainDate(`${year}-${String(m + 1).padStart(2, "0")}-01`, locale, {
                    month: "long",
                  })}
                </th>
                {columns.map((day, c) => (
                  <th
                    key={c}
                    className={`pt-1 font-semibold tabular-nums ${shade(day, c)} ${day === today ? "text-accent" : day && holidays.has(day) ? "text-holiday-ink" : isWeekendColumn(c) ? "text-weekend-ink" : "text-muted"}`}
                  >
                    {day ? Number(day.slice(8)) : ""}
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
                        className={`border-l border-line/60 p-px ${day ? shade(day, c) : isWeekendColumn(c) ? "bg-weekend/45" : ""}`}
                      >
                        {day && mine.length > 0 && (
                          <Link
                            to={`/month/${day.slice(0, 7)}?day=${day}`}
                            title={mine.map((e) => e.title).join(", ")}
                            data-testid={`year-cell-${day}-${line.id}`}
                            style={{ backgroundColor: colorOf(mine[0]) }}
                            className="relative block h-4 rounded-sm"
                          >
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
