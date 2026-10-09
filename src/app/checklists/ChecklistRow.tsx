import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { checklistProgress, isChecklistTaskOverdue } from "../../core/checklist";
import type { FamilyNow } from "../../core/task";
import type { Task } from "../tasks/model";
import type { Checklist } from "./model";
import { usePeriodText } from "./period";
import { previewClick, usePreview } from "../preview/Preview";

/** A Checklist as one row with its progress; selecting it opens the Checklist with its items. */
export function ChecklistRow({
  checklist,
  tasks,
  now,
  dropTarget = false,
}: {
  checklist: Checklist;
  tasks: Task[];
  now: FamilyNow;
  /** A Task is being dragged over it. */
  dropTarget?: boolean;
}) {
  const { t } = useTranslation();
  const preview = usePreview();
  const progress = checklistProgress(tasks);
  const period = usePeriodText(checklist);
  const overdue = tasks.some((task) => isChecklistTaskOverdue(task, checklist, now));
  return (
    <li
      data-testid="checklist"
      data-drop-checklist={checklist.id}
      className={`rounded-md transition-colors ${dropTarget ? "bg-accent/15 ring-2 ring-accent" : ""}`}
    >
      <Link
        to={`/checklists/${checklist.id}`}
        className="flex items-center gap-2 py-2"
        onClick={previewClick(preview, { kind: "checklist", id: checklist.id })}
      >
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
