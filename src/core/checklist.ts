import { addDays, daysBetween, type PlainDate } from "./plain-date";
import { occurrenceDates, type Repetition } from "./repetition";
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

/**
 * The start of the round a repeating Checklist should be on today: the latest Repetition date
 * from its current start up to today, when that is later than the current start. Null when the
 * current round still runs (or the Checklist doesn't repeat).
 */
export function dueRoundStart(
  checklist: ChecklistPeriod & { repetition: Repetition | null },
  today: PlainDate,
): PlainDate | null {
  if (!checklist.repetition || !checklist.startDate || today <= checklist.startDate) return null;
  const starts = occurrenceDates(
    checklist.startDate,
    checklist.repetition,
    addDays(checklist.startDate, 1),
    today,
  );
  return starts.length > 0 ? starts[starts.length - 1] : null;
}

/**
 * A new round's period and how far its Tasks' dates move: everything shifts by the days from
 * the old start to the new one. A Checklist without a period doesn't move.
 */
export function shiftRound(checklist: ChecklistPeriod, newStart: PlainDate | null) {
  if (!checklist.startDate || !checklist.endDate || !newStart) {
    return { startDate: checklist.startDate, endDate: checklist.endDate, days: 0 };
  }
  const days = daysBetween(checklist.startDate, newStart);
  return { startDate: newStart, endDate: addDays(checklist.endDate, days), days };
}

/** The name a closed round keeps with its result: the year it started, or was closed. */
export function roundLabel(checklist: ChecklistPeriod, closedOn: PlainDate) {
  return (checklist.startDate ?? closedOn).slice(0, 4);
}
