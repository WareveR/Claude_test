import type { ReactNode } from "react";
import { Rows3, Users } from "lucide-react";
import { usePeriodTasksShown, useWeatherShown } from "../calendar/compact";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { formatLocale } from "../../core/languages";
import {
  addDays,
  addMonths,
  formatDayTitle,
  formatMonthRange,
  isoWeek,
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
import { useOccurrences, type Shown } from "../entries/model";
import { usePersonFilter } from "../filter/model";
import { matchesFilter } from "../../core/person-filter";
import { useEntryTypes, type EntryType } from "../entry-types/model";
import { useHolidays } from "../holidays/model";
import { useDayNotes, useSunTimes } from "../layers/model";
import { SunriseIcon, SunsetIcon } from "../weather/WeatherIcon";
import { useSignedIn } from "../family";
import { usePersons } from "../persons/model";
import { useNow } from "../shell/useNow";
import { paths } from "../paths";
import { GRID_BOX, ViewBody } from "../shell/SidePanel";
import { ViewNav } from "../shell/ViewNav";
import { ForecastButton } from "../weather/ForecastButton";
import { HourlyStrip } from "../weather/HourlyStrip";
import { useDayWeather, usePastWeather, useWeather, type ShownDay } from "../weather/model";
import { WindReading } from "../weather/ForecastDetail";
import { WeatherBadge } from "../weather/WeatherBadge";
import { PeriodTasksList } from "../tasks/TasksAccordion";
import { periodLabel } from "../../core/period-label";
import { PeriodCurtain } from "./PeriodCurtain";
import { usePrefetchNeighbours } from "./prefetch";
import { focusedDay, setFocusedDay } from "./focus";
import { focusDay } from "../../core/periods";

function useToday(): PlainDate {
  return todayIn(useSignedIn().family.timeZone);
}

/**
 * A window's Occurrences and Checklist period bars, with the Entry Types to draw them. `ready`
 * says the window's own Entries have arrived; until then `entries` holds only the bars, and
 * nothing from another window is shown in their place, as its dates would be wrong.
 */
export function useCalendar(
  from: PlainDate,
  to: PlainDate,
): { entries: Shown[]; types: EntryType[]; ready: boolean } {
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
    ready: occurrences.data !== undefined,
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
  const weatherShown = useWeatherShown();
  const tasksShown = usePeriodTasksShown();
  usePrefetchNeighbours("day", day);
  if (!isPlainDate(date)) return <Navigate to={paths.day(today)} replace />;
  // Before the bar draws: the other views open on this day.
  setFocusedDay(date);
  const title = formatDayTitle(date, locale);
  // The hours kept for a day gone by; the forecast's for today and the days ahead.
  const hours = past?.hours ?? (forecast?.hourly ?? []).filter((h) => h.time.startsWith(date));
  return (
    <>
      <ViewNav
        date={date}
        title={title}
        shortTitle={formatDayTitle(date, locale, true)}
        previous={paths.day(addDays(date, -1))}
        next={paths.day(addDays(date, 1))}
        tasks={{ from: date, to: date }}
      />
      <ViewBody>
        {tasksShown ? (
          <PeriodTasksList from={date} to={date} />
        ) : (
          <div className={GRID_BOX.lg}>
            <CalendarGrid
              days={[date]}
              // The weather shares the day's own row: the day's, then hour by hour.
              dayExtra={() =>
                weatherShown && (
                  <>
                    <DayWeather weather={weather} />
                    <div data-testid="day-hours" className="w-full empty:hidden">
                      {hours.length > 0 ? (
                        <HourlyStrip hours={hours} lead={<SunTimes day={date} />} />
                      ) : (
                        <div className="flex items-center gap-3 empty:hidden">
                          <SunTimes day={date} />
                          {/* Said only for a day with weather but no hours kept. */}
                          {weather && (
                            <p data-testid="no-hours" className="text-sm font-normal text-muted">
                              {t("views.noHours")}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )
              }
            />
          </div>
        )}
      </ViewBody>
      <PeriodCurtain
        period={`day:${date}`}
        lines={periodLabel("day", date, date, locale)}
        from={date}
        to={date}
      />
    </>
  );
}

/** The day's weather beside its name: highest and lowest, chance of rain and wind. */
function DayWeather({ weather }: { weather?: ShownDay }) {
  if (!weather) return null;
  return (
    <ForecastButton>
      <span
        data-testid="day-weather"
        className="inline-flex items-center gap-3 text-sm font-normal"
      >
        <WeatherBadge day={weather} faded={weather.faded} rain />
        {weather.wind !== undefined && (
          <span className="text-muted">
            <WindReading speed={weather.wind} from={weather.windDir} />
          </span>
        )}
      </span>
    </ForecastButton>
  );
}

/**
 * Sunrise over sunset, as a small column left of the hour by hour detail, on any day, when this
 * device shows the Sun Layer.
 */
function SunTimes({ day }: { day: PlainDate }) {
  const { t } = useTranslation();
  const sun = useSunTimes(day);
  if (!sun || (!sun.rise && !sun.set)) return null;
  return (
    <span
      data-testid="sun-times"
      className="flex shrink-0 flex-col gap-2 text-xs text-muted tabular-nums"
    >
      <span aria-hidden className="flex flex-col items-center">
        <SunriseIcon size={16} /> {sun.rise ?? "–"}
      </span>
      <span aria-hidden className="flex flex-col items-center">
        <SunsetIcon size={16} /> {sun.set ?? "–"}
      </span>
      <span className="sr-only">
        {t("layers.sunrise")} {sun.rise ?? "–"}, {t("layers.sunset")} {sun.set ?? "–"}
      </span>
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
  const { t } = useTranslation();
  const locale = useLocale();
  const today = useToday();
  // On a phone on its side the weather and the day notes can be hidden so the hours get the room.
  const weatherShown = useWeatherShown();
  const tasksShown = usePeriodTasksShown();
  usePrefetchNeighbours("week", monday);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const forecast = useDayWeather(monday, days[6]);
  // The week's number in its year: "Semana 42, 2026".
  const { week, year } = isoWeek(monday);
  const title = t("views.weekTitle", { week, year });
  return (
    <>
      <ViewNav
        date={monday}
        title={title}
        shortTitle={t("views.weekShort", { week, year })}
        previous={paths.week(addDays(monday, -7))}
        next={paths.week(addDays(monday, 7))}
        tasks={{ from: monday, to: days[6] }}
      />
      <ViewBody>
        {tasksShown ? (
          <PeriodTasksList from={monday} to={days[6]} />
        ) : (
          <div className={GRID_BOX.lg}>
            <CalendarGrid
              days={days}
              // The day in focus is outlined; a day's name opens that day.
              selected={focusDay("week", monday, focusedDay(), today)}
              dayLink={paths.day}
              dayExtra={(day) => {
                if (!weatherShown) return null;
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
        )}
      </ViewBody>
      <PeriodCurtain
        period={`week:${monday}`}
        lines={periodLabel("range", monday, days[6], locale)}
        from={monday}
        to={days[6]}
      />
    </>
  );
}

/** The time grid for some days, with the Entries, Entry Types and Persons it needs. */
export function CalendarGrid({
  days,
  dayExtra,
  selected,
  dayLink,
  readOnly,
  corner,
}: {
  days: PlainDate[];
  dayExtra?: (day: PlainDate) => ReactNode;
  selected?: PlainDate;
  dayLink?: (day: PlainDate) => string;
  readOnly?: boolean;
  corner?: ReactNode;
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
      selected={selected}
      dayLink={dayLink}
      readOnly={readOnly}
      corner={corner}
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
      : // Else the day in focus, carried into this month: the one the other views open on.
        focusDay("month", first, focusedDay(), today);
  // A picked day is the one in focus when switching view.
  if (picked === selected) setFocusedDay(selected);
  const weeks = monthWeeks(first);
  usePrefetchNeighbours("month", first);
  const { entries, types } = useCalendar(weeks[0][0], weeks[weeks.length - 1][6]);
  const holidays = useHolidays(weeks[0][0], weeks[weeks.length - 1][6]);
  const notes = useDayNotes(weeks[0][0], weeks[weeks.length - 1][6]);
  const forecast = useDayWeather(weeks[0][0], weeks[weeks.length - 1][6]);
  const weatherShown = useWeatherShown();
  const title = formatMonthRange(first, first, locale);
  const dayEntries = entriesOn(entries, selected);
  const tasksShown = usePeriodTasksShown();
  const last = addDays(addMonths(first, 1), -1);
  return (
    <>
      <ViewNav
        date={first}
        title={title}
        previous={paths.month(addMonths(first, -1))}
        next={paths.month(addMonths(first, 1))}
        tasks={{ from: first, to: last }}
      />
      <ViewBody fill>
        {/* The grid fills the free height; a picked day opens over it. */}
        {tasksShown ? (
          <PeriodTasksList from={first} to={last} />
        ) : (
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
              weather={weatherShown ? forecast : undefined}
              dayLink={(day) => `${paths.month(day)}?day=${day}`}
              weekLink={paths.week}
            />
          </div>
        )}
      </ViewBody>
      <PeriodCurtain
        period={`month:${first}`}
        lines={periodLabel("month", first, first, locale)}
        from={weeks[0][0]}
        to={weeks[weeks.length - 1][6]}
      />
      {picked === selected && (
        <DayPopup
          day={selected}
          entries={dayEntries}
          types={types}
          locale={locale}
          holidays={holidays.get(selected)}
          notes={notes.get(selected)}
          forecast={forecast.get(selected)}
          today={selected === today}
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
  // The year always opens in Detail (a line per Person); the compact grid is asked for in the
  // address, so back, reload and the arrows keep it until the year is opened afresh.
  const detail = search.get("detail") !== "0";
  const persons = usePersons();
  const date = `${year}-01-01`;
  usePrefetchNeighbours("year", date);
  const { entries, types } = useCalendar(date, `${year}-12-31`);
  const holidays = useHolidays(date, `${year}-12-31`);
  const withDetail = (path: string) => (detail ? path : `${path}?detail=0`);
  const navigate = useNavigate();
  // A picked day opens over the year, keeping Detail as it was.
  const picked = search.get("day");
  const pickedDay =
    picked && isPlainDate(picked) && picked.startsWith(String(year)) ? picked : null;
  if (pickedDay) setFocusedDay(pickedDay);
  // The day in focus is outlined, as in the other views.
  const selected = pickedDay ?? focusDay("year", date, focusedDay(), today);
  const dayLink = (day: PlainDate) => `${paths.year(date)}?${detail ? "" : "detail=0&"}day=${day}`;
  // The whole Family at once, or a line for each of its members, above the months' names.
  const lines = (
    <span
      role="group"
      aria-label={t("views.yearLines")}
      className="flex rounded-md border border-line"
    >
      {(
        [
          [false, Users, t("views.yearFamily")],
          [true, Rows3, t("views.yearEach")],
        ] as const
      ).map(([each, Icon, label]) => (
        <Link
          key={label}
          to={each ? paths.year(date) : `${paths.year(date)}?detail=0`}
          aria-label={label}
          aria-pressed={detail === each}
          data-testid={each ? "year-each" : "year-family"}
          className={`flex flex-1 justify-center p-1 ${detail === each ? "bg-accent text-accent-ink" : ""}`}
        >
          <Icon aria-hidden size={16} strokeWidth={1.75} />
        </Link>
      ))}
    </span>
  );
  const notes = useDayNotes(date, `${year}-12-31`);
  const forecast = useDayWeather(date, `${year}-12-31`);
  return (
    <>
      <ViewNav
        date={date}
        title={String(year)}
        previous={withDetail(paths.year(addMonths(date, -12)))}
        next={withDetail(paths.year(addMonths(date, 12)))}
      />
      <ViewBody>
        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto" data-swipe-past-edges>
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
              monthLink={paths.month}
              selected={selected}
              corner={lines}
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
              monthLink={paths.month}
              selected={selected}
              corner={lines}
            />
          )}
        </div>
      </ViewBody>
      <PeriodCurtain
        period={`year:${year}`}
        lines={periodLabel("year", date, date, locale)}
        from={date}
        to={`${year}-12-31`}
      />
      {pickedDay && (
        <DayPopup
          day={pickedDay}
          entries={entriesOn(entries, pickedDay)}
          types={types}
          locale={locale}
          holidays={holidays.get(pickedDay)}
          notes={notes.get(pickedDay)}
          forecast={forecast.get(pickedDay)}
          today={pickedDay === today}
          onClose={() => navigate(withDetail(paths.year(date)))}
        />
      )}
    </>
  );
}
