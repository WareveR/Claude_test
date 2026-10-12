import type { ReactNode } from "react";
import { Clock } from "lucide-react";
import { setDayHours, useDayHours, useTasksHidden, useWeekCompact } from "../calendar/compact";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { formatLocale } from "../../core/languages";
import {
  addDays,
  addMonths,
  formatMonthRange,
  formatPlainDate,
  isPlainDate,
  minutesNowIn,
  startOfWeek,
  todayIn,
  type PlainDate,
} from "../../core/plain-date";
import { DayPopup } from "../calendar/DayPopup";
import { monthWeeks } from "../../core/layout";
import { entriesOn, MonthGrid } from "../calendar/MonthGrid";
import { TimeGrid } from "../calendar/TimeGrid";
import { YearDetail } from "../calendar/YearDetail";
import { YearGrid } from "../calendar/YearGrid";
import { CHECKLIST_BAR_TYPE, useChecklistBars } from "../checklists/bars";
import { useOccurrences } from "../entries/model";
import { usePersonFilter } from "../filter/model";
import { matchesFilter } from "../../core/person-filter";
import { useEntryTypes } from "../entry-types/model";
import { useHolidays } from "../holidays/model";
import { useDayNotes } from "../layers/model";
import { useSignedIn } from "../family";
import { usePersons } from "../persons/model";
import { useNow } from "../shell/useNow";
import { paths } from "../paths";
import { GRID_BOX, ViewBody } from "../shell/SidePanel";
import { ViewActions, ViewNav } from "../shell/ViewNav";
import { ForecastButton } from "../weather/ForecastButton";
import { HourlyStrip } from "../weather/HourlyStrip";
import { useDayWeather, usePastWeather, useWeather, type ShownDay } from "../weather/model";
import { WindReading } from "../weather/ForecastDetail";
import { WeatherBadge } from "../weather/WeatherBadge";
import { TasksAccordion, usePeriodTasks } from "../tasks/TasksAccordion";
import { GridCorner } from "../calendar/GridCorner";

function useToday(): PlainDate {
  return todayIn(useSignedIn().family.timeZone);
}

/** A window's Occurrences and Checklist period bars, with the Entry Types to draw them. */
export function useCalendar(from: PlainDate, to: PlainDate) {
  const occurrences = useOccurrences(from, to);
  const bars = useChecklistBars(from, to);
  const types = useEntryTypes();
  const filter = usePersonFilter();
  return {
    entries: [
      ...bars,
      ...(occurrences.data ?? []).filter((e) => matchesFilter(e.personIds, filter)),
    ],
    types: [...(types.data ?? []), CHECKLIST_BAR_TYPE],
  };
}

function useLocale() {
  return formatLocale(useSignedIn().language);
}

export function TodayRedirect() {
  return <Navigate to={paths.day(useToday())} replace />;
}

export function DayView() {
  const { t } = useTranslation();
  const { date = "" } = useParams();
  const locale = useLocale();
  const today = useToday();
  const day = isPlainDate(date) ? date : today;
  const weather = useDayWeather(day, day).get(day);
  const past = usePastWeather(day, day).get(day);
  const forecast = useWeather().data;
  const showHours = useDayHours();
  if (!isPlainDate(date)) return <Navigate to={paths.day(today)} replace />;
  const title = formatPlainDate(date, locale, { weekday: "long", day: "numeric", month: "long" });
  // The hours kept for a day gone by; the forecast's for today and the days ahead.
  const hours = past?.hours ?? (forecast?.hourly ?? []).filter((h) => h.time.startsWith(date));
  return (
    <>
      <ViewNav
        date={date}
        title={title}
        previous={paths.day(addDays(date, -1))}
        next={paths.day(addDays(date, 1))}
        compact
        extra={<DayWeatherLine weather={weather} />}
      />
      <ViewBody>
        <div className="flex flex-col gap-2 pb-2 empty:hidden">
          {showHours &&
            (hours.length > 0 ? (
              <HourlyStrip hours={hours} />
            ) : (
              <p data-testid="no-hours" className="px-4 text-sm text-muted">
                {t("views.noHours")}
              </p>
            ))}
          {date !== today && <TasksAccordion from={date} to={date} />}
        </div>
        <div className={GRID_BOX.lg}>
          <CalendarGrid days={[date]} headerActions={<ViewActions date={date} />} />
        </div>
      </ViewBody>
    </>
  );
}

/**
 * The day's weather beside its title: highest and lowest, chance of rain and wind, and a switch
 * for the hour by hour detail, there even when no hours are kept.
 */
function DayWeatherLine({ weather }: { weather?: ShownDay }) {
  const { t } = useTranslation();
  const showHours = useDayHours();
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {weather && (
        <ForecastButton>
          <span data-testid="day-weather" className="inline-flex items-center gap-3">
            <WeatherBadge day={weather} faded={weather.faded} rain />
            {weather.wind !== undefined && (
              <span className="text-muted">
                <WindReading speed={weather.wind} from={weather.windDir} />
              </span>
            )}
          </span>
        </ForecastButton>
      )}
      <button
        type="button"
        data-testid="day-hours"
        aria-pressed={showHours}
        aria-label={showHours ? t("views.hideHours") : t("views.showHours")}
        onClick={() => setDayHours(!showHours)}
        className={`rounded-md p-1.5 ${showHours ? "bg-accent text-accent-ink" : "text-muted hover:bg-line/60"}`}
      >
        <Clock aria-hidden size={18} strokeWidth={1.75} />
      </button>
    </span>
  );
}

export function WeekView() {
  const { date = "" } = useParams();
  const today = useToday();
  if (!isPlainDate(date)) return <Navigate to={paths.week(today)} replace />;
  if (startOfWeek(date) !== date) return <Navigate to={paths.week(date)} replace />;
  return <Week monday={date} />;
}

function Week({ monday }: { monday: PlainDate }) {
  const locale = useLocale();
  // On a phone on its side the weather, the day notes and the Tasks can be hidden so the hours get
  // the room; the Tasks are always in the Summary.
  const compact = useWeekCompact();
  const tasksHidden = useTasksHidden();
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const tasks = usePeriodTasks(monday, days[6]).tasks.length;
  const forecast = useDayWeather(monday, days[6]);
  // The months and year the week falls in, abbreviated so it keeps to the nav's line.
  const title = formatMonthRange(monday, days[6], locale, "short");
  return (
    <>
      <ViewNav
        date={monday}
        title={title}
        previous={paths.week(addDays(monday, -7))}
        next={paths.week(addDays(monday, 7))}
      />
      <ViewBody>
        {!tasksHidden && (
          <div className="pb-2 empty:hidden">
            <TasksAccordion from={monday} to={days[6]} />
          </div>
        )}
        <div className={GRID_BOX.lg}>
          <CalendarGrid
            days={days}
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
      </ViewBody>
    </>
  );
}

/** The time grid for some days, with the Entries, Entry Types and Persons it needs. */
export function CalendarGrid({
  days,
  dayExtra,
  readOnly,
  corner,
  headerActions,
  plain,
}: {
  days: PlainDate[];
  dayExtra?: (day: PlainDate) => ReactNode;
  readOnly?: boolean;
  corner?: ReactNode;
  headerActions?: ReactNode;
  plain?: boolean;
}) {
  const { family } = useSignedIn();
  const locale = useLocale();
  const now = useNow(60_000);
  const { entries, types } = useCalendar(days[0], days[days.length - 1]);
  const persons = usePersons();
  const holidays = useHolidays(days[0], days[days.length - 1]);
  const notes = useDayNotes(days[0], days[days.length - 1]);
  return (
    <TimeGrid
      days={days}
      entries={entries}
      types={types}
      persons={persons.data ?? []}
      today={todayIn(family.timeZone, now)}
      nowMinutes={minutesNowIn(family.timeZone, now)}
      locale={locale}
      holidays={holidays}
      notes={notes}
      dayExtra={dayExtra}
      readOnly={readOnly}
      corner={corner}
      headerActions={headerActions}
      plain={plain}
      sleepHours={family.sleepHours}
    />
  );
}

export function MonthView() {
  const { month = "" } = useParams();
  const today = useToday();
  const date = `${month}-01`;
  if (!/^\d{4}-\d{2}$/.test(month) || !isPlainDate(date))
    return <Navigate to={paths.month(today)} replace />;
  return <Month first={date} />;
}

function Month({ first }: { first: PlainDate }) {
  const locale = useLocale();
  const today = useToday();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const picked = search.get("day");
  const selected =
    picked && isPlainDate(picked) && picked.startsWith(first.slice(0, 7))
      ? picked
      : today.startsWith(first.slice(0, 7))
        ? today
        : first;
  const weeks = monthWeeks(first);
  const { entries, types } = useCalendar(weeks[0][0], weeks[weeks.length - 1][6]);
  const holidays = useHolidays(weeks[0][0], weeks[weeks.length - 1][6]);
  const notes = useDayNotes(weeks[0][0], weeks[weeks.length - 1][6]);
  const forecast = useDayWeather(weeks[0][0], weeks[weeks.length - 1][6]);
  const title = formatPlainDate(first, locale, { month: "long", year: "numeric" });
  const dayEntries = entriesOn(entries, selected);
  return (
    <>
      <ViewNav
        date={first}
        title={title}
        previous={paths.month(addMonths(first, -1))}
        next={paths.month(addMonths(first, 1))}
      />
      <ViewBody>
        {/* On wide screens the grid fills the height; a picked day opens over it. */}
        <div className="flex flex-1 flex-col lg:min-h-0">
          <MonthGrid
            month={first}
            entries={entries}
            types={types}
            today={today}
            selected={selected}
            locale={locale}
            holidays={holidays}
            notes={notes}
            weather={forecast}
            dayLink={(day) => `${paths.month(day)}?day=${day}`}
          />
        </div>
      </ViewBody>
      {picked === selected && (
        <DayPopup
          day={selected}
          entries={dayEntries}
          types={types}
          locale={locale}
          holidays={holidays.get(selected)}
          notes={notes.get(selected)}
          forecast={forecast.get(selected)}
          onClose={() => navigate(paths.month(first))}
        />
      )}
    </>
  );
}

export function YearView() {
  const { year = "" } = useParams();
  const today = useToday();
  if (!/^\d{4}$/.test(year)) return <Navigate to={paths.year(today)} replace />;
  return <Year year={Number(year)} />;
}

function Year({ year }: { year: number }) {
  const locale = useLocale();
  const today = useToday();
  const { t } = useTranslation();
  const [search] = useSearchParams();
  // The detail (a line per Person) is in the address, so back and reload keep it.
  const detail = search.get("detail") === "1";
  const persons = usePersons();
  const date = `${year}-01-01`;
  const { entries, types } = useCalendar(date, `${year}-12-31`);
  const holidays = useHolidays(date, `${year}-12-31`);
  const withDetail = (path: string) => (detail ? `${path}?detail=1` : path);
  const navigate = useNavigate();
  // A picked day opens over the year, keeping Detail as it was.
  const picked = search.get("day");
  const pickedDay =
    picked && isPlainDate(picked) && picked.startsWith(String(year)) ? picked : null;
  const dayLink = (day: PlainDate) => `${paths.year(date)}?${detail ? "detail=1&" : ""}day=${day}`;
  const notes = useDayNotes(date, `${year}-12-31`);
  const forecast = useDayWeather(date, `${year}-12-31`);
  return (
    <>
      <ViewNav
        date={date}
        title={String(year)}
        previous={withDetail(paths.year(addMonths(date, -12)))}
        next={withDetail(paths.year(addMonths(date, 12)))}
        extra={
          <Link
            to={detail ? paths.year(date) : `${paths.year(date)}?detail=1`}
            aria-pressed={detail}
            className={`rounded-md border px-3 py-1 text-sm ${detail ? "border-accent bg-accent text-accent-ink" : "border-line"}`}
          >
            {t("views.yearDetail")}
          </Link>
        }
      />
      <ViewBody>
        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {detail ? (
            <YearDetail
              year={year}
              entries={entries}
              types={types}
              persons={persons.data ?? []}
              today={today}
              locale={locale}
              familyLabel={t("views.family")}
              holidays={holidays}
              dayLink={dayLink}
            />
          ) : (
            <YearGrid
              year={year}
              entries={entries}
              types={types}
              today={today}
              locale={locale}
              holidays={holidays}
              dayLink={dayLink}
            />
          )}
        </div>
      </ViewBody>
      {pickedDay && (
        <DayPopup
          day={pickedDay}
          entries={entriesOn(entries, pickedDay)}
          types={types}
          locale={locale}
          holidays={holidays.get(pickedDay)}
          notes={notes.get(pickedDay)}
          forecast={forecast.get(pickedDay)}
          onClose={() => navigate(withDetail(paths.year(date)))}
        />
      )}
    </>
  );
}
