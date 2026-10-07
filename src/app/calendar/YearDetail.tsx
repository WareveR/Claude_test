import { Link } from "react-router";
import {
  addDays,
  daysInMonth,
  formatPlainDate,
  weekday,
  type PlainDate,
} from "../../core/plain-date";
import type { EntryType } from "../entry-types/model";
import type { Shown as Entry } from "../entries/model";
import type { Person } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { entriesOn } from "./MonthGrid";

/**
 * The year in detail: for each month, one line per Person (and one for the whole Family)
 * with a cell per day, coloured by the Entry Type of that day's first Entry.
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

  return (
    <div className="flex flex-col gap-4 overflow-x-auto bg-surface p-2" data-testid="year-detail">
      {Array.from({ length: 12 }, (_, m) => {
        const first = `${year}-${String(m + 1).padStart(2, "0")}-01`;
        const days = Array.from({ length: daysInMonth(year, m + 1) }, (_, i) => addDays(first, i));
        const shade = (day: PlainDate) =>
          holidays.has(day) ? "bg-holiday" : weekday(day) >= 5 ? "bg-weekend" : "";
        return (
          <table key={m} className="w-full min-w-[48rem] table-fixed border-collapse text-[10px]">
            <thead>
              <tr>
                <th className="w-28 pr-1 text-left text-sm font-semibold first-letter:uppercase">
                  {formatPlainDate(first, locale, { month: "long" })}
                </th>
                {days.map((day) => (
                  <th
                    key={day}
                    className={`font-semibold tabular-nums ${shade(day)} ${day === today ? "text-accent" : holidays.has(day) ? "text-holiday-ink" : weekday(day) >= 5 ? "text-weekend-ink" : "text-muted"}`}
                  >
                    {Number(day.slice(8))}
                  </th>
                ))}
                {/* Short months keep their columns as wide as long ones. */}
                {Array.from({ length: 31 - days.length }, (_, i) => (
                  <th key={`pad-${i}`} />
                ))}
              </tr>
            </thead>
            <tbody>
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
                  {days.map((day) => {
                    const mine = entriesOn(entries, day).filter(line.owns);
                    return (
                      <td key={day} className={`border-l border-line/60 p-px ${shade(day)}`}>
                        {mine.length > 0 && (
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
                  {Array.from({ length: 31 - days.length }, (_, i) => (
                    <td key={`pad-${i}`} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      })}
    </div>
  );
}
