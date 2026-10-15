import { ChevronLeft, ChevronRight, ListChecks, ListOrdered, ShoppingCart } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { todayIn } from "../../core/plain-date";
import { useSignedIn } from "../family";
import type { PlainDate } from "../../core/plain-date";
import { FilterButton } from "../filter/FilterButton";
import { LayersButton } from "../calendar/LayersButton";
import { usePeriodTasksShown } from "../calendar/compact";
import { WeekCompactButton } from "../calendar/WeekCompactButton";
import { TasksButton } from "../tasks/TasksButton";
import { MonthMotif, useMonthOnScreen } from "../month-theme";
import { paths } from "../paths";
import { focusDay } from "../../core/periods";
import { focusedDay, setFocusedDay } from "../views/focus";
import { useSwipe } from "../ui/useSwipe";

const VIEWS = ["day", "week", "month", "year", "agenda", "tasks", "shopping"] as const;

/** Switches between views and moves through dates, keeping the date in the address. */
export function ViewNav({
  date,
  title,
  previous,
  next,
  extra,
  tasks,
  shortTitle,
}: {
  date: PlainDate;
  title?: string;
  previous?: string;
  next?: string;
  /** Shown beside the title. */
  extra?: ReactNode;
  /** The period whose Tasks the view can show in place of its calendar. */
  tasks?: { from: PlainDate; to: PlainDate };
  /** The title abbreviated, for a phone. */
  shortTitle?: string;
}) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // A sideways swipe does what the arrows do.
  useSwipe(previous ? () => navigate(previous) : null, next ? () => navigate(next) : null);
  const today = todayIn(useSignedIn().family.timeZone);
  // "Today" stays in the view it is pressed in: this week, this month, this year.
  const view = pathname.split("/")[1];
  const todayPath =
    view === "week" || view === "month" || view === "year" || view === "agenda"
      ? paths[view](today)
      : paths.day(today);
  // Another view opens on the day in focus, kept from view to view while this one shows it.
  const period = (["day", "week", "month", "year", "agenda"] as const).find((p) => p === view);
  const target = period ? focusDay(period, date, focusedDay(), today) : (focusedDay() ?? date);
  // Kept as the day in focus, so stepping on with the arrows carries it from period to period.
  if (period) setFocusedDay(target);
  const month = useMonthOnScreen();
  // Sticky, so a long stacked page (a phone, a big zoom) can always move on or switch view;
  // above the grid's now line, so the Person Filter panel opens over it.
  return (
    <nav
      data-view-nav
      className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-line bg-bg px-4 py-2 short:flex-nowrap short:py-1"
    >
      <div className="flex rounded-md border border-line">
        {VIEWS.map((view) => (
          <NavLink
            key={view}
            to={view === "tasks" || view === "shopping" ? paths[view]() : paths[view](target)}
            // Where space is short (a phone, or one on its side) the names shrink to a letter or an
            // icon; the full name stays the link's name.
            aria-label={t(`views.${view}`)}
            data-help={`view.${view}`}
            className={({ isActive }) =>
              `flex items-center px-2.5 py-1 text-sm ${isActive ? "bg-accent text-accent-ink" : ""}`
            }
          >
            {/* Icons and letters only; the full name stays the link's name. */}
            <span aria-hidden>
              {view === "tasks" ? (
                <ListChecks size={18} strokeWidth={1.75} />
              ) : view === "shopping" ? (
                <ShoppingCart size={18} strokeWidth={1.75} />
              ) : view === "agenda" ? (
                <ListOrdered size={18} strokeWidth={1.75} />
              ) : (
                <span className="font-semibold">{t(`views.short.${view}`)}</span>
              )}
            </span>
          </NavLink>
        ))}
      </div>
      {previous && next && (
        <div className="flex items-center gap-1">
          <Link
            to={previous}
            aria-label={t("views.previous")}
            data-help="previous"
            className="rounded-md p-1"
          >
            <ChevronLeft aria-hidden size={20} strokeWidth={1.75} />
          </Link>
          <Link
            to={todayPath}
            onClick={() => setFocusedDay(today)}
            data-help="today"
            className="rounded-md px-2 py-1 text-sm"
          >
            {t("views.today")}
          </Link>
          <Link to={next} aria-label={t("views.next")} data-help="next" className="rounded-md p-1">
            <ChevronRight aria-hidden size={20} strokeWidth={1.75} />
          </Link>
        </div>
      )}
      {title && (
        <h1
          data-testid="view-title"
          aria-label={shortTitle ? title : undefined}
          className="min-w-0 truncate text-lg font-semibold first-letter:uppercase short:text-base"
        >
          {/* Abbreviated where the bar is short of room, so all its buttons fit. */}
          <span className={shortTitle ? "max-md:hidden" : ""}>{title}</span>
          {shortTitle && <span className="md:hidden">{shortTitle}</span>}
        </h1>
      )}
      {extra}
      <ViewActions tasks={tasks} className="ml-auto" />
      {month !== null && (
        <MonthMotif month={month} opacity={0.08} className="absolute inset-0 text-header" />
      )}
    </nav>
  );
}

/**
 * The view's one row of options: what the grid shows, and the period's Tasks instead of the
 * calendar, then the Person Filter. Search and "+" are on the header.
 */
export function ViewActions({
  tasks,
  className = "",
}: {
  tasks?: { from: PlainDate; to: PlainDate };
  className?: string;
}) {
  const view = useLocation().pathname.split("/")[1];
  const tasksShown = usePeriodTasksShown();
  const grid = !(tasks && tasksShown);
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {/* The week's weather and notes can make way for the hours. */}
      {view === "week" && grid && <WeekCompactButton />}
      {/* The day and week grids can show only their All-day or only their Timed Entries. */}
      {(view === "day" || view === "week") && grid && <LayersButton />}
      {tasks && <TasksButton from={tasks.from} to={tasks.to} />}
      <FilterButton />
    </div>
  );
}
