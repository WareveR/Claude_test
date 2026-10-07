import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, useLocation } from "react-router";
import { todayIn } from "../../core/plain-date";
import { useSignedIn } from "../family";
import type { PlainDate } from "../../core/plain-date";
import { FilterButton } from "../filter/FilterButton";
import { setDisplayMode } from "../display/mode";
import { paths } from "../paths";

const VIEWS = ["day", "week", "month", "year", "tasks", "display"] as const;

/** Switches between views and moves through dates, keeping the date in the address. */
export function ViewNav({
  date,
  title,
  previous,
  next,
  newPath,
  extra,
}: {
  date: PlainDate;
  title?: string;
  previous?: string;
  next?: string;
  /** Where "+" leads; a new Entry on the view's date unless given, and no "+" when null. */
  newPath?: string | null;
  /** Shown beside the title. */
  extra?: ReactNode;
}) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const today = todayIn(useSignedIn().family.timeZone);
  // "Today" stays in the view it is pressed in: this week, this month, this year.
  const view = pathname.split("/")[1];
  const todayPath =
    view === "week" || view === "month" || view === "year" ? paths[view](today) : paths.day(today);
  // Sticky, so a long stacked page (a phone, a big zoom) can always move on or switch view;
  // above the grid's now line, so the Person Filter panel opens over it.
  return (
    <nav className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-line bg-bg px-4 py-2">
      <div className="flex rounded-md border border-line">
        {VIEWS.map((view) => (
          <NavLink
            key={view}
            to={
              view === "tasks"
                ? paths.tasks()
                : view === "display"
                  ? paths.display()
                  : paths[view](date)
            }
            // The board is only reachable with Display Mode on; turn it on before navigating.
            onClick={view === "display" ? () => setDisplayMode(true) : undefined}
            className={({ isActive }) =>
              `px-3 py-1 text-sm ${isActive ? "bg-accent text-accent-ink" : ""}`
            }
          >
            {t(`views.${view}`)}
          </NavLink>
        ))}
      </div>
      {previous && next && (
        <div className="flex items-center gap-1">
          <Link to={previous} aria-label={t("views.previous")} className="rounded-md p-1">
            <ChevronLeft aria-hidden size={20} strokeWidth={1.75} />
          </Link>
          <Link to={todayPath} className="rounded-md px-2 py-1 text-sm">
            {t("views.today")}
          </Link>
          <Link to={next} aria-label={t("views.next")} className="rounded-md p-1">
            <ChevronRight aria-hidden size={20} strokeWidth={1.75} />
          </Link>
        </div>
      )}
      {title && <h1 className="text-lg font-semibold first-letter:uppercase">{title}</h1>}
      {extra}
      <div className="ml-auto">
        <FilterButton />
      </div>
      {newPath !== null && (
        <Link
          to={newPath ?? `/entries/new?date=${date}`}
          aria-label={t("entries.new")}
          className="rounded-full bg-accent p-2 text-accent-ink"
        >
          <Plus aria-hidden size={20} strokeWidth={2} />
        </Link>
      )}
    </nav>
  );
}
