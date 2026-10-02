import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PlainDate } from "../../core/plain-date";
import { familyNow, isOverdue, periodTasks } from "../../core/task";
import { useSignedIn } from "../family";
import { usePersons } from "../persons/model";
import { useNow } from "../shell/useNow";
import { useTasks } from "./model";
import { TaskRow } from "./TaskRow";

/**
 * "Tasks 7 · 2 overdue": one collapsible line with the period's dated Tasks and, when the period
 * includes today, every overdue Task. Dated Tasks are never drawn inside the time grid.
 */
export function TasksAccordion({ from, to }: { from: PlainDate; to: PlainDate }) {
  const { t } = useTranslation();
  const { family } = useSignedIn();
  const now = familyNow(family.timeZone, useNow(60_000));
  const tasks = periodTasks(useTasks().data ?? [], from, to, now);
  const persons = usePersons().data ?? [];
  if (tasks.length === 0) return null;
  const overdue = tasks.filter((task) => isOverdue(task, now)).length;
  return (
    <details className="group mx-4 rounded-md border border-line" data-testid="tasks-accordion">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium">
        <ChevronDown
          aria-hidden
          size={16}
          className="-rotate-90 transition-transform group-open:rotate-0"
        />
        {t("tasks.accordion", { count: tasks.length })}
        {overdue > 0 && (
          <span className="text-overdue">· {t("tasks.overdueCount", { count: overdue })}</span>
        )}
      </summary>
      <ul className="divide-y divide-line px-3">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} overdue={isOverdue(task, now)} persons={persons} />
        ))}
      </ul>
    </details>
  );
}
