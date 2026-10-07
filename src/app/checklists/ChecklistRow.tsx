import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { checklistProgress, isChecklistTaskOverdue } from "../../core/checklist";
import { formatLocale } from "../../core/languages";
import { formatPlainDate } from "../../core/plain-date";
import type { FamilyNow } from "../../core/task";
import { useSignedIn } from "../family";
import type { Person } from "../persons/model";
import type { Task } from "../tasks/model";
import { TaskRow } from "../tasks/TaskRow";
import type { Checklist } from "./model";
import { BUTTON } from "../ui/button";

/** A Checklist as one expandable row with its progress; its Tasks inside. */
export function ChecklistRow({
  checklist,
  tasks,
  persons,
  now,
}: {
  checklist: Checklist;
  tasks: Task[];
  persons: Person[];
  now: FamilyNow;
}) {
  const { t } = useTranslation();
  const locale = formatLocale(useSignedIn().language);
  const progress = checklistProgress(tasks);
  const short = { day: "numeric", month: "short" } as const;
  const period =
    checklist.startDate && checklist.endDate
      ? `${formatPlainDate(checklist.startDate, locale, short)} – ${formatPlainDate(checklist.endDate, locale, short)}`
      : null;
  return (
    <li className="py-2" data-testid="checklist">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2">
          <ChevronDown
            aria-hidden
            size={16}
            className="-rotate-90 transition-transform group-open:rotate-0"
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-medium">{checklist.name}</span>
            {period && <span className="text-xs text-muted">{period}</span>}
          </span>
          <span className="text-sm text-muted">
            {t("checklists.progress", { done: progress.done, total: progress.total })}
          </span>
        </summary>
        <ul className="ml-6 divide-y divide-line">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              overdue={isChecklistTaskOverdue(task, checklist, now)}
              persons={persons}
            />
          ))}
        </ul>
        <div className="ml-6 flex gap-4 py-1 text-sm">
          <Link className={BUTTON} to={`/tasks/new?checklist=${checklist.id}`}>
            {t("checklists.addTask")}
          </Link>
          <Link className={BUTTON} to={`/checklists/${checklist.id}`}>
            {t("checklists.edit")}
          </Link>
        </div>
      </details>
    </li>
  );
}
