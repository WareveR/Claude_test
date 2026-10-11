import { ChevronsDownUp, ChevronsUpDown, ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import { setTasksHidden, setWeekCompact, useTasksHidden, useWeekCompact } from "./compact";

/**
 * The week grid's corner: one switch for the weather and the day notes, and under it one for the
 * week's Tasks, which says how many it is hiding.
 */
export function GridCorner({ tasks }: { tasks: number }) {
  const { t } = useTranslation();
  const compact = useWeekCompact();
  const tasksHidden = useTasksHidden();
  const button = "rounded-md p-1 text-muted hover:bg-line/60";
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        aria-label={compact ? t("views.showWeather") : t("views.hideWeather")}
        aria-pressed={compact}
        data-testid="week-compact"
        onClick={() => setWeekCompact(!compact)}
        className={button}
      >
        {compact ? (
          <ChevronsUpDown aria-hidden size={18} strokeWidth={1.75} />
        ) : (
          <ChevronsDownUp aria-hidden size={18} strokeWidth={1.75} />
        )}
      </button>
      <button
        type="button"
        aria-label={tasksHidden ? t("views.showTasks", { count: tasks }) : t("views.hideTasks")}
        aria-pressed={!tasksHidden}
        data-testid="week-tasks"
        onClick={() => setTasksHidden(!tasksHidden)}
        className={`relative ${button} ${tasksHidden ? "" : "bg-accent text-accent-ink hover:bg-accent"}`}
      >
        <ListChecks aria-hidden size={18} strokeWidth={1.75} />
        {tasksHidden && tasks > 0 && (
          <span
            aria-hidden
            data-testid="week-tasks-count"
            className="absolute -top-1 -right-1.5 min-w-4 rounded-full bg-accent px-1 text-[10px] leading-4 font-semibold text-accent-ink tabular-nums"
          >
            {tasks}
          </span>
        )}
      </button>
    </div>
  );
}
