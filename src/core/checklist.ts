import type { PlainDate } from "./plain-date";
import { isOverdue, type FamilyNow, type TaskTiming } from "./task";

/** What the calendar core needs of a Checklist: its optional period. */
export type ChecklistPeriod = { startDate: PlainDate | null; endDate: PlainDate | null };

/** "3 of 8 done". */
export function checklistProgress(tasks: { doneAt: string | null }[]) {
  return { done: tasks.filter((t) => t.doneAt).length, total: tasks.length };
}

/** A Checklist isn't pending before its start: its Tasks aren't due or overdue yet. */
export function isPending(checklist: ChecklistPeriod, now: FamilyNow) {
  return !checklist.startDate || checklist.startDate <= now.today;
}

/**
 * A Checklist Task as the calendar core sees it: undated Tasks take the Checklist's end as their
 * due date, so at its end every undone Task is overdue.
 */
export function checklistTaskTiming<T extends TaskTiming>(task: T, checklist: ChecklistPeriod): T {
  return task.dueDate || !checklist.endDate ? task : { ...task, dueDate: checklist.endDate };
}

/** A Checklist Task is overdue only once its Checklist is pending. */
export function isChecklistTaskOverdue(
  task: TaskTiming,
  checklist: ChecklistPeriod,
  now: FamilyNow,
) {
  return isPending(checklist, now) && isOverdue(checklistTaskTiming(task, checklist), now);
}

/** Which Tasks view group a Checklist's row sits in: the group of its end, or No date. */
export function checklistGroup(
  checklist: ChecklistPeriod,
  tasks: TaskTiming[],
  now: FamilyNow,
): "overdue" | "today" | "upcoming" | "noDate" | "done" {
  if (tasks.length > 0 && tasks.every((t) => t.doneAt)) return "done";
  if (!checklist.endDate) return "noDate";
  if (tasks.some((t) => isChecklistTaskOverdue(t, checklist, now))) return "overdue";
  if (checklist.endDate === now.today) return "today";
  return checklist.endDate < now.today ? "done" : "upcoming";
}
