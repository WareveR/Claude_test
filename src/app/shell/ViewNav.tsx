import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, NavLink } from "react-router";
import type { PlainDate } from "../../core/plain-date";
import { FilterButton } from "../filter/FilterButton";
import { paths } from "../paths";

const VIEWS = ["day", "week", "month", "year", "tasks"] as const;

/** Switches between views and moves through dates, keeping the date in the address. */
export function ViewNav({
  date,
  title,
  previous,
  next,
  newPath,
}: {
  date: PlainDate;
  title?: string;
  previous?: string;
  next?: string;
  /** Where "+" leads; a new Entry on the view's date unless given. */
  newPath?: string;
}) {
  const { t } = useTranslation();
  return (
    <nav className="flex flex-wrap items-center gap-2 px-4 py-2">
      <div className="flex rounded-md border border-stone-300 dark:border-stone-700">
        {VIEWS.map((view) => (
          <NavLink
            key={view}
            to={view === "tasks" ? paths.tasks() : paths[view](date)}
            className={({ isActive }) =>
              `px-3 py-1 text-sm ${isActive ? "bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900" : ""}`
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
          <Link to={paths.today()} className="rounded-md px-2 py-1 text-sm">
            {t("views.today")}
          </Link>
          <Link to={next} aria-label={t("views.next")} className="rounded-md p-1">
            <ChevronRight aria-hidden size={20} strokeWidth={1.75} />
          </Link>
        </div>
      )}
      {title && <h1 className="text-lg font-semibold first-letter:uppercase">{title}</h1>}
      <div className="ml-auto">
        <FilterButton />
      </div>
      <Link
        to={newPath ?? `/entries/new?date=${date}`}
        aria-label={newPath ? t("tasks.new") : t("entries.new")}
        className="rounded-full bg-accent p-2 text-accent-ink"
      >
        <Plus aria-hidden size={20} strokeWidth={2} />
      </Link>
    </nav>
  );
}
