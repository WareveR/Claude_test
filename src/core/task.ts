import { minutesOf, type ClockTime } from "./entry-time";
import { addDays, minutesNowIn, todayIn, type PlainDate } from "./plain-date";
import { occurrenceDates, type Repetition } from "./repetition";

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

const UNIT_DAYS = { daily: 1, weekly: 7, monthly: 31, yearly: 366 };

/**
 * The next Task of a repeating series when one is ticked: due on the first Repetition date after
 * today (and after its own due date), so an overdue chore never comes back already overdue.
 * A series that ends by a number of times carries on with the times that are left. Null when the
 * series has ended.
 */
export function nextRepeat(
  dueDate: PlainDate,
  repetition: Repetition,
  today: PlainDate,
): { dueDate: PlainDate; repetition: Repetition } | null {
  const after = addDays(dueDate > today ? dueDate : today, 1);
  const reach = addDays(after, repetition.interval * UNIT_DAYS[repetition.frequency] + 31);
  const [next] = occurrenceDates(dueDate, repetition, after, reach);
  if (!next) return null;
  if (repetition.end.type !== "count") return { dueDate: next, repetition };
  const used = occurrenceDates(dueDate, repetition, dueDate, addDays(next, -1)).length;
  return {
    dueDate: next,
    repetition: { ...repetition, end: { type: "count", count: repetition.end.count - used } },
  };
}
