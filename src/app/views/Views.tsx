import { useTranslation } from "react-i18next";
import { Navigate, useParams, useSearchParams } from "react-router";
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
import { YearGrid } from "../calendar/YearGrid";
import { CHECKLIST_BAR_TYPE, useChecklistBars } from "../checklists/bars";
import { useOccurrences } from "../entries/model";
import { usePersonFilter } from "../filter/model";
import { matchesFilter } from "../../core/person-filter";
import { useEntryTypes } from "../entry-types/model";
import { useSignedIn } from "../family";
import { usePersons } from "../persons/model";
import { useNow } from "../shell/useNow";
import { paths } from "../paths";
import { ViewNav } from "../shell/ViewNav";
import { TasksAccordion } from "../tasks/TasksAccordion";

function useToday(): PlainDate {
  return todayIn(useSignedIn().family.timeZone);
}

/** A window's Occurrences and Checklist period bars, with the Entry Types to draw them. */
function useCalendar(from: PlainDate, to: PlainDate) {
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
  if (!isPlainDate(date)) return <Navigate to={paths.day(today)} replace />;
  const title = formatPlainDate(date, locale, { weekday: "long", day: "numeric", month: "long" });
  return (
    <>
      <ViewNav
        date={date}
        title={title}
        previous={paths.day(addDays(date, -1))}
        next={paths.day(addDays(date, 1))}
      />
      <TasksAccordion from={date} to={date} />
      <CalendarGrid days={[date]} />
    </>
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
      <TasksAccordion from={monday} to={days[6]} />
      <CalendarGrid days={days} />
    </>
  );
}

/** The time grid for some days, with the Entries, Entry Types and Persons it needs. */
function CalendarGrid({ days }: { days: PlainDate[] }) {
  const { family } = useSignedIn();
  const locale = useLocale();
  const now = useNow(60_000);
  const { entries, types } = useCalendar(days[0], days[days.length - 1]);
  const persons = usePersons();
  return (
    <TimeGrid
      days={days}
      entries={entries}
      types={types}
      persons={persons.data ?? []}
      today={todayIn(family.timeZone, now)}
      nowMinutes={minutesNowIn(family.timeZone, now)}
      locale={locale}
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
      <MonthGrid
        month={first}
        entries={entries}
        types={types}
        today={today}
        selected={selected}
        locale={locale}
        dayLink={(day) => `${paths.month(day)}?day=${day}`}
      />
      <section className="flex flex-col gap-1 p-4" data-testid="picked-day">
        <h2 className="font-semibold first-letter:uppercase">
          {formatPlainDate(selected, locale, { weekday: "long", day: "numeric", month: "long" })}
        </h2>
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
  const date = `${year}-01-01`;
  const { entries, types } = useCalendar(date, `${year}-12-31`);
  return (
    <>
      <ViewNav
        date={date}
        title={String(year)}
        previous={paths.year(addMonths(date, -12))}
        next={paths.year(addMonths(date, 12))}
      />
      <YearGrid year={year} entries={entries} types={types} today={today} locale={locale} />
    </>
  );
}
