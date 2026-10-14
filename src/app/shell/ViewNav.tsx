import {
  ChevronLeft,
  ChevronRight,
  ListChecks,
  ListOrdered,
  Plus,
  Search,
  ShoppingCart,
} from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { todayIn } from "../../core/plain-date";
import { useSignedIn } from "../family";
import type { PlainDate } from "../../core/plain-date";
import { FilterButton } from "../filter/FilterButton";
import { paths } from "../paths";
import { useSwipe } from "../ui/useSwipe";

const VIEWS = ["day", "week", "month", "year", "agenda", "tasks", "shopping"] as const;

/** Switches between views and moves through dates, keeping the date in the address. */
export function ViewNav({
  date,
  title,
  previous,
  next,
  newPath,
  extra,
  compact = false,
}: {
  date: PlainDate;
  title?: string;
  previous?: string;
  next?: string;
  /** Where "+" leads; a new Entry on the view's date unless given, and no "+" when null. */
  newPath?: string | null;
  /** Shown beside the title. */
  extra?: ReactNode;
  /**
   * Search, Filter and "+" sit elsewhere (the day view's own header row), and the title is only
   * for screen readers, as that row shows the date.
   */
  compact?: boolean;
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
            to={view === "tasks" || view === "shopping" ? paths[view]() : paths[view](date)}
            // Where space is short (a phone, or one on its side) the names shrink to a letter or an
            // icon; the full name stays the link's name.
            aria-label={t(`views.${view}`)}
            data-help={`view.${view}`}
            className={({ isActive }) =>
              `flex items-center px-3 py-1 text-sm max-md:px-2.5 short:px-2.5 ${isActive ? "bg-accent text-accent-ink" : ""}`
            }
          >
            <span aria-hidden className="max-md:hidden short:hidden">
              {t(`views.${view}`)}
            </span>
            <span aria-hidden className="hidden max-md:inline short:inline">
              {view === "tasks" ? (
                <ListChecks size={18} strokeWidth={1.75} />
              ) : view === "shopping" ? (
                <ShoppingCart size={18} strokeWidth={1.75} />
              ) : view === "agenda" ? (
                <ListOrdered size={18} strokeWidth={1.75} />
              ) : (
                t(`views.short.${view}`)
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
          <Link to={todayPath} data-help="today" className="rounded-md px-2 py-1 text-sm">
            {t("views.today")}
          </Link>
          <Link to={next} aria-label={t("views.next")} data-help="next" className="rounded-md p-1">
            <ChevronRight aria-hidden size={20} strokeWidth={1.75} />
          </Link>
        </div>
      )}
      {title && (
        <h1
          className={
            compact
              ? "sr-only"
              : "text-lg font-semibold first-letter:uppercase short:truncate short:text-base"
          }
        >
          {title}
        </h1>
      )}
      {extra}
      {!compact && <ViewActions date={date} newPath={newPath} className="ml-auto" />}
    </nav>
  );
}

/** Search, the Person Filter and "+" (a new Entry on the date, unless given; none when null). */
export function ViewActions({
  date,
  newPath,
  className = "",
}: {
  date: PlainDate;
  newPath?: string | null;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Link
        to={paths.search()}
        aria-label={t("search.title")}
        data-help="search"
        className="rounded-md p-1.5 hover:bg-line/60"
      >
        <Search aria-hidden size={20} strokeWidth={1.75} />
      </Link>
      <FilterButton />
      {newPath !== null && (
        <Link
          to={newPath ?? `/entries/new?date=${date}`}
          aria-label={t("newItem.title")}
          data-help="newEntry"
          className="ml-1 rounded-full bg-accent p-2 text-accent-ink short:p-1.5"
        >
          <Plus aria-hidden size={20} strokeWidth={2} />
        </Link>
      )}
    </div>
  );
}
