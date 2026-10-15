import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  ListChecks,
  ListOrdered,
  ShoppingCart,
  TreeDeciduous,
} from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { todayIn } from "../../core/plain-date";
import { useSignedIn } from "../family";
import type { PlainDate } from "../../core/plain-date";
import { FilterButton } from "../filter/FilterButton";
import { LayersButton } from "../calendar/LayersButton";
import { usePeriodTasksShown } from "../calendar/compact";
import { WeatherButton } from "../calendar/WeatherButton";
import { TasksButton } from "../tasks/TasksButton";
import { MonthMotif, useMonthOnScreen } from "../month-theme";
import { paths } from "../paths";
import { focusDay } from "../../core/periods";
import { focusedDay, setFocusedDay } from "../views/focus";
import { useCloseOutside } from "../ui/useCloseOutside";
import { useSwipe } from "../ui/useSwipe";

const VIEWS = ["day", "week", "month", "year", "agenda", "tasks", "shopping", "tree"] as const;

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
  const tasksShown = usePeriodTasksShown();
  const grid = !(tasks && tasksShown);
  // Always one line: where it does not fit, the title gets shorter and smaller, then the view's
  // options fold into a menu (all but the Filter), then so do the views. Each step is tried in
  // turn, before the bar is painted, and the bar starts over when its width or contents change.
  const navRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const filterRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState("");
  useLayoutEffect(() => {
    const nav = navRef.current;
    const filter = filterRef.current;
    if (!nav || !filter) return;
    // The Filter's own width counts too: the Persons picked show on it.
    const observer = new ResizeObserver(() => setWidth(`${nav.clientWidth}:${filter.offsetWidth}`));
    observer.observe(nav);
    observer.observe(filter);
    return () => observer.disconnect();
  }, []);
  const key = [width, view, title, shortTitle, grid].join("|");
  const [fit, setFit] = useState({ key: "", level: 0 });
  const level = fit.key === key ? fit.level : 0;
  useLayoutEffect(() => {
    const nav = navRef.current;
    const h1 = titleRef.current;
    if (!nav || level >= 3) return;
    const over =
      nav.scrollWidth > nav.clientWidth + 1 || (h1 !== null && h1.scrollWidth > h1.clientWidth + 1);
    if (over) setFit({ key, level: level + 1 });
  }, [key, level]);
  const options = [
    // The weather shows in the day, the week and the month, or makes way for the hours.
    (view === "day" || view === "week" || view === "month") && grid && (
      <WeatherButton key="weather" />
    ),
    // The day and week grids can show only their All-day or only their Timed Entries.
    (view === "day" || view === "week") && grid && <LayersButton key="layers" />,
    tasks && <TasksButton key="tasks" from={tasks.from} to={tasks.to} />,
  ].filter(Boolean);
  const linkTo = (v: (typeof VIEWS)[number]) =>
    v === "tasks" || v === "shopping" || v === "tree" ? paths[v]() : paths[v](target);
  // Sticky, so a long stacked page (a phone, a big zoom) can always move on or switch view;
  // above the grid's now line, so the Person Filter panel opens over it.
  return (
    <nav
      ref={navRef}
      data-view-nav
      data-fit={level}
      data-view={view}
      className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-bg px-4 py-2 short:py-1 max-sm:gap-1 max-sm:px-2"
    >
      {level >= 3 ? (
        <ViewsMenu view={view} linkTo={linkTo} />
      ) : (
        <div className="flex shrink-0 rounded-md border border-line">
          {VIEWS.map((v) => (
            <NavLink
              key={v}
              to={linkTo(v)}
              // Names shrink to a letter or an icon; the full name stays the link's name.
              aria-label={t(`views.${v}`)}
              data-help={`view.${v}`}
              className={({ isActive }) =>
                `flex items-center px-2.5 py-1 text-sm ${isActive ? "bg-accent text-accent-ink" : ""}`
              }
            >
              <ViewIcon view={v} />
            </NavLink>
          ))}
        </div>
      )}
      {previous && next && (
        <div className="flex shrink-0 items-center gap-1 max-sm:gap-0">
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
            className="rounded-md px-2 py-1 text-sm max-sm:px-1"
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
          ref={titleRef}
          data-testid="view-title"
          aria-label={level >= 1 && shortTitle ? title : undefined}
          className={`min-w-0 truncate font-semibold first-letter:uppercase ${level >= 3 ? "text-xs" : level >= 1 ? "text-sm" : "text-lg short:text-base"}`}
        >
          {level >= 1 && shortTitle ? shortTitle : title}
        </h1>
      )}
      {extra}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {level >= 2 && options.length > 0 ? <OptionsMenu>{options}</OptionsMenu> : options}
        <span ref={filterRef} className="flex">
          <FilterButton />
        </span>
      </div>
      {month !== null && (
        <MonthMotif month={month} opacity={0.08} className="absolute inset-0 text-header" />
      )}
    </nav>
  );
}

/** A view's letter or icon, as the bar shows it. */
function ViewIcon({ view }: { view: (typeof VIEWS)[number] }) {
  const { t } = useTranslation();
  const Icon =
    view === "tasks"
      ? ListChecks
      : view === "shopping"
        ? ShoppingCart
        : view === "tree"
          ? TreeDeciduous
          : view === "agenda"
            ? ListOrdered
            : null;
  return (
    <span aria-hidden className="flex">
      {Icon ? (
        <Icon size={18} strokeWidth={1.75} />
      ) : (
        <span className="font-semibold">{t(`views.short.${view}`)}</span>
      )}
    </span>
  );
}

/** The views folded into one button showing the view on screen, where the bar is short of room. */
function ViewsMenu({
  view,
  linkTo,
}: {
  view: string;
  linkTo: (view: (typeof VIEWS)[number]) => string;
}) {
  const { t } = useTranslation();
  const ref = useCloseOutside();
  const current = VIEWS.find((v) => v === view);
  return (
    <details ref={ref} className="relative shrink-0">
      <summary
        aria-label={t("views.menu")}
        data-testid="views-menu"
        className="flex cursor-pointer list-none items-center gap-0.5 rounded-md border border-line bg-accent px-2 py-1 text-sm text-accent-ink"
      >
        {current ? <ViewIcon view={current} /> : t("views.menu")}
        <ChevronDown aria-hidden size={14} strokeWidth={2} />
      </summary>
      <div className="absolute left-0 z-20 mt-1 flex w-48 flex-col rounded-md border border-line bg-bg p-1 text-sm shadow-lg">
        {VIEWS.map((v) => (
          <NavLink
            key={v}
            to={linkTo(v)}
            data-help={`view.${v}`}
            onClick={() => {
              if (ref.current) ref.current.open = false;
            }}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded px-2 py-1.5 ${isActive ? "bg-accent text-accent-ink" : "hover:bg-line/60"}`
            }
          >
            <span className="flex w-5 justify-center">
              <ViewIcon view={v} />
            </span>
            {t(`views.${v}`)}
          </NavLink>
        ))}
      </div>
    </details>
  );
}

/** The view's options (weather, layers, the period's Tasks) folded into one button. */
function OptionsMenu({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const ref = useCloseOutside();
  return (
    <details ref={ref} className="relative">
      <summary
        aria-label={t("views.options")}
        data-testid="view-options"
        className="flex cursor-pointer list-none items-center rounded-md p-1.5"
      >
        <Ellipsis aria-hidden size={20} strokeWidth={1.75} />
      </summary>
      <div className="absolute right-0 z-20 mt-1 flex gap-1 rounded-md border border-line bg-bg p-1 shadow-lg">
        {children}
      </div>
    </details>
  );
}
