import { useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { daySpan } from "../../core/entry-time";
import { layoutBars, layoutLanes } from "../../core/layout";
import { formatPlainDate, weekday, type PlainDate } from "../../core/plain-date";
import type { EntryType } from "../entry-types/model";
import type { Shown as Entry } from "../entries/model";
import type { Person } from "../persons/model";
import { EntryBlock } from "./EntryBlock";

const HOUR_PX = 44;
const DAY_MINUTES = 24 * 60;

export type TimeGridProps = {
  days: PlainDate[];
  entries: Entry[];
  types: EntryType[];
  persons: Person[];
  today: PlainDate;
  /** Minutes since midnight in the Family Time Zone, for the "now" line. */
  nowMinutes: number;
  locale: string;
  /** Public Holiday names by date. */
  holidays?: Map<string, string[]>;
  /** Something to show under a day's name, like its weather. */
  dayExtra?: (day: PlainDate) => ReactNode;
};

function isWeekend(date: PlainDate) {
  return weekday(date) >= 5;
}

/**
 * Day columns with an all-day row on top and a 24-hour time grid below: the body of the
 * day and week views (and of Display Mode later).
 */
export function TimeGrid({
  days,
  entries,
  types,
  persons,
  today,
  nowMinutes,
  locale,
  holidays = new Map(),
  dayExtra,
}: TimeGridProps) {
  const navigate = useNavigate();
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 7 * HOUR_PX });
  }, []);
  const typeOf = (entry: Entry) => types.find((t) => t.id === entry.entryTypeId);
  const columns = `3rem repeat(${days.length}, minmax(0, 1fr))`;

  const bars = layoutBars(
    entries
      .filter((e) => e.time.allDay)
      .map((e) => ({ entry: e, startDate: e.time.startDate, endDate: e.time.endDate! })),
    days[0],
    days.length,
  );
  const barRows = Math.max(1, ...bars.map((b) => b.row + 1));
  // Holiday names take their own first line of the all-day row, so bars start below it.
  const holidayRows = days.some((day) => holidays.has(day)) ? 1 : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface">
      <div className="grid border-b border-line" style={{ gridTemplateColumns: columns }}>
        <div />
        {days.map((day) => (
          <div
            key={day}
            className={`py-1 text-center text-xs font-semibold first-letter:uppercase ${holidays.has(day) ? "bg-holiday text-holiday-ink" : isWeekend(day) ? "bg-weekend text-weekend-ink" : ""} ${day === today ? "text-accent" : ""}`}
          >
            {formatPlainDate(day, locale, { weekday: "short", day: "numeric" })}
            {dayExtra?.(day)}
          </div>
        ))}
      </div>
      <div
        data-testid="all-day-row"
        className="grid gap-0.5 border-b border-line py-1"
        style={{
          gridTemplateColumns: columns,
          gridTemplateRows: `repeat(${barRows + holidayRows}, auto)`,
        }}
      >
        {days.map((day, i) => {
          const names = holidays.get(day);
          return names ? (
            <div
              key={day}
              data-testid={`holiday-${day}`}
              className="truncate px-1 text-xs text-holiday-ink"
              style={{ gridColumn: i + 2, gridRow: 1 }}
            >
              {names.join(" · ")}
            </div>
          ) : null;
        })}
        {bars.map((bar) => (
          <EntryBlock
            key={bar.entry.key}
            entry={bar.entry}
            type={typeOf(bar.entry)}
            persons={persons}
            style={{
              gridColumn: `${bar.column + 2} / span ${bar.span}`,
              gridRow: bar.row + 1 + holidayRows,
            }}
          />
        ))}
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <div
          className="relative grid"
          style={{ gridTemplateColumns: columns, height: 24 * HOUR_PX }}
        >
          <div className="relative">
            {Array.from({ length: 24 }, (_, h) => (
              <span
                key={h}
                className="absolute right-1 -translate-y-1/2 text-[10px] text-muted tabular-nums"
                style={{ top: h * HOUR_PX }}
              >
                {h > 0 ? `${String(h).padStart(2, "0")}:00` : ""}
              </span>
            ))}
          </div>
          {days.map((day) => {
            const blocks = layoutLanes(
              entries.flatMap((entry) => {
                if (entry.time.allDay) return [];
                const span = daySpan(entry.time, day);
                return span ? [{ entry, ...span }] : [];
              }),
            );
            return (
              <div
                key={day}
                data-testid={`day-column-${day}`}
                className={`relative border-l border-line ${holidays.has(day) ? "bg-holiday/40" : isWeekend(day) ? "bg-weekend/40" : ""}`}
                onClick={(e) => {
                  if (e.target !== e.currentTarget) return;
                  const y = e.nativeEvent.offsetY;
                  const hour = Math.min(23, Math.floor(y / HOUR_PX));
                  navigate(`/entries/new?date=${day}&time=${String(hour).padStart(2, "0")}:00`);
                }}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={h}
                    className="pointer-events-none absolute inset-x-0 border-t border-line/60"
                    style={{ top: h * HOUR_PX }}
                  />
                ))}
                {blocks.map((b) => (
                  <EntryBlock
                    key={b.entry.key}
                    entry={b.entry}
                    type={typeOf(b.entry)}
                    persons={persons}
                    label={b.entry.time.allDay ? undefined : b.entry.time.startTime}
                    className={`absolute ${b.moment ? "rounded-full" : ""}`}
                    style={{
                      top: (b.start / 60) * HOUR_PX,
                      height: Math.max(((b.end - b.start) / 60) * HOUR_PX, 16),
                      left: `calc(${(b.lane / b.lanes) * 100}% + 1px)`,
                      width: `calc(${100 / b.lanes}% - 2px)`,
                    }}
                  />
                ))}
                {day === today && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-overdue"
                    style={{ top: (nowMinutes / DAY_MINUTES) * 24 * HOUR_PX }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
