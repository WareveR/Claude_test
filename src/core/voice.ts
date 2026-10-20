import { clockTime, isClockTime, minutesOf, type ClockTime, type EntryTime } from "./entry-time";
import {
  newEntryIcon,
  type EntryTypeDefaults,
  type Importance,
  type ReminderOffset,
} from "./entry-type";
import type { Language } from "./languages";
import { addDays, formatPlainDate, isPlainDate, type PlainDate } from "./plain-date";
import type { Repetition } from "./repetition";
import { MAX_TEMPLATE_TEXT } from "./checklist-template";

/** The longest sentence Voice Entry takes. */
export const MAX_SENTENCE = 300;

const IMPORTANCES: Importance[] = ["low", "normal", "high"];
const FREQUENCIES = ["daily", "weekly", "monthly", "yearly"] as const;

/** What the model may answer for a new Entry or Task: numbers point into the lists it was given. */
export type VoiceCreate = {
  kind: "entry" | "task";
  title: string;
  type: number | null;
  persons: number[];
  date: PlainDate | null;
  time: ClockTime | null;
  endDate: PlainDate | null;
  endTime: ClockTime | null;
  allDay: boolean | null;
  location: string | null;
  importance: Importance | null;
  repeat: {
    frequency: Repetition["frequency"];
    interval: number;
    weekdays: number[] | null;
  } | null;
  /** A Task's items, as the sentence names them ("towels, sunscreen"). */
  items?: string[];
  /** The predefined list a Task takes its items from. */
  list?: number | null;
};

/** The most items one sentence gives a Task. */
export const MAX_VOICE_ITEMS = 30;

/** The model's answer checked field by field; a bad field is dropped, a missing title fails. */
export function parseVoiceCreate(
  value: unknown,
  persons: number,
  types: number,
  lists = 0,
): VoiceCreate | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.kind !== "entry" && v.kind !== "task") return null;
  const fields = parseVoiceFields(v, persons, types);
  if (!fields.title) return null;
  if (v.kind === "entry") return { ...fields, kind: v.kind };
  const items = Array.isArray(v.items)
    ? [
        ...new Set(
          v.items
            .filter((i): i is string => typeof i === "string")
            .map((i) => i.trim().slice(0, MAX_TEMPLATE_TEXT))
            .filter(Boolean),
        ),
      ].slice(0, MAX_VOICE_ITEMS)
    : [];
  const list =
    Number.isInteger(v.list) && (v.list as number) >= 0 && (v.list as number) < lists
      ? (v.list as number)
      : null;
  return { ...fields, kind: v.kind, items, list };
}

/** The fields of the model's answer, each checked on its own; an empty title is "". */
export function parseVoiceFields(
  v: Record<string, unknown>,
  persons: number,
  types: number,
): Omit<VoiceCreate, "kind"> {
  const title = typeof v.title === "string" ? v.title.trim().slice(0, 200) : "";
  const date = (x: unknown) => (typeof x === "string" && isPlainDate(x) ? x : null);
  const time = (x: unknown) => (typeof x === "string" && isClockTime(x) ? x : null);
  const index = (x: unknown, length: number) =>
    Number.isInteger(x) && (x as number) >= 0 && (x as number) < length ? (x as number) : null;
  const r = v.repeat as Record<string, unknown> | null | undefined;
  const repeat =
    r && FREQUENCIES.includes(r.frequency as never)
      ? {
          frequency: r.frequency as Repetition["frequency"],
          interval:
            Number.isInteger(r.interval) &&
            (r.interval as number) >= 1 &&
            (r.interval as number) <= 99
              ? (r.interval as number)
              : 1,
          weekdays:
            r.frequency === "weekly" &&
            Array.isArray(r.weekdays) &&
            r.weekdays.length > 0 &&
            r.weekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
              ? [...new Set(r.weekdays as number[])].sort()
              : null,
        }
      : null;
  return {
    title,
    type: index(v.type, types),
    persons: Array.isArray(v.persons)
      ? [...new Set(v.persons.map((p) => index(p, persons)).filter((p) => p !== null))]
      : [],
    date: date(v.date),
    time: time(v.time),
    endDate: date(v.endDate),
    endTime: time(v.endTime),
    allDay: typeof v.allDay === "boolean" ? v.allDay : null,
    location: typeof v.location === "string" && v.location.trim() ? v.location.trim() : null,
    importance: IMPORTANCES.includes(v.importance as Importance)
      ? (v.importance as Importance)
      : null,
    repeat,
  };
}

/** A new Entry as POST /entries takes it. */
export type EntryValues = {
  title: string;
  entryTypeId: string;
  time: EntryTime;
  personIds: string[];
  importance: Importance;
  location: string;
  notes: string;
  icon: string | null;
  private: boolean;
  reminders: ReminderOffset[];
  repetition: Repetition | null;
  birthYearKnown: boolean;
};

/** A new Task as POST /tasks takes it. */
export type TaskValues = {
  title: string;
  notes: string;
  dueDate: PlainDate | null;
  dueTime: ClockTime | null;
  personIds: string[];
  private: boolean;
  repetition: Repetition | null;
  checklistId: null;
};

function repetitionOf(repeat: VoiceCreate["repeat"]): Repetition | null {
  if (!repeat) return null;
  return {
    frequency: repeat.frequency,
    interval: repeat.interval,
    ...(repeat.weekdays ? { weekdays: repeat.weekdays } : {}),
    end: { type: "never" },
  };
}

/**
 * Turns the model's answer into a new Entry, filling what the sentence didn't say from the Entry
 * Type's defaults, as the form would, and with the icon its title names ("Ginásio" → the gym).
 */
export function entryValues(
  answer: VoiceCreate,
  type: {
    id: string;
    defaults: EntryTypeDefaults;
    builtinKey?: string | null;
    icon?: string | null;
  },
  personIds: string[],
  today: PlainDate,
): EntryValues {
  const d = type.defaults;
  const start = answer.date ?? today;
  const startTime = answer.time ?? (d.allDay === false ? (d.startTime ?? null) : null);
  let time: EntryTime;
  if (answer.allDay === true || (answer.allDay === null && startTime === null)) {
    const end = answer.endDate && answer.endDate >= start ? answer.endDate : start;
    time = { allDay: true, startDate: start, endDate: end };
  } else {
    const at = startTime ?? d.startTime ?? "09:00";
    let endDate: PlainDate | null = null;
    let endTime: ClockTime | null = null;
    if (answer.endTime) {
      endDate = answer.endDate ?? start;
      endTime = answer.endTime;
      if (`${endDate}T${endTime}` <= `${start}T${at}`) {
        endDate = endTime > at ? start : addDays(start, 1);
      }
    } else if (d.durationMinutes) {
      const end = minutesOf(at) + d.durationMinutes;
      endDate = end >= 1440 ? addDays(start, 1) : start;
      endTime = clockTime(end % 1440);
    }
    time = { allDay: false, startDate: start, startTime: at, endDate, endTime };
  }
  return {
    title: answer.title,
    entryTypeId: type.id,
    time,
    personIds: personIds.length > 0 ? personIds : (d.personIds ?? []),
    importance: answer.importance ?? d.importance ?? "normal",
    location: answer.location ?? d.location ?? "",
    notes: d.notes ?? "",
    icon: newEntryIcon(answer.title, type),
    private: false,
    reminders: d.reminders ?? [],
    repetition: repetitionOf(answer.repeat) ?? d.repetition ?? null,
    birthYearKnown: false,
  };
}

/** Turns the model's answer into a new Task; a repeating Task needs a due date. */
export function taskValues(answer: VoiceCreate, personIds: string[]): TaskValues {
  const repetition = answer.date ? repetitionOf(answer.repeat) : null;
  return {
    title: answer.title,
    notes: "",
    dueDate: answer.date,
    dueTime: answer.date ? answer.time : null,
    personIds,
    private: false,
    repetition,
    checklistId: null,
  };
}

const LOCALES: Record<Language, string> = { "pt-PT": "pt-PT", en: "en-GB" };

const TEXTS: Record<
  Language,
  {
    entry: string;
    task: string;
    noDate: string;
    allDay: string;
    for: (names: string) => string;
    and: string;
    every: Record<Repetition["frequency"], (n: number) => string>;
    list: (name: string) => string;
    items: (n: number) => string;
    person: string;
    born: (date: string) => string;
    aka: (names: string) => string;
    template: string;
  }
> = {
  "pt-PT": {
    entry: "Nova entrada",
    task: "Nova tarefa",
    noDate: "sem data",
    allDay: "todo o dia",
    for: (names) => `para ${names}`,
    and: " e ",
    every: {
      daily: (n) => (n === 1 ? "todos os dias" : `de ${n} em ${n} dias`),
      weekly: (n) => (n === 1 ? "todas as semanas" : `de ${n} em ${n} semanas`),
      monthly: (n) => (n === 1 ? "todos os meses" : `de ${n} em ${n} meses`),
      yearly: (n) => (n === 1 ? "todos os anos" : `de ${n} em ${n} anos`),
    },
    list: (name) => `com a lista ${name}`,
    items: (n) => (n === 1 ? "com 1 item" : `com ${n} itens`),
    person: "Nova pessoa",
    born: (date) => `nasceu a ${date}`,
    aka: (names) => `também ${names}`,
    template: "Nova lista pré-definida",
  },
  en: {
    entry: "New entry",
    task: "New task",
    noDate: "no date",
    allDay: "all day",
    for: (names) => `for ${names}`,
    and: " and ",
    every: {
      daily: (n) => (n === 1 ? "every day" : `every ${n} days`),
      weekly: (n) => (n === 1 ? "every week" : `every ${n} weeks`),
      monthly: (n) => (n === 1 ? "every month" : `every ${n} months`),
      yearly: (n) => (n === 1 ? "every year" : `every ${n} years`),
    },
    list: (name) => `with the list ${name}`,
    items: (n) => (n === 1 ? "with 1 item" : `with ${n} items`),
    person: "New person",
    born: (date) => `born ${date}`,
    aka: (names) => `also ${names}`,
    template: "New predefined list",
  },
};

function names(list: string[], and: string) {
  return list.length <= 1 ? list.join("") : `${list.slice(0, -1).join(", ")}${and}${list.at(-1)}`;
}

/**
 * The short summary read back and shown: "New entry: Dentist, for Ana, Tuesday 6 October, 15:00";
 * a Task with items ends "with the list Beach day" or "with 3 items", the list's own not counted.
 */
export function voiceSummary(
  kind: "entry" | "task",
  values: {
    title: string;
    date: PlainDate | null;
    time: ClockTime | null;
    allDay: boolean;
    repetition: Repetition | null;
    list?: string | null;
    items?: number;
  },
  personNames: string[],
  language: Language,
): string {
  const texts = TEXTS[language];
  const when = values.date
    ? formatPlainDate(values.date, LOCALES[language], {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : texts.noDate;
  const parts = [
    values.title,
    personNames.length > 0 ? texts.for(names(personNames, texts.and)) : "",
    when,
    values.time ?? (values.allDay ? texts.allDay : ""),
    values.repetition ? texts.every[values.repetition.frequency](values.repetition.interval) : "",
    values.list ? texts.list(values.list) : "",
    values.items ? texts.items(values.items) : "",
  ];
  return `${kind === "entry" ? texts.entry : texts.task}: ${parts.filter(Boolean).join(", ")}`;
}

/** A new Person's summary: "New person: Maria, also Mimi, born 3 May 2015". */
export function personSummary(
  values: { name: string; nicknames: string[]; dateOfBirth: PlainDate | null },
  language: Language,
): string {
  const texts = TEXTS[language];
  const parts = [
    values.name,
    values.nicknames.length > 0 ? texts.aka(names(values.nicknames, texts.and)) : "",
    values.dateOfBirth
      ? texts.born(
          formatPlainDate(values.dateOfBirth, LOCALES[language], {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        )
      : "",
  ];
  return `${texts.person}: ${parts.filter(Boolean).join(", ")}`;
}

/** A new predefined list's summary: "New predefined list: Beach, with 3 items". */
export function templateSummary(
  values: { name: string; items: string[] },
  language: Language,
): string {
  const texts = TEXTS[language];
  const parts = [values.name, values.items.length > 0 ? texts.items(values.items.length) : ""];
  return `${texts.template}: ${parts.filter(Boolean).join(", ")}`;
}
