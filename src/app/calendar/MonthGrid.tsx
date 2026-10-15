import { useEffect, useRef, useState } from "react";
import { DAYS_ROW } from "./bands";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { lastDate } from "../../core/entry-time";
import { monthWeeks } from "../../core/layout";
import { formatPlainDate, isoWeek, weekday, type PlainDate } from "../../core/plain-date";
import type { EntryType } from "../entry-types/model";
import type { Shown as Entry } from "../entries/model";
import type { ShownDay } from "../weather/model";
import { WeatherBadge } from "../weather/WeatherBadge";
import { EntryIcon, importanceClass } from "./EntryBlock";
import { NoteLine } from "../layers/NoteLine";
import { isMovable, useEntryDrag } from "./useEntryDrag";
import { TODAY_PILL, TODAY_TINT } from "./today";

/** How many Entry lines a day shows before "+N", on narrow and on wide screens. */
const NARROW = 3;
const WIDE = 6;
/** On a phone, the height of a day's top line and of each line under it, in pixels. */
const TOP_PX = 22;
const LINE_PX = 14.5;

/**
 * How many lines fit under the day's number in each row of `weeks` rows, measured from the grid,
 * so a phone with free height shows more of each day; never fewer than {@link NARROW}.
 */
function useLinesThatFit(rows: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState(NARROW);
  useEffect(() => {
    const grid = ref.current;
    if (!grid || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const row = grid.clientHeight / rows;
      setLines(Math.max(NARROW, Math.floor((row - TOP_PX) / LINE_PX)));
    });
    observer.observe(grid);
    return () => observer.disconnect();
  }, [rows]);
  return { ref, lines };
}

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
  entries: given,
  types,
  today,
  selected,
  locale,
  dayLink,
  holidays = new Map(),
  notes = new Map(),
  weather = new Map(),
  weekLink,
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
  /** Calendar Layer notes by date (Moon, seasons…). */
  notes?: Map<string, string[]>;
  /** The forecast by date; shown small in each day, never tappable inside a link. */
  weather?: Map<string, ShownDay>;
  /** Where a week's number, left of its row, goes: that week. */
  weekLink?: (monday: PlainDate) => string;
}) {
  const { t } = useTranslation();
  const weeks = monthWeeks(month);
  // A narrow column of week numbers on the left, when they lead somewhere.
  const columns = weekLink
    ? "grid-cols-[1.75rem_repeat(7,minmax(0,1fr))]"
    : "grid-cols-[repeat(7,minmax(0,1fr))]";
  const drag = useEntryDrag({ entries: given, locale });
  const entries = drag.shown(given);
  const preview = drag.preview;
  const landsOn = (day: PlainDate) =>
    preview !== null && preview.startDate <= day && lastDate(preview) >= day;
  const typeOf = (e: Entry) => types.find((t) => t.id === e.entryTypeId);
  const colorOf = (e: Entry) => typeOf(e)?.color ?? "#607d8b";
  const { ref: gridRef, lines: fitLines } = useLinesThatFit(weeks.length);
  return (
    <div className="flex flex-1 flex-col bg-surface lg:min-h-0" {...drag.zone}>
      <div className={`grid ${columns} border-b border-line text-center`}>
        {weekLink && <div className={DAYS_ROW} />}
        {weeks[0].map((day) => (
          <div
            key={day}
            className={`${DAYS_ROW} first-letter:uppercase ${weekday(day) >= 5 ? "bg-weekend text-weekend-ink" : ""}`}
          >
            {formatPlainDate(day, locale, { weekday: "short" })}
          </div>
        ))}
      </div>
      {/* The rows share the free height, so a tall screen gives each day more lines. */}
      <div ref={gridRef} className={`grid flex-1 auto-rows-fr ${columns}`}>
        {weeks.flatMap((week) => [
          weekLink && (
            <Link
              key={`week-${week[0]}`}
              to={weekLink(week[0])}
              data-testid={`month-week-${week[0]}`}
              aria-label={t("views.openWeek", { week: isoWeek(week[0]).week })}
              className="border-b border-line pt-1 text-center text-[10px] font-semibold text-muted tabular-nums hover:bg-line/40 lg:text-xs"
            >
              {isoWeek(week[0]).week}
            </Link>
          ),
          ...week.map((day) => {
            const inMonth = day.slice(0, 7) === month.slice(0, 7);
            const dayEntries = entriesOn(entries, day);
            const names = holidays.get(day);
            const forecast = weather.get(day);
            // On a phone: the lines left after holidays and notes, keeping one for "+N" if needed.
            const room = fitLines - (names ? 1 : 0) - (notes.get(day)?.length ?? 0);
            const narrow = Math.max(
              Math.min(NARROW, fitLines),
              dayEntries.length <= room ? room : room - 1,
            );
            return (
              <Link
                key={day}
                to={dayLink(day)}
                data-testid={`month-day-${day}`}
                data-drop-date={day}
                aria-current={day === selected ? "date" : undefined}
                data-today={day === today || undefined}
                className={`flex min-h-16 min-w-0 flex-col gap-0.5 border-b border-l border-line p-0.5 text-left ${names ? "bg-holiday" : weekday(day) >= 5 ? "bg-weekend" : ""} ${day === today ? TODAY_TINT : ""} ${inMonth ? "" : "opacity-40"} ${day === selected ? "outline-2 -outline-offset-2 outline-accent" : ""} ${landsOn(day) ? "ring-2 ring-accent ring-inset" : ""}`}
              >
                {/* The day's number and its weather share the top line. */}
                <span className="flex items-start justify-between gap-1">
                  <span
                    className={`px-1 text-xs font-semibold tabular-nums lg:text-sm ${day === today ? TODAY_PILL : names ? "text-holiday-ink" : weekday(day) >= 5 ? "text-weekend-ink" : ""}`}
                  >
                    {Number(day.slice(8))}
                  </span>
                  {forecast && (
                    <WeatherBadge
                      day={forecast}
                      faded={forecast.faded}
                      size={14}
                      iconOnPhone
                      className="min-w-0 overflow-hidden text-[10px] leading-tight lg:text-xs"
                    />
                  )}
                </span>
                {names && (
                  <span
                    data-testid={`holiday-${day}`}
                    className="truncate text-[10px] leading-tight text-holiday-ink lg:text-xs"
                  >
                    {names.join(" · ")}
                  </span>
                )}
                {notes.get(day)?.map((note) => (
                  <span
                    key={note}
                    data-testid={`note-${day}`}
                    className="truncate text-[10px] leading-tight text-muted lg:text-xs"
                  >
                    <NoteLine note={note} />
                  </span>
                ))}
                {/* Wide screens have room for more lines per day. */}
                {dayEntries.slice(0, Math.max(WIDE, narrow)).map((e, i) => (
                  <span
                    key={e.key}
                    data-drag-entry={isMovable(e) ? e.key : undefined}
                    style={{ backgroundColor: colorOf(e) }}
                    className={`items-center gap-0.5 rounded ${drag.dragged?.key === e.key ? "opacity-50" : ""} px-0.5 text-[10px] leading-tight text-white lg:gap-1 lg:px-1 lg:py-0.5 lg:text-xs ${i >= narrow ? "hidden" : "flex"} ${i >= WIDE ? "lg:hidden" : "lg:flex"} ${importanceClass(e)}`}
                  >
                    <span className="shrink-0">
                      <EntryIcon entry={e} type={typeOf(e)} size={10} />
                    </span>
                    <span className="min-w-0 truncate">{e.title}</span>
                  </span>
                ))}
                {(dayEntries.length > narrow || dayEntries.length > WIDE) && (
                  <span
                    className={`text-[10px] text-muted ${dayEntries.length > narrow ? "" : "hidden"} ${dayEntries.length > WIDE ? "lg:inline" : "lg:hidden"}`}
                  >
                    <span className="lg:hidden">+{dayEntries.length - narrow}</span>
                    <span className="hidden lg:inline">+{dayEntries.length - WIDE}</span>
                  </span>
                )}
              </Link>
            );
          }),
        ])}
      </div>
      {drag.overlay}
    </div>
  );
}
