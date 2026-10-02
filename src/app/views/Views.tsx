import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router";
import { formatLocale } from "../../core/languages";
import {
  addDays,
  addMonths,
  formatPlainDate,
  isPlainDate,
  startOfWeek,
  todayIn,
  type PlainDate,
} from "../../core/plain-date";
import { useSignedIn } from "../family";
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
  const locale = useLocale();
  const today = useToday();
  if (!isPlainDate(date)) return <Navigate to={paths.week(today)} replace />;
  if (startOfWeek(date) !== date) return <Navigate to={paths.week(date)} replace />;
  const short = { day: "numeric", month: "short" } as const;
  const title = `${formatPlainDate(date, locale, short)} – ${formatPlainDate(addDays(date, 6), locale, short)}`;
  return (
    <ViewNav
      date={date}
      title={title}
      previous={paths.week(addDays(date, -7))}
      next={paths.week(addDays(date, 7))}
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
