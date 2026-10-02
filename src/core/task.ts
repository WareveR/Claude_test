import { minutesOf, type ClockTime } from "./entry-time";
import { minutesNowIn, todayIn, type PlainDate } from "./plain-date";

/** What the calendar core needs of a Task. */
export type TaskTiming = {
  dueDate: PlainDate | null;
  dueTime: ClockTime | null;
  /** When it was ticked done (an ISO instant), or null while it's still to do. */
  doneAt: string | null;
  createdAt: string;
};

/** The wall clock in the Family Time Zone: "overdue" means the same on every device. */
export type FamilyNow = { today: PlainDate; minutes: number };

export function familyNow(timeZone: string, now: Date = new Date()): FamilyNow {
  return { today: todayIn(timeZone, now), minutes: minutesNowIn(timeZone, now) };
}

/** A Task is overdue once its due day ends, or once its due time has passed. */
export function isOverdue(task: TaskTiming, now: FamilyNow): boolean {
  if (task.doneAt || !task.dueDate) return false;
  if (task.dueDate < now.today) return true;
  if (task.dueDate > now.today || !task.dueTime) return false;
  return now.minutes > minutesOf(task.dueTime);
}

export type TaskGroups<T> = {
  overdue: T[];
  today: T[];
  upcoming: T[];
  noDate: T[];
  /** Most recently done first. */
  done: T[];
};

/** Orders by due date, then due time, a Task without a time coming first in its day. */
function byDue(a: TaskTiming, b: TaskTiming) {
  return (
    (a.dueDate ?? "").localeCompare(b.dueDate ?? "") ||
    (a.dueTime ?? "").localeCompare(b.dueTime ?? "")
  );
}

/** The Tasks view's groups: Overdue, Today, Upcoming (by due date), No date (newest first). */
export function groupTasks<T extends TaskTiming>(tasks: T[], now: FamilyNow): TaskGroups<T> {
  const groups: TaskGroups<T> = { overdue: [], today: [], upcoming: [], noDate: [], done: [] };
  for (const task of tasks) {
    if (task.doneAt) groups.done.push(task);
    else if (!task.dueDate) groups.noDate.push(task);
    else if (isOverdue(task, now)) groups.overdue.push(task);
    else if (task.dueDate === now.today) groups.today.push(task);
    else groups.upcoming.push(task);
  }
  groups.overdue.sort(byDue);
  groups.today.sort(byDue);
  groups.upcoming.sort(byDue);
  groups.noDate.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  groups.done.sort((a, b) => b.doneAt!.localeCompare(a.doneAt!));
  return groups;
}
