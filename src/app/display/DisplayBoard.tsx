import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { AUTO_RETURN_MS, boardDays } from "../../core/display";
import { formatLocale } from "../../core/languages";
import { formatMonthRange } from "../../core/plain-date";
import { useSignedIn } from "../family";
import { FilterButton } from "../filter/FilterButton";
import { CalendarGrid } from "../views/Views";
import { ForecastButton } from "../weather/ForecastButton";
import { useForecastDays } from "../weather/model";
import { WeatherBadge } from "../weather/WeatherBadge";
import { useSwipe } from "../ui/useSwipe";
import { useRolloverToday } from "./hooks";
import { useTasksHidden, useWeekCompact } from "../calendar/compact";
import { GridCorner } from "../calendar/GridCorner";
import { TasksAccordion, usePeriodTasks } from "../tasks/TasksAccordion";

/**
 * Display Mode: a seven-day time grid starting today across the whole screen (the coming days'
 * Entries as a list are in the Summary), movable a week at a time and back to today by itself
 * after three untouched minutes.
 */
export function DisplayBoard() {
  const { t } = useTranslation();
  const { family, language } = useSignedIn();
  const locale = formatLocale(language);
  const today = useRolloverToday(family.timeZone);
  const forecast = useForecastDays();
  // Like the week view: the weather and day notes can be hidden so the hours get the room.
  const compact = useWeekCompact();
  // The week shown is in the address, so Back from an Entry returns to it.
  const [search, setSearch] = useSearchParams();
  const weeksAway = Number(search.get("week")) || 0;
  const setWeeksAway = (weeks: number) =>
    setSearch(weeks === 0 ? {} : { week: String(weeks) }, { replace: true });
  const [touches, setTouches] = useState(0);
  useEffect(() => {
    if (weeksAway === 0) return;
    const id = setTimeout(() => setSearch({}, { replace: true }), AUTO_RETURN_MS);
    return () => clearTimeout(id);
  }, [weeksAway, touches, setSearch]);

  useSwipe(
    () => setWeeksAway(weeksAway - 1),
    () => setWeeksAway(weeksAway + 1),
  );
  const days = boardDays(today, weeksAway);
  // The week's Tasks stay out of the way unless asked for; the Summary always has them.
  const tasksHidden = useTasksHidden();
  const tasks = usePeriodTasks(days[0], days[6]).tasks.length;
  // The days carry their numbers; the row says only the month, so it stays one short line.
  const title = formatMonthRange(days[0], days[6], locale);
  const arrow = "rounded-md p-1 hover:bg-surface";
  return (
    <div
      data-testid="display-board"
      // The board always fills the screen below the header, a phone's too: no strip left over.
      className="flex min-h-0 flex-1 flex-col"
      onPointerDownCapture={() => setTouches((n) => n + 1)}
      onScrollCapture={() => setTouches((n) => n + 1)}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <nav className="flex items-center gap-1 px-3 py-0.5 max-sm:px-2">
            <button
              type="button"
              aria-label={t("views.previous")}
              className={arrow}
              onClick={() => setWeeksAway(weeksAway - 1)}
            >
              <ChevronLeft aria-hidden size={20} strokeWidth={1.75} />
            </button>
            <h1
              className="min-w-0 truncate text-lg font-semibold first-letter:uppercase max-sm:text-base"
              data-testid="board-range"
            >
              {title}
            </h1>
            <button
              type="button"
              aria-label={t("views.next")}
              className={arrow}
              onClick={() => setWeeksAway(weeksAway + 1)}
            >
              <ChevronRight aria-hidden size={20} strokeWidth={1.75} />
            </button>
            {weeksAway !== 0 && (
              // On the arrows' row; where space is short it says only "Today".
              <button
                type="button"
                data-testid="back-to-today"
                aria-label={t("display.backToToday")}
                className="ml-1 shrink-0 rounded-full bg-accent px-3 py-0.5 text-sm font-medium whitespace-nowrap text-accent-ink"
                onClick={() => setWeeksAway(0)}
              >
                <span aria-hidden className="max-md:hidden">
                  {t("display.backToToday")}
                </span>
                <span aria-hidden className="hidden max-md:inline">
                  {t("display.today")}
                </span>
              </button>
            )}
            <div className="ml-auto">
              <FilterButton />
            </div>
          </nav>
          {!tasksHidden && (
            <div className="pb-2 empty:hidden">
              <TasksAccordion from={days[0]} to={days[6]} />
            </div>
          )}
          <div className="flex min-h-72 flex-1 flex-col">
            {/* All seven days fit the screen, a phone's too: never a sideways scroll. */}
            <div className="relative flex min-h-0 flex-1">
              <div data-testid="wall-days" className="flex min-h-0 min-w-0 flex-1 flex-col">
                <CalendarGrid
                  days={days}
                  readOnly
                  plain={compact}
                  corner={<GridCorner tasks={tasks} />}
                  dayExtra={(day) => {
                    if (compact) return null;
                    const weather = forecast.get(day);
                    return (
                      weather && (
                        <div data-testid={`week-weather-${day}`}>
                          <ForecastButton>
                            <WeatherBadge
                              day={weather}
                              faded={weather.faded}
                              size={16}
                              rain
                              iconOnPhone
                              stacked
                              className="text-xs"
                            />
                          </ForecastButton>
                        </div>
                      )
                    );
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
