import type { ClockTime, EntryTime } from "./entry-time";
import type { Importance } from "./entry-type";
import { addDays, type PlainDate } from "./plain-date";
import type { Repetition } from "./repetition";
import { nextRepeat } from "./task";

/** What an Entry and a Task have in common, kept when one turns into the other. */
type Shared = {
  title: string;
  notes: string;
  personIds: string[];
  private: boolean;
  importance: Importance;
  repetition: Repetition | null;
};

export type EntryToConvert = Shared & { time: EntryTime; location: string };

export type TaskFromEntry = Shared & { dueDate: PlainDate; dueTime: ClockTime | null };

/**
 * The Task an Entry turns into: due on its start (at its start time, when it has one), its
 * location kept in the notes. A repeating Entry's Task is due on its next Occurrence from
 * today, since a Task's repeats only start from its due date; once its Occurrences are over,
 * it is due on its first day and no longer repeats. The Entry Type, icon, end, Reminders
 * and edited Occurrences are not kept.
 */
export function taskFromEntry(entry: EntryToConvert, today: PlainDate): TaskFromEntry {
  const notes = [entry.notes, entry.location].filter(Boolean).join("\n");
  const dueTime = entry.time.allDay ? null : entry.time.startTime;
  let dueDate = entry.time.startDate;
  let repetition = entry.repetition;
  if (repetition && dueDate < today) {
    // The first Occurrence from today on: the next one after yesterday.
    const next = nextRepeat(dueDate, repetition, addDays(today, -1));
    if (next) ({ dueDate, repetition } = next);
    else repetition = null;
  }
  return { ...shared(entry), notes, dueDate, dueTime, repetition };
}

export type TaskToConvert = Shared & { dueDate: PlainDate | null; dueTime: ClockTime | null };

export type EntryFromTask = Shared & { time: EntryTime };

/**
 * The Entry a Task turns into: at its due time, all day on its due date without one, or all
 * day today when it has no date. Its done state and the Entry it prepared for are not kept.
 */
export function entryFromTask(task: TaskToConvert, today: PlainDate): EntryFromTask {
  const date = task.dueDate ?? today;
  const time: EntryTime =
    task.dueDate && task.dueTime
      ? { allDay: false, startDate: date, startTime: task.dueTime, endDate: null, endTime: null }
      : { allDay: true, startDate: date, endDate: date };
  // A repeating Task always has a due date, so its Repetition starts where the Entry does.
  return { ...shared(task), time, repetition: task.dueDate ? task.repetition : null };
}

function shared(from: Shared): Shared {
  return {
    title: from.title,
    notes: from.notes,
    personIds: from.personIds,
    private: from.private,
    importance: from.importance,
    repetition: from.repetition,
  };
}
