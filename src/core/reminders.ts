import type { ReminderOffset } from "./entry-type";
import { clockTime, minutesOf, type ClockTime, type EntryTime } from "./entry-time";
import type { Language } from "./languages";
import { occurrencesOf, type OccurrenceException } from "./occurrences";
import { addDays, formatPlainDate, type PlainDate } from "./plain-date";
import type { Repetition } from "./repetition";

/** All-day Entries, Tasks without a due time and Checklists remind at this time on the day. */
export const ALL_DAY_REMINDER_TIME = "09:00";

/** A wall-clock moment in the Family Time Zone, "2026-10-02T09:00"; sorts as a string. */
export type WallClock = string;

export function wallClock(date: PlainDate, time: ClockTime): WallClock {
  return `${date}T${time}`;
}

/** Moves a wall-clock moment by whole minutes, ignoring summer time like the rest of the calendar. */
export function addMinutes(at: WallClock, minutes: number): WallClock {
  const [date, time] = at.split("T");
  const total = minutesOf(time) + minutes;
  const days = Math.floor(total / 1440);
  return wallClock(addDays(date, days), clockTime(total - days * 1440));
}

/** One Reminder due: what it is about, when it fires, and who it is for. */
export type DueReminder = {
  /** Unique per item, Occurrence and offset, so `reminder_sent` keeps it from going twice. */
  key: string;
  kind: "entry" | "task" | "checklist";
  id: string;
  /** The Occurrence's date, which opens it. */
  date: PlainDate;
  at: WallClock;
  /** The day it starts, shown in the text. */
  startDate: PlainDate;
  title: string;
  /** The start time shown, or null for an All-day item. */
  time: ClockTime | null;
  private: boolean;
  /** Empty is Family-wide. */
  personIds: string[];
};

type ReminderEntry = {
  id: string;
  title: string;
  time: EntryTime;
  private: boolean;
  personIds: string[];
  repetition: Repetition | null;
  reminders: ReminderOffset[];
  exceptions: OccurrenceException<{ title?: string; private?: boolean; personIds?: string[] }>[];
};

/**
 * The Entry Reminders firing after `from` and up to `to` (wall-clock, Family time). Each
 * Occurrence reminds on its own; an All-day one counts as starting at 09:00.
 */
export function entryReminders(
  entries: ReminderEntry[],
  from: WallClock,
  to: WallClock,
): DueReminder[] {
  const out: DueReminder[] = [];
  const fromDate = from.slice(0, 10);
  for (const entry of entries) {
    if (entry.reminders.length === 0) continue;
    const reachDays = Math.ceil(Math.max(...entry.reminders) / 1440) + 1;
    const toDate = addDays(to.slice(0, 10), reachDays);
    for (const o of occurrencesOf(entry, fromDate, toDate)) {
      if (o.time.startDate < fromDate) continue;
      const fields = { ...entry, ...o.override };
      const startTime = o.time.allDay ? ALL_DAY_REMINDER_TIME : o.time.startTime;
      const start = wallClock(o.time.startDate, startTime);
      for (const offset of new Set(entry.reminders)) {
        const at = addMinutes(start, -offset);
        if (at <= from || at > to) continue;
        out.push({
          key: `entry:${entry.id}:${o.date}:${offset}`,
          kind: "entry",
          id: entry.id,
          date: o.date,
          at,
          startDate: o.time.startDate,
          title: fields.title,
          time: o.time.allDay ? null : o.time.startTime,
          private: fields.private,
          personIds: fields.personIds,
        });
      }
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

type ReminderTask = {
  id: string;
  title: string;
  dueDate: PlainDate | null;
  dueTime: ClockTime | null;
  doneAt: string | null;
  private: boolean;
  personIds: string[];
  checklistId: string | null;
};

const inWindow = (at: WallClock, from: WallClock, to: WallClock) => at > from && at <= to;

/**
 * A dated Task's one Reminder: at its due time, or 09:00 on its due day. Done Tasks don't remind,
 * and neither do a Checklist's items: only their Checklist does.
 */
export function taskReminders(
  tasks: ReminderTask[],
  from: WallClock,
  to: WallClock,
): DueReminder[] {
  return tasks.flatMap((task): DueReminder[] => {
    if (!task.dueDate || task.doneAt || task.checklistId) return [];
    const at = wallClock(task.dueDate, task.dueTime ?? ALL_DAY_REMINDER_TIME);
    if (!inWindow(at, from, to)) return [];
    return [
      {
        key: `task:${task.id}:${at}`,
        kind: "task",
        id: task.id,
        date: task.dueDate,
        at,
        startDate: task.dueDate,
        title: task.title,
        time: task.dueTime,
        private: task.private,
        personIds: task.personIds,
      },
    ];
  });
}

/**
 * A Checklist with the switch on reminds at 09:00 on the first day of its period, each round
 * again. It goes to whoever its Tasks are for; with a Family-wide Task, or none, to everyone.
 */
export function checklistReminders(
  checklists: { id: string; name: string; startDate: PlainDate | null; remindAtStart: boolean }[],
  tasks: ReminderTask[],
  from: WallClock,
  to: WallClock,
): DueReminder[] {
  return checklists.flatMap((checklist): DueReminder[] => {
    if (!checklist.remindAtStart || !checklist.startDate) return [];
    const at = wallClock(checklist.startDate, ALL_DAY_REMINDER_TIME);
    if (!inWindow(at, from, to)) return [];
    const own = tasks.filter((t) => t.checklistId === checklist.id);
    const personIds = own.some((t) => t.personIds.length === 0)
      ? []
      : [...new Set(own.flatMap((t) => t.personIds))];
    return [
      {
        key: `checklist:${checklist.id}:${checklist.startDate}`,
        kind: "checklist",
        id: checklist.id,
        date: checklist.startDate,
        at,
        startDate: checklist.startDate,
        title: checklist.name,
        time: null,
        private: false,
        personIds,
      },
    ];
  });
}

/** Whether a device with these Reminder settings gets a Reminder for these Persons. */
export function remindsDevice(
  device: { remindersOn: boolean; reminderPersonIds: string[] | null },
  personIds: string[],
): boolean {
  if (!device.remindersOn) return false;
  if (personIds.length === 0 || device.reminderPersonIds === null) return true;
  return personIds.some((id) => device.reminderPersonIds!.includes(id));
}

const TEXTS: Record<Language, { at: (when: string) => string; on: (when: string) => string }> = {
  "pt-PT": { at: (when) => `Lembrete às ${when}`, on: (when) => `Lembrete para ${when}` },
  en: { at: (when) => `Reminder at ${when}`, on: (when) => `Reminder for ${when}` },
};

const LOCALES: Record<Language, string> = { "pt-PT": "pt-PT", en: "en-GB" };

/**
 * The notification text: title and time ("Dentist, 10:00"), with the date when it isn't today.
 * Never notes; a Private item shows only "Reminder at 10:00".
 */
export function reminderText(reminder: DueReminder, today: PlainDate, language: Language): string {
  const { startDate } = reminder;
  const day =
    startDate === today
      ? ""
      : formatPlainDate(startDate, LOCALES[language], {
          weekday: "short",
          day: "numeric",
          month: "short",
        });
  const when = [day, reminder.time ?? ""].filter(Boolean).join(" ");
  if (reminder.private) {
    if (reminder.time) return TEXTS[language].at(when);
    return TEXTS[language].on(
      day || formatPlainDate(startDate, LOCALES[language], { day: "numeric", month: "short" }),
    );
  }
  return when ? `${reminder.title}, ${when}` : reminder.title;
}
