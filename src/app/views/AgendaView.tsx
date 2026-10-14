import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router";
import { formatLocale } from "../../core/languages";
import { addDays, formatPlainDate, isPlainDate, todayIn, weekday } from "../../core/plain-date";
import type { PlainDate } from "../../core/plain-date";
import { isOverdue } from "../../core/task";
import { EntryBlock } from "../calendar/EntryBlock";
import { entriesOn } from "../calendar/MonthGrid";
import { useSignedIn } from "../family";
import { useHolidays } from "../holidays/model";
import { paths } from "../paths";
import { usePeriodTasks } from "../tasks/TasksAccordion";
import { TaskRow } from "../tasks/TaskRow";
import { ViewNav } from "../shell/ViewNav";
import { useCalendar } from "./Views";
import { periodLabel } from "../../core/period-label";
import { PeriodCurtain } from "./PeriodCurtain";

/** How many days the agenda lists at a time. */
export const AGENDA_DAYS = 30;

export function AgendaView() {
  const { date = "" } = useParams();
  const today = todayIn(useSignedIn().family.timeZone);
  if (!isPlainDate(date)) return <Navigate to={paths.agenda(today)} replace />;
  return <Agenda from={date} />;
}

/**
 * Every Entry and dated Task from a day on, in date and time order, a heading per day that has
 * something; days with nothing are left out. Overdue Tasks lead when the window includes today.
 */
function Agenda({ from }: { from: PlainDate }) {
  const { t } = useTranslation();
  const locale = formatLocale(useSignedIn().language);
  const to = addDays(from, AGENDA_DAYS - 1);
  const { entries, types } = useCalendar(from, to);
  const holidays = useHolidays(from, to);
  const { tasks, now, persons } = usePeriodTasks(from, to);
  const overdue = tasks.filter((task) => isOverdue(task, now) && task.dueDate! < from);
  const days: PlainDate[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  const title = `${formatPlainDate(from, locale, { day: "numeric", month: "short" })} – ${formatPlainDate(to, locale, { day: "numeric", month: "short", year: "numeric" })}`;
  const sections = days
    .map((day) => {
      const dayTasks = tasks.filter((task) => task.dueDate === day);
      const dayEntries = entriesOn(entries, day);
      // All-day Entries and Tasks without a time first, then by time.
      const items = [
        ...dayEntries.map((e) => ({
          at: e.time.allDay ? "" : e.time.startTime,
          key: `e-${e.key}`,
          node: (
            <li key={`e-${e.key}`}>
              <EntryBlock
                entry={e}
                type={types.find((ty) => ty.id === e.entryTypeId)}
                persons={persons}
                label={e.time.allDay ? t("entries.allDay") : e.time.startTime}
                className="py-1 text-sm"
              />
            </li>
          ),
        })),
        ...dayTasks.map((task) => ({
          at: task.dueTime ?? "",
          key: `t-${task.id}`,
          node: (
            <TaskRow
              key={`t-${task.id}`}
              task={task}
              overdue={isOverdue(task, now)}
              persons={persons}
            />
          ),
        })),
      ].sort((a, b) => a.at.localeCompare(b.at));
      return { day, items, names: holidays.get(day) };
    })
    .filter((s) => s.items.length > 0 || s.names);
  return (
    <>
      <ViewNav
        date={from}
        title={title}
        previous={paths.agenda(addDays(from, -AGENDA_DAYS))}
        next={paths.agenda(addDays(from, AGENDA_DAYS))}
      />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-3">
        {overdue.length > 0 && (
          <section
            aria-label={t("tasks.groups.overdue")}
            className="rounded-xl border-2 border-overdue/60 bg-overdue/5 px-3 pt-2 pb-1"
          >
            <h2 className="text-sm font-semibold tracking-wide text-overdue uppercase">
              {t("tasks.groups.overdue")} · {overdue.length}
            </h2>
            <ul className="divide-y divide-overdue/20">
              {overdue.map((task) => (
                <TaskRow key={task.id} task={task} overdue persons={persons} />
              ))}
            </ul>
          </section>
        )}
        {sections.length === 0 && overdue.length === 0 && (
          <p className="text-muted">{t("views.agendaEmpty")}</p>
        )}
        {sections.map(({ day, items, names }) => (
          <section
            key={day}
            aria-label={formatPlainDate(day, locale, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
            data-testid={`agenda-day-${day}`}
            className="flex flex-col gap-1"
          >
            <h2
              className={`flex items-baseline gap-2 border-b border-line pb-1 text-sm font-semibold first-letter:uppercase ${day === now.today ? "text-accent" : weekday(day) >= 5 ? "text-weekend-ink" : ""}`}
            >
              <span className="first-letter:uppercase">
                {formatPlainDate(day, locale, { weekday: "long", day: "numeric", month: "long" })}
              </span>
              {day === now.today && <span className="text-xs">· {t("views.today")}</span>}
            </h2>
            {names && <p className="text-sm text-holiday-ink">{names.join(" · ")}</p>}
            <ul className="flex flex-col gap-1">{items.map((item) => item.node)}</ul>
          </section>
        ))}
      </main>
      <PeriodCurtain
        period={`agenda:${from}`}
        lines={periodLabel("range", from, to, locale)}
        from={from}
        to={to}
      />
    </>
  );
}
