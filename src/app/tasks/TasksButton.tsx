import { ClipboardList } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PlainDate } from "../../core/plain-date";
import { setPeriodTasksShown, usePeriodTasksShown } from "../calendar/compact";
import { usePeriodTasks } from "./TasksAccordion";

/**
 * Switches the view between its calendar and the period's Tasks; while the calendar shows, it says
 * how many Tasks the period has.
 */
export function TasksButton({ from, to }: { from: PlainDate; to: PlainDate }) {
  const { t } = useTranslation();
  const shown = usePeriodTasksShown();
  const count = usePeriodTasks(from, to).tasks.length;
  return (
    <button
      type="button"
      data-testid="period-tasks"
      aria-pressed={shown}
      aria-label={shown ? t("views.showCalendar") : t("views.showTasks", { count })}
      title={shown ? t("views.showCalendar") : t("views.showTasks", { count })}
      onClick={() => setPeriodTasksShown(!shown)}
      className={`relative rounded-md p-1.5 ${shown ? "bg-accent text-accent-ink" : "hover:bg-line/60"}`}
    >
      <ClipboardList aria-hidden size={20} strokeWidth={1.75} />
      {!shown && count > 0 && (
        <span
          aria-hidden
          data-testid="period-tasks-count"
          className="absolute -top-1 -right-1 min-w-4 rounded-full bg-accent px-1 text-[10px] leading-4 font-semibold text-accent-ink tabular-nums"
        >
          {count}
        </span>
      )}
    </button>
  );
}
