import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router";
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
import { TimeGrid } from "../calendar/TimeGrid";
import { useEntries } from "../entries/model";
import { useEntryTypes } from "../entry-types/model";
import { useSignedIn } from "../family";
import { usePersons } from "../persons/model";
import { useNow } from "../shell/useNow";
import { paths } from "../paths";
import { ViewNav } from "../shell/ViewNav";

function useToday(): PlainDate {
  return todayIn(useSignedIn().family.timeZone);
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
    <ViewNav
      date={date}
      title={title}
      previous={paths.day(addDays(date, -1))}
      next={paths.day(addDays(date, 1))}
    />
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
      <CalendarGrid days={days} />
    </>
  );
}

/** The time grid for some days, with the Entries, Entry Types and Persons it needs. */
function CalendarGrid({ days }: { days: PlainDate[] }) {
  const { family } = useSignedIn();
  const locale = useLocale();
  const now = useNow(60_000);
  const entries = useEntries(days[0], days[days.length - 1]);
  const types = useEntryTypes();
  const persons = usePersons();
  return (
    <TimeGrid
      days={days}
      entries={entries.data ?? []}
      types={types.data ?? []}
      persons={persons.data ?? []}
      today={todayIn(family.timeZone, now)}
      nowMinutes={minutesNowIn(family.timeZone, now)}
      locale={locale}
    />
  );
}

export function MonthView() {
  const { month = "" } = useParams();
  const locale = useLocale();
  const today = useToday();
  const date = `${month}-01`;
  if (!/^\d{4}-\d{2}$/.test(month) || !isPlainDate(date))
    return <Navigate to={paths.month(today)} replace />;
  const title = formatPlainDate(date, locale, { month: "long", year: "numeric" });
  return (
    <ViewNav
      date={date}
      title={title}
      previous={paths.month(addMonths(date, -1))}
      next={paths.month(addMonths(date, 1))}
    />
  );
}

export function YearView() {
  const { year = "" } = useParams();
  const today = useToday();
  if (!/^\d{4}$/.test(year)) return <Navigate to={paths.year(today)} replace />;
  const date = `${year}-01-01`;
  return (
    <ViewNav
      date={date}
      title={year}
      previous={paths.year(addMonths(date, -12))}
      next={paths.year(addMonths(date, 12))}
    />
  );
}

export function TasksView() {
  const { t } = useTranslation();
  return <ViewNav date={useToday()} title={t("views.tasks")} />;
}
