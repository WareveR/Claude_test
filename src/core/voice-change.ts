import type { ClockTime, EntryTime } from "./entry-time";
import type { Importance } from "./entry-type";
import type { Language } from "./languages";
import { occurrencesOf, type OccurrenceException } from "./occurrences";
import { addMinutes, wallClock } from "./reminders";
import { addDays, daysBetween, formatPlainDate, isPlainDate, type PlainDate } from "./plain-date";
import type { Repetition } from "./repetition";
import type { VoiceCreate } from "./voice";

/** How far back and ahead Voice Entry looks for the Entry or Task a sentence changes. */
export const CHANGE_DAYS_BACK = 7;
export const CHANGE_DAYS_AHEAD = 90;
const MAX_TARGETS = 120;

/** What a sentence changes; null leaves a field as it is. */
export type VoiceChange = {
  title: string | null;
  persons: number[] | null;
  date: PlainDate | null;
  time: ClockTime | null;
  endDate: PlainDate | null;
  endTime: ClockTime | null;
  allDay: boolean | null;
  location: string | null;
  importance: Importance | null;
  repeat: VoiceCreate["repeat"];
  done: boolean | null;
};

/** The model's reading of a sentence that changes something. */
export type VoiceChangeAnswer = {
  /** The numbers of the candidates that match; several means "which one?". */
  targets: number[];
  /** The sentence asks to change more than one thing at once. */
  several: boolean;
  /** For a repeating Entry, which Occurrence is meant (its date), if the sentence says. */
  on: PlainDate | null;
  /** "only this time" or "from now on", if the sentence says. */
  scope: "this" | "following" | null;
  change: VoiceChange;
};

export function hasChange(change: VoiceChange): boolean {
  return Object.values(change).some((v) => v !== null);
}

/** Checks the change part of the model's answer, dropping fields that make no sense. */
export function parseVoiceChange(
  value: Record<string, unknown>,
  fields: Omit<VoiceCreate, "kind">,
  candidates: number,
): VoiceChangeAnswer {
  const targets = Array.isArray(value.targets)
    ? [
        ...new Set(
          value.targets.filter(
            (t): t is number => Number.isInteger(t) && t >= 0 && (t as number) < candidates,
          ),
        ),
      ]
    : [];
  return {
    targets,
    several: value.several === true,
    on: typeof value.on === "string" && isPlainDate(value.on) ? value.on : null,
    scope: value.scope === "this" || value.scope === "following" ? value.scope : null,
    change: {
      title: fields.title || null,
      persons: Array.isArray(value.persons) && value.persons.length > 0 ? fields.persons : null,
      date: fields.date,
      time: fields.time,
      endDate: fields.endDate,
      endTime: fields.endTime,
      allDay: fields.allDay,
      location: fields.location,
      importance: fields.importance,
      repeat: fields.repeat,
      done: value.done === true ? true : null,
    },
  };
}

type TargetEntry = {
  id: string;
  title: string;
  time: EntryTime;
  personIds: string[];
  repetition: Repetition | null;
  exceptions: OccurrenceException<{ title?: string; personIds?: string[] }>[];
};

type TargetTask = {
  id: string;
  title: string;
  dueDate: PlainDate | null;
  dueTime: ClockTime | null;
  doneAt: string | null;
  personIds: string[];
  checklistId: string | null;
};

/** Something a sentence may change, as the model sees it. */
export type Target =
  | {
      kind: "entry";
      id: string;
      /** The Occurrence shown: the next one of a repeating Entry. */
      date: PlainDate;
      title: string;
      time: EntryTime;
      personIds: string[];
      repeating: boolean;
    }
  | {
      kind: "task";
      id: string;
      date: PlainDate | null;
      title: string;
      time: ClockTime | null;
      personIds: string[];
      repeating: false;
    };

/**
 * The Entries and Tasks a sentence may change: Entries from 7 days ago to 90 days ahead (a
 * repeating one by its next Occurrence) and open Tasks that are undated, overdue or due by then.
 * Checklist Tasks are left out; Voice Entry doesn't touch Checklists in v1.
 */
export function changeTargets(
  entries: TargetEntry[],
  tasks: TargetTask[],
  today: PlainDate,
): Target[] {
  const from = addDays(today, -CHANGE_DAYS_BACK);
  const to = addDays(today, CHANGE_DAYS_AHEAD);
  const out: Target[] = [];
  for (const entry of entries) {
    const occurrences = occurrencesOf(entry, from, to);
    const o = occurrences.find((x) => x.time.startDate >= today) ?? occurrences.at(-1);
    if (!o) continue;
    const fields = { ...entry, ...o.override };
    out.push({
      kind: "entry",
      id: entry.id,
      date: o.date,
      title: fields.title,
      time: o.time,
      personIds: fields.personIds,
      repeating: entry.repetition !== null,
    });
  }
  for (const task of tasks) {
    if (task.doneAt || task.checklistId) continue;
    if (task.dueDate && task.dueDate > to) continue;
    out.push({
      kind: "task",
      id: task.id,
      date: task.dueDate,
      title: task.title,
      time: task.dueTime,
      personIds: task.personIds,
      repeating: false,
    });
  }
  const distance = (t: Target) => (t.date ? Math.abs(daysBetween(today, t.date)) : 30);
  return out.sort((a, b) => distance(a) - distance(b)).slice(0, MAX_TARGETS);
}

function minutesBetween(a: string, b: string) {
  return (Date.parse(`${b}:00Z`) - Date.parse(`${a}:00Z`)) / 60_000;
}

/** An Entry's time after the change: moving keeps its length, unless the sentence gives an end. */
export function changedTime(time: EntryTime, change: VoiceChange): EntryTime {
  const start = change.date ?? time.startDate;
  const toAllDay =
    change.allDay === true || (change.allDay === null && time.allDay && !change.time);
  if (toAllDay) {
    const days = time.allDay ? daysBetween(time.startDate, time.endDate) : 0;
    const end = change.endDate && change.endDate >= start ? change.endDate : addDays(start, days);
    return { allDay: true, startDate: start, endDate: end };
  }
  const startTime = change.time ?? (time.allDay ? "09:00" : time.startTime);
  const begin = wallClock(start, startTime);
  if (change.endTime) {
    let endDate = change.endDate ?? start;
    if (wallClock(endDate, change.endTime) <= begin) {
      endDate = change.endTime > startTime ? start : addDays(start, 1);
    }
    return { allDay: false, startDate: start, startTime, endDate, endTime: change.endTime };
  }
  if (!time.allDay && time.endDate && time.endTime) {
    const length = minutesBetween(
      wallClock(time.startDate, time.startTime),
      wallClock(time.endDate, time.endTime),
    );
    const [endDate, endTime] = addMinutes(begin, length).split("T");
    return { allDay: false, startDate: start, startTime, endDate, endTime };
  }
  return { allDay: false, startDate: start, startTime, endDate: null, endTime: null };
}

export function changedRepetition(repeat: VoiceCreate["repeat"]): Repetition | null {
  if (!repeat) return null;
  return {
    frequency: repeat.frequency,
    interval: repeat.interval,
    ...(repeat.weekdays ? { weekdays: repeat.weekdays } : {}),
    end: { type: "never" },
  };
}

/** Whether the change touches what a synced Birthday keeps from its Person. */
export function touchesBirthday(change: VoiceChange): boolean {
  return (
    change.title !== null ||
    change.persons !== null ||
    change.date !== null ||
    change.time !== null ||
    change.allDay !== null ||
    change.repeat !== null
  );
}

const LOCALES: Record<Language, string> = { "pt-PT": "pt-PT", en: "en-GB" };

const TEXTS: Record<
  Language,
  { change: string; done: string; for: string; repeats: string; importance: string }
> = {
  "pt-PT": {
    change: "Alterar",
    done: "feita",
    for: "para",
    repeats: "repete",
    importance: "importância",
  },
  en: { change: "Change", done: "done", for: "for", repeats: "repeats", importance: "importance" },
};

/** "Change Dinner: Friday 9 October, 20:00" — what will change, read back before saving. */
export function changeSummary(
  title: string,
  change: VoiceChange,
  personNames: string[],
  language: Language,
): string {
  const texts = TEXTS[language];
  const parts = [
    change.title ? `“${change.title}”` : "",
    change.persons ? `${texts.for} ${personNames.join(", ")}` : "",
    change.date
      ? formatPlainDate(change.date, LOCALES[language], {
          weekday: "long",
          day: "numeric",
          month: "long",
        })
      : "",
    change.time ?? "",
    change.endTime ? `– ${change.endTime}` : "",
    change.repeat ? texts.repeats : "",
    change.location ?? "",
    change.importance ? `${texts.importance}: ${change.importance}` : "",
    change.done ? texts.done : "",
  ];
  return `${texts.change} ${title}: ${parts.filter(Boolean).join(", ")}`;
}
