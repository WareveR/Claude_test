import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, NavLink } from "react-router";
import type { PlainDate } from "../../core/plain-date";
import { paths } from "../paths";

const VIEWS = ["day", "week", "month", "year", "tasks"] as const;

/** Switches between views and moves through dates, keeping the date in the address. */
export function ViewNav({
  date,
  title,
  previous,
  next,
}: {
  date: PlainDate;
  title?: string;
  previous?: string;
  next?: string;
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
    </nav>
  );
}
