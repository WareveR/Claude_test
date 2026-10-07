import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { checklistProgress, isChecklistTaskOverdue } from "../../core/checklist";
import type { FamilyNow } from "../../core/task";
import type { Task } from "../tasks/model";
import type { Checklist } from "./model";
import { usePeriodText } from "./period";

/** A Checklist as one row with its progress; selecting it opens the Checklist with its items. */
export function ChecklistRow({
  checklist,
  tasks,
  now,
}: {
  checklist: Checklist;
  tasks: Task[];
  now: FamilyNow;
}) {
  const { t } = useTranslation();
  const progress = checklistProgress(tasks);
  const period = usePeriodText(checklist);
  const overdue = tasks.some((task) => isChecklistTaskOverdue(task, checklist, now));
  return (
    <li data-testid="checklist">
      <Link to={`/checklists/${checklist.id}`} className="flex items-center gap-2 py-2">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{checklist.name}</span>
          {period && (
            <span className={`text-xs ${overdue ? "font-medium text-overdue" : "text-muted"}`}>
              {period}
            </span>
          )}
        </span>
        <span className="text-sm text-muted">
          {t("checklists.progress", { done: progress.done, total: progress.total })}
        </span>
        <ChevronRight aria-hidden size={16} className="text-muted" />
      </Link>
    </li>
  );
}
