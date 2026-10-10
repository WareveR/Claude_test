import { useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { daySpan, lastDate } from "../../core/entry-time";
import { layoutBars, layoutLanes } from "../../core/layout";
import { formatPlainDate, weekday, type PlainDate } from "../../core/plain-date";
import type { EntryType } from "../entry-types/model";
import type { Shown as Entry } from "../entries/model";
import type { Person } from "../persons/model";
import { EntryBlock } from "./EntryBlock";
import { NoteLine } from "../layers/NoteLine";
import { isMovable, useEntryDrag } from "./useEntryDrag";

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
  /** Calendar Layer notes by date (Moon, seasons…), shown small under the day's name. */
  notes?: Map<string, string[]>;
  /** Something to show under a day's name, like its weather. */
  dayExtra?: (day: PlainDate) => ReactNode;
  /** Display Mode: tapping an empty spot starts nothing. */
  readOnly?: boolean;
};

function isWeekend(date: PlainDate) {
  return weekday(date) >= 5;
}

/**
 * Day columns with an all-day row on top and a 24-hour time grid below: the body of the
 * day and week views and of the Display Mode board.
 */
export function TimeGrid({
  days,
  entries: given,
  types,
  persons,
  today,
  nowMinutes,
  locale,
  holidays = new Map(),
  notes = new Map(),
  dayExtra,
  readOnly = false,
}: TimeGridProps) {
  const navigate = useNavigate();
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 7 * HOUR_PX });
  }, []);
  const drag = useEntryDrag({ entries: given, locale, enabled: !readOnly, scroller });
  const entries = drag.shown(given);
  const movable = (entry: Entry) => !readOnly && isMovable(entry);
  const preview = drag.preview;
  // Where an All-day Entry being dragged would land.
  const landsOn = (day: PlainDate) =>
    preview?.allDay === true && preview.startDate <= day && lastDate(preview) >= day;
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
    <div className="flex min-h-0 flex-1 flex-col bg-surface" {...drag.zone}>
      <div className="grid border-b border-line" style={{ gridTemplateColumns: columns }}>
        <div />
        {days.map((day) => (
          <div
            key={day}
            data-drop-date={day}
            className={`py-1.5 text-center text-sm font-bold first-letter:uppercase lg:text-base ${holidays.has(day) ? "bg-holiday text-holiday-ink" : isWeekend(day) ? "bg-weekend text-weekend-ink" : ""} ${day === today ? "text-accent" : ""}`}
          >
            <span className="max-lg:hidden">
              {formatPlainDate(day, locale, { weekday: "short", day: "numeric" })}
            </span>
            {/* Narrow columns: three letters and the day's number, never a wrapped weekday. */}
            <span className="whitespace-nowrap lg:hidden">
              {formatPlainDate(day, locale, { weekday: "short" }).replace(".", "").slice(0, 3)}{" "}
              {formatPlainDate(day, locale, { day: "numeric" })}
            </span>
            {dayExtra?.(day)}
            {notes.get(day)?.map((note) => (
              <div
                key={note}
                data-testid={`note-${day}`}
                className="truncate px-1 text-[11px] font-normal text-muted lg:text-xs"
              >
                <NoteLine note={note} />
              </div>
            ))}
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
        {/* Each day's cell under the bars, where an Entry can be dropped. */}
        {days.map((day, i) => (
          <div
            key={`drop-${day}`}
            data-drop-date={day}
            className={landsOn(day) ? "rounded-md bg-accent/20" : ""}
            style={{ gridColumn: i + 2, gridRow: "1 / -1" }}
          />
        ))}
        {days.map((day, i) => {
          const names = holidays.get(day);
          return names ? (
            <div
              key={day}
              data-testid={`holiday-${day}`}
              className="truncate px-1 text-xs text-holiday-ink lg:text-sm"
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
            movable={movable(bar.entry)}
            className={drag.dragged?.key === bar.entry.key ? "opacity-50" : ""}
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
                className="absolute right-1.5 -translate-y-1/2 text-xs font-semibold text-ink/70 tabular-nums lg:text-sm"
                style={{ top: h * HOUR_PX }}
              >
                {h > 0 ? `${h}h` : ""}
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
            const landing = preview && !preview.allDay ? daySpan(preview, day) : null;
            return (
              <div
                key={day}
                data-testid={`day-column-${day}`}
                data-drop-date={day}
                data-drop-hour-px={HOUR_PX}
                className={`relative border-l border-line ${holidays.has(day) ? "bg-holiday/40" : isWeekend(day) ? "bg-weekend/40" : ""}`}
                onClick={(e) => {
                  if (readOnly || e.target !== e.currentTarget) return;
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
                    movable={movable(b.entry)}
                    className={`absolute ${b.moment ? "rounded-full" : ""} ${drag.dragged?.key === b.entry.key ? "opacity-50" : ""}`}
                    style={{
                      top: (b.start / 60) * HOUR_PX,
                      height: Math.max(((b.end - b.start) / 60) * HOUR_PX, 16),
                      left: `calc(${(b.lane / b.lanes) * 100}% + 1px)`,
                      width: `calc(${100 / b.lanes}% - 2px)`,
                    }}
                  />
                ))}
                {landing && (
                  <div
                    data-testid="drop-preview"
                    className="pointer-events-none absolute inset-x-0.5 z-10 rounded-md border-2 border-dashed border-accent bg-accent/15"
                    style={{
                      top: (landing.start / 60) * HOUR_PX,
                      height: Math.max(((landing.end - landing.start) / 60) * HOUR_PX, 16),
                    }}
                  />
                )}
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
      {drag.overlay}
    </div>
  );
}
