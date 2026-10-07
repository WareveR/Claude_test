import { addDays, daysBetween, type PlainDate } from "./plain-date";
import { occurrenceDates, type Repetition } from "./repetition";
import { isOverdue, type FamilyNow, type TaskTiming } from "./task";

/**
 * What the calendar core needs of a Checklist: its optional start and end, each on its own, and
 * its optional Repetition. A repeating Checklist always has a start: the current round's.
 */
export type ChecklistPeriod = {
  startDate: PlainDate | null;
  endDate: PlainDate | null;
  repetition?: Repetition | null;
};

/** "3 of 8 done". */
export function checklistProgress(tasks: { doneAt: string | null }[]) {
  return { done: tasks.filter((t) => t.doneAt).length, total: tasks.length };
}

/** A Checklist isn't pending before its start: its items aren't due or overdue yet. */
export function isPending(checklist: ChecklistPeriod, now: FamilyNow) {
  return !checklist.startDate || checklist.startDate <= now.today;
}

/**
 * The last day of the current round: the end, or, for a repeating Checklist without one, its
 * start day only. Null when nothing makes its items due.
 */
export function roundEnd(checklist: ChecklistPeriod): PlainDate | null {
  if (checklist.endDate) return checklist.endDate;
  return checklist.repetition && checklist.startDate ? checklist.startDate : null;
}

/**
 * A Checklist item as the calendar core sees it: its own stored date and time are ignored, it is
 * due at the end of its Checklist's round.
 */
export function checklistTaskTiming<T extends TaskTiming>(task: T, checklist: ChecklistPeriod): T {
  return { ...task, dueDate: roundEnd(checklist), dueTime: null };
}

/** A Checklist item is overdue only once its Checklist is pending and its round has ended. */
export function isChecklistTaskOverdue(
  task: TaskTiming,
  checklist: ChecklistPeriod,
  now: FamilyNow,
) {
  return isPending(checklist, now) && isOverdue(checklistTaskTiming(task, checklist), now);
}

/** Which Tasks view group a Checklist's row sits in: the group of its round's end, or No date. */
export function checklistGroup(
  checklist: ChecklistPeriod,
  tasks: TaskTiming[],
  now: FamilyNow,
): "overdue" | "today" | "upcoming" | "noDate" | "done" {
  if (tasks.length > 0 && tasks.every((t) => t.doneAt)) return "done";
  const end = roundEnd(checklist);
  if (!end) return checklist.startDate && checklist.startDate > now.today ? "upcoming" : "noDate";
  if (tasks.some((t) => isChecklistTaskOverdue(t, checklist, now))) return "overdue";
  if (end === now.today) return "today";
  return end < now.today ? "done" : "upcoming";
}

/**
 * The start of the round a repeating Checklist should be on today: the latest Repetition date
 * from its current start up to today, when that is later than the current start. Null when the
 * current round still runs (or the Checklist doesn't repeat).
 */
export function dueRoundStart(checklist: ChecklistPeriod, today: PlainDate): PlainDate | null {
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
 * The first round of a repeating Checklist saved without a start: the first Repetition date from
 * today (today itself when it is one).
 */
export function firstRoundStart(repetition: Repetition, today: PlainDate): PlainDate {
  const [first] = occurrenceDates(today, repetition, today, addDays(today, 4 * 366));
  return first ?? today;
}

/** When a repeating Checklist's next round starts, or null when it doesn't repeat (any more). */
export function nextRoundStart(checklist: ChecklistPeriod): PlainDate | null {
  if (!checklist.repetition || !checklist.startDate) return null;
  const after = addDays(checklist.startDate, 1);
  const [next] = occurrenceDates(
    checklist.startDate,
    checklist.repetition,
    after,
    addDays(after, 4 * 366),
  );
  return next ?? null;
}

/**
 * A new round's period: start and end move by the days from the old start to the new one, so a
 * round keeps its length. A Checklist without a start doesn't move.
 */
export function shiftRound(checklist: ChecklistPeriod, newStart: PlainDate | null) {
  if (!checklist.startDate || !newStart) {
    return { startDate: checklist.startDate, endDate: checklist.endDate, days: 0 };
  }
  const days = daysBetween(checklist.startDate, newStart);
  return {
    startDate: newStart,
    endDate: checklist.endDate ? addDays(checklist.endDate, days) : null,
    days,
  };
}

/**
 * The days a Checklist's calendar bar covers within a window. A repeating one shows on each
 * round's days (start to end, or only the start day without an end), not across the whole time;
 * one with a start and an end spans them; one with only one of them shows on that day.
 */
export function checklistSpans(
  checklist: ChecklistPeriod,
  from: PlainDate,
  to: PlainDate,
): { startDate: PlainDate; endDate: PlainDate }[] {
  const { startDate, endDate, repetition } = checklist;
  if (repetition && startDate) {
    const length = endDate ? Math.max(0, daysBetween(startDate, endDate)) : 0;
    return occurrenceDates(startDate, repetition, addDays(from, -length), to).map((d) => ({
      startDate: d,
      endDate: addDays(d, length),
    }));
  }
  const first = startDate ?? endDate;
  const last = endDate ?? startDate;
  if (!first || !last || first > to || last < from) return [];
  return [{ startDate: first, endDate: last }];
}

/** The name a closed round keeps with its result: the year it started, or was closed. */
export function roundLabel(checklist: ChecklistPeriod, closedOn: PlainDate) {
  return (checklist.startDate ?? closedOn).slice(0, 4);
}
