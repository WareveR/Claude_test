import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { DAYS_ROW, DAYS_ROW_STICKY } from "./bands";
import { Link, useNavigate } from "react-router";
import { daySpan, lastDate } from "../../core/entry-time";
import { layoutBars, layoutLanes } from "../../core/layout";
import { formatPlainDate, weekday, type PlainDate } from "../../core/plain-date";
import {
  busyHours,
  DEFAULT_SLEEP_HOURS,
  hourHeights,
  hourTops,
  isSleepHour,
  minutesAtY,
  openingHour,
  yOfMinutes,
  type SleepHours,
} from "../../core/sleep-hours";
import type { EntryType } from "../entry-types/model";
import type { Shown as Entry } from "../entries/model";
import type { Person } from "../persons/model";
import { EntryBlock } from "./EntryBlock";
import { NoteLine } from "../layers/NoteLine";
import { TODAY_PILL, TODAY_TINT } from "./today";
import { useGridLayers } from "./compact";
import { isMovable, useEntryDrag } from "./useEntryDrag";

/** The height of a waking hour; a Sleeping Hour with nothing on is half as high. */
const HOUR_PX = 44;

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
  /**
   * Calendar Layer notes by date (Moon, clock change, waste collection…), shown with the holiday
   * names on the All-day row.
   */
  notes?: Map<string, string[]>;
  /** Something to show on a day's row with its name, like its weather. */
  dayExtra?: (day: PlainDate) => ReactNode;
  /** Display Mode: tapping an empty spot starts nothing. */
  readOnly?: boolean;
  /** The day in focus, outlined on the days' row. */
  selected?: PlainDate;
  /** Where tapping a day's name goes, unless read-only: that day. */
  dayLink?: (day: PlainDate) => string;
  /** What sits in the corner above the hours, beside the day names. */
  corner?: ReactNode;
  /** The Family's Sleeping Hours, shown shorter and shaded unless something is on. */
  sleepHours?: SleepHours;
};

function isWeekend(date: PlainDate) {
  return weekday(date) >= 5;
}

/** The inside height of a box, followed as it resizes; 0 until it is measured. */
function useHeight(ref: RefObject<HTMLElement | null>): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHeight(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return height;
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
  selected,
  dayLink,
  readOnly = false,
  corner,
  sleepHours = DEFAULT_SLEEP_HOURS,
}: TimeGridProps) {
  const navigate = useNavigate();
  const scroller = useRef<HTMLDivElement>(null);
  // Only the All-day Entries (with the day notes), only the Timed ones, or both.
  const layers = useGridLayers();
  const showAllDay = layers !== "timed";
  const showTimed = layers !== "allDay";
  const drag = useEntryDrag({ entries: given, locale, enabled: !readOnly, scroller });
  const entries = drag.shown(given);
  // Each day's Timed Entries in minutes of that day.
  const spans = days.map((day) =>
    entries.flatMap((entry) => {
      if (entry.time.allDay) return [];
      const span = daySpan(entry.time, day);
      return span ? [{ entry, ...span }] : [];
    }),
  );
  // One height per hour row for all the days, so the rows stay lined up across the week.
  const busy = busyHours(spans.flat());
  // A tall screen with room to spare: the hours grow until the day fills it, no blank below.
  const room = useHeight(scroller);
  const natural = hourTops(hourHeights(sleepHours, busy, HOUR_PX))[24];
  const full = room > natural ? Math.floor((HOUR_PX * room * 100) / natural) / 100 : HOUR_PX;
  const heights = hourHeights(sleepHours, busy, full);
  const tops = hourTops(heights);
  const yOf = (minutes: number) => yOfMinutes(heights, minutes);

  // Opens at the wake-up hour, or just above the earliest Sleeping Hour with something on.
  // It opens again for other days, and follows the Entries as they arrive until scrolled.
  const openTop = tops[openingHour(sleepHours, busy)];
  const opened = useRef<{ days: string; top: number } | null>(null);
  const daysKey = `${days[0]}/${days.length}`;
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const last = opened.current;
    if (last?.days === daysKey && (last.top === openTop || Math.abs(el.scrollTop - last.top) > 1))
      return;
    el.scrollTo({ top: openTop });
    opened.current = { days: daysKey, top: el.scrollTop };
  }, [daysKey, openTop]);
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
  // Holiday names and the day notes take the all-day row's first line, so bars start below it.
  const holidayRows = days.some((day) => holidays.has(day) || notes.has(day)) ? 1 : 0;
  // The day view: the whole date ("Friday 23 October").
  const single = days.length === 1;

  return (
    <div className="calendar-sheet flex min-h-0 flex-1 flex-col bg-surface" {...drag.zone}>
      {/* Stays under the bar while the page scrolls the grid by; the hours scroll under it. */}
      <div
        data-testid="days-row"
        className={`grid ${DAYS_ROW_STICKY} border-b border-line bg-surface`}
        style={{ gridTemplateColumns: columns }}
      >
        <div className="flex items-start justify-center pt-1">{corner}</div>
        {days.map((day) => (
          <div
            key={day}
            data-drop-date={day}
            aria-current={!single && day === selected ? "date" : undefined}
            className={`@container min-w-0 ${!single && day === selected ? "outline-2 -outline-offset-2 outline-accent" : ""} ${DAYS_ROW} ${single ? "flex flex-wrap items-center gap-x-4 gap-y-1 px-2 text-left" : "text-center"} ${holidays.has(day) ? "bg-holiday text-holiday-ink" : isWeekend(day) ? "bg-weekend text-weekend-ink" : ""} ${day === today ? "text-accent" : ""}`}
          >
            {/* One line: the weekday and the day; three letters when the column is narrow. */}
            <DayName
              to={!single && !readOnly && dayLink ? dayLink(day) : undefined}
              testId={`day-name-${day}`}
            >
              {single ? (
                <span
                  data-testid="day-title"
                  className={day === today ? "rounded-full bg-accent px-2 text-accent-ink" : ""}
                >
                  {formatPlainDate(day, locale, { weekday: "long", day: "numeric", month: "long" })}
                </span>
              ) : (
                <>
                  <span className="@max-[7.5rem]:hidden">
                    {formatPlainDate(day, locale, { weekday: "short" }).replace(/[.,]/g, "")}{" "}
                    <span className={day === today ? TODAY_PILL : ""}>
                      {formatPlainDate(day, locale, { day: "numeric" })}
                    </span>
                  </span>
                  <span className="hidden @max-[7.5rem]:inline">
                    {formatPlainDate(day, locale, { weekday: "short" })
                      .replace(".", "")
                      .slice(0, 3)}{" "}
                    <span className={day === today ? TODAY_PILL : ""}>
                      {formatPlainDate(day, locale, { day: "numeric" })}
                    </span>
                  </span>
                </>
              )}
            </DayName>
            {dayExtra?.(day)}
          </div>
        ))}
      </div>
      <div
        data-testid="all-day-row"
        className={`grid gap-0.5 border-b border-line py-1 ${showAllDay ? "" : "hidden"} ${showTimed ? "" : "min-h-0 flex-1 content-start overflow-y-auto"}`}
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
        {/* The day's notices first: holiday names, Moon, clock change, waste collection. */}
        {days.map((day, i) => {
          const names = holidays.get(day);
          const dayNotes = notes.get(day);
          return names || dayNotes ? (
            <div key={day} className="min-w-0" style={{ gridColumn: i + 2, gridRow: 1 }}>
              {names && (
                <div
                  data-testid={`holiday-${day}`}
                  className="truncate px-1 text-xs text-holiday-ink lg:text-sm"
                >
                  {names.join(" · ")}
                </div>
              )}
              {dayNotes?.map((note) => (
                <div
                  key={note}
                  data-testid={`note-${day}`}
                  className="truncate px-1 text-[11px] text-muted lg:text-xs"
                >
                  <NoteLine note={note} />
                </div>
              ))}
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
            // Narrow day columns: the title stays on one line, cut short, never a letter a line.
            className={`max-lg:[&>[data-entry-text]]:truncate ${drag.dragged?.key === bar.entry.key ? "opacity-50" : ""}`}
            style={{
              gridColumn: `${bar.column + 2} / span ${bar.span}`,
              gridRow: bar.row + 1 + holidayRows,
            }}
          />
        ))}
      </div>
      <div
        ref={scroller}
        data-testid="time-scroller"
        className={`min-h-0 flex-1 overflow-y-auto ${showTimed ? "" : "hidden"}`}
      >
        <div className="relative grid" style={{ gridTemplateColumns: columns, height: tops[24] }}>
          <div className="relative">
            {Array.from({ length: 24 }, (_, h) =>
              isSleepHour(sleepHours, h) ? (
                <div
                  key={`sleep-${h}`}
                  className="pointer-events-none absolute inset-x-0 bg-ink/5"
                  style={{ top: tops[h], height: heights[h] }}
                />
              ) : null,
            )}
            {Array.from({ length: 24 }, (_, h) => (
              <span
                key={h}
                className="absolute right-1.5 -translate-y-1/2 text-xs font-semibold text-ink/70 tabular-nums lg:text-sm"
                style={{ top: tops[h] }}
              >
                {h > 0 ? `${h}h` : ""}
              </span>
            ))}
          </div>
          {days.map((day, i) => {
            const blocks = layoutLanes(spans[i]);
            const landing = preview && !preview.allDay ? daySpan(preview, day) : null;
            return (
              <div
                key={day}
                data-testid={`day-column-${day}`}
                data-drop-date={day}
                data-drop-hours={heights.join(",")}
                data-today={day === today || undefined}
                className={`relative border-l border-line ${holidays.has(day) ? "bg-holiday/40" : isWeekend(day) ? "bg-weekend/40" : ""} ${day === today ? TODAY_TINT : ""}`}
                onClick={(e) => {
                  if (readOnly || e.target !== e.currentTarget) return;
                  const minutes = minutesAtY(heights, e.nativeEvent.offsetY);
                  const hour = Math.min(23, Math.floor(minutes / 60));
                  navigate(`/entries/new?date=${day}&time=${String(hour).padStart(2, "0")}:00`);
                }}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={h}
                    data-testid={i === 0 ? `hour-row-${h}` : undefined}
                    data-sleep={isSleepHour(sleepHours, h) || undefined}
                    className={`pointer-events-none absolute inset-x-0 border-t border-line/60 ${isSleepHour(sleepHours, h) ? "bg-ink/5" : ""}`}
                    style={{ top: tops[h], height: heights[h] }}
                  />
                ))}
                {blocks.map((b) => (
                  <EntryBlock
                    key={b.entry.key}
                    entry={b.entry}
                    type={typeOf(b.entry)}
                    persons={persons}
                    label={b.entry.time.allDay ? undefined : b.entry.time.startTime}
                    labelWide={days.length > 1}
                    movable={movable(b.entry)}
                    className={`absolute ${b.moment ? "rounded-full" : ""} ${drag.dragged?.key === b.entry.key ? "opacity-50" : ""}`}
                    style={{
                      top: yOf(b.start),
                      height: Math.max(yOf(b.end) - yOf(b.start), 16),
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
                      top: yOf(landing.start),
                      height: Math.max(yOf(landing.end) - yOf(landing.start), 16),
                    }}
                  />
                )}
                {day === today && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-overdue"
                    style={{ top: yOf(nowMinutes) }}
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

/** A day's name on the days' row: a link to that day where it leads somewhere. */
function DayName({ to, testId, children }: { to?: string; testId: string; children: ReactNode }) {
  const className = "block truncate whitespace-nowrap first-letter:uppercase";
  return to ? (
    <Link to={to} data-testid={testId} className={`${className} hover:underline`}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}
