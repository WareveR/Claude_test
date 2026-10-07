import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useParams, useSearchParams } from "react-router";
import { formatLocale } from "../../core/languages";
import {
  addDays,
  addMonths,
  formatPlainDate,
  isPlainDate,
  minutesNowIn,
  startOfWeek,
  todayIn,
  type PlainDate,
} from "../../core/plain-date";
import { EntryBlock } from "../calendar/EntryBlock";
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
import { useDayNotes, useSunTimes } from "../layers/model";
import { NoteLine } from "../layers/NoteLine";
import { SunriseIcon, SunsetIcon } from "../weather/WeatherIcon";
import { useSignedIn } from "../family";
import { usePersons } from "../persons/model";
import { useNow } from "../shell/useNow";
import { paths } from "../paths";
import { GRID_BOX, SidePanelLayout, TodayPanel } from "../shell/SidePanel";
import { ViewNav } from "../shell/ViewNav";
import { ForecastButton } from "../weather/ForecastButton";
import { HourlyStrip } from "../weather/HourlyStrip";
import { useDayWeather, usePastWeather } from "../weather/model";
import { WeatherBadge } from "../weather/WeatherBadge";
import { TasksAccordion } from "../tasks/TasksAccordion";

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
  const { date = "" } = useParams();
  const locale = useLocale();
  const today = useToday();
  const day = isPlainDate(date) ? date : today;
  const weather = useDayWeather(day, day).get(day);
  const past = usePastWeather(day, day).get(day);
  if (!isPlainDate(date)) return <Navigate to={paths.day(today)} replace />;
  const title = formatPlainDate(date, locale, { weekday: "long", day: "numeric", month: "long" });
  return (
    <>
      <ViewNav
        date={date}
        title={title}
        previous={paths.day(addDays(date, -1))}
        next={paths.day(addDays(date, 1))}
        extra={
          <>
            {date !== today && weather && (
              <ForecastButton>
                <WeatherBadge day={weather} faded={weather.faded} rain />
              </ForecastButton>
            )}
            {date !== today && <SunTimes day={date} />}
          </>
        }
      />
      <SidePanelLayout panel={<TodayPanel />}>
        {/* Today's hours and Tasks are in the panel; another day's sit above its grid. */}
        <div className="flex flex-col gap-2 pb-2 empty:hidden">
          {past && <HourlyStrip past={past.hours} />}
          {date !== today && <TasksAccordion from={date} to={date} />}
        </div>
        <div className={GRID_BOX.lg}>
          <CalendarGrid days={[date]} />
        </div>
      </SidePanelLayout>
    </>
  );
}

/** Sunrise and sunset beside the day's title, when this device shows the Sun Layer. */
function SunTimes({ day }: { day: PlainDate }) {
  const { t } = useTranslation();
  const sun = useSunTimes(day);
  if (!sun) return null;
  return (
    <span
      data-testid="sun-times"
      className="inline-flex items-center gap-1 text-sm text-muted tabular-nums"
    >
      <span aria-hidden className="inline-flex items-center gap-1">
        <SunriseIcon size={14} /> {sun.rise ?? "–"} · <SunsetIcon size={14} /> {sun.set ?? "–"}
      </span>
      <span className="sr-only">
        {t("layers.sunrise")} {sun.rise}, {t("layers.sunset")} {sun.set}
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
  const locale = useLocale();
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const forecast = useDayWeather(monday, days[6]);
  const short = { day: "numeric", month: "short" } as const;
  const title = `${formatPlainDate(monday, locale, short)} – ${formatPlainDate(days[6], locale, short)}`;
  return (
    <>
      <ViewNav
        date={monday}
        title={title}
        previous={paths.week(addDays(monday, -7))}
        next={paths.week(addDays(monday, 7))}
      />
      <SidePanelLayout panel={<TodayPanel />}>
        <div className="pb-2 empty:hidden">
          <TasksAccordion from={monday} to={days[6]} />
        </div>
        <div className={GRID_BOX.lg}>
          <CalendarGrid
            days={days}
            dayExtra={(day) => {
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
                        className="flex-wrap justify-center text-xs"
                      />
                    </ForecastButton>
                  </div>
                )
              );
            }}
          />
        </div>
      </SidePanelLayout>
    </>
  );
}

/** The time grid for some days, with the Entries, Entry Types and Persons it needs. */
export function CalendarGrid({
  days,
  dayExtra,
  readOnly,
}: {
  days: PlainDate[];
  dayExtra?: (day: PlainDate) => ReactNode;
  readOnly?: boolean;
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
  const { t } = useTranslation();
  const [search] = useSearchParams();
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
  const persons = usePersons();
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
      <SidePanelLayout panel={<TodayPanel />}>
        {/* On wide screens the grid fills the height; the picked day sits below it, or beside it
          on the widest screens. */}
        <div className="flex flex-1 flex-col lg:min-h-0 2xl:flex-row">
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
          <section
            className="flex flex-col gap-1 border-line p-4 lg:max-h-[40dvh] lg:shrink-0 lg:overflow-y-auto lg:border-t 2xl:max-h-none 2xl:w-[22rem] 2xl:border-t-0 2xl:border-l"
            data-testid="picked-day"
          >
            <div className="flex items-center gap-2">
              <h2 className="font-semibold first-letter:uppercase">
                {formatPlainDate(selected, locale, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </h2>
              {forecast.get(selected) && (
                <ForecastButton>
                  <WeatherBadge
                    day={forecast.get(selected)!}
                    faded={forecast.get(selected)!.faded}
                    rain
                  />
                </ForecastButton>
              )}
            </div>
            {holidays.get(selected) && (
              <p className="text-sm text-holiday-ink">{holidays.get(selected)?.join(" · ")}</p>
            )}
            {notes.get(selected)?.map((note) => (
              <p key={note} className="text-sm text-muted">
                <NoteLine note={note} size={14} />
              </p>
            ))}
            <div className="-mx-4">
              <TasksAccordion from={selected} to={selected} />
            </div>
            {dayEntries.length === 0 && <p className="text-sm text-muted">{t("views.nothing")}</p>}
            {dayEntries.map((e) => (
              <EntryBlock
                key={e.key}
                entry={e}
                type={types.find((ty) => ty.id === e.entryTypeId)}
                persons={persons.data ?? []}
                label={e.time.allDay ? t("entries.allDay") : e.time.startTime}
                className="py-1 text-sm"
              />
            ))}
          </section>
        </div>
      </SidePanelLayout>
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
      <SidePanelLayout panel={<TodayPanel />}>
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
            />
          ) : (
            <YearGrid
              year={year}
              entries={entries}
              types={types}
              today={today}
              locale={locale}
              holidays={holidays}
            />
          )}
        </div>
      </SidePanelLayout>
    </>
  );
}
