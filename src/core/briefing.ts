import { birthdayAge, birthdayTitle } from "./birthday";
import { checklistProgress } from "./checklist";
import type { Importance } from "./entry-type";
import type { EntryTime } from "./entry-time";
import type { Language } from "./languages";
import { occurrencesOf, type OccurrenceException } from "./occurrences";
import { matchesFilter } from "./person-filter";
import { addDays, daysBetween, formatPlainDate, type PlainDate } from "./plain-date";
import type { Repetition } from "./repetition";

/** How far ahead the Briefing looks. */
export const BRIEFING_DAYS = 60;
/** At most this many candidates go to the model, the most pressing first. */
export const MAX_CANDIDATES = 40;
/** A change this close makes the Briefing out of date. */
export const REWRITE_DAYS = 7;
const FALLBACK_ITEMS = 5;

/** Something the Briefing may mention: only titles, dates, Persons' names and Importance. */
export type Candidate = {
  kind: "entry" | "task" | "checklist" | "holiday";
  /** The Entry, Task or Checklist it links to; none for a Public Holiday. */
  id: string | null;
  date: PlainDate;
  time: string | null;
  title: string;
  persons: string[];
  /** Who it is for, to pick a Person's Briefing; never sent to the model. Empty is Family-wide. */
  personIds: string[];
  importance: Importance;
  /** A Task past its due date, or a Checklist's "3/8". */
  detail?: "overdue" | `${number}/${number}`;
};

/** A piece of Briefing text; one with `link` opens that Entry Occurrence, Task or Checklist. */
export type Segment = {
  text: string;
  link?: { kind: "entry" | "task" | "checklist"; id: string; date: PlainDate };
};

type BriefingEntry = {
  id: string;
  title: string;
  time: EntryTime;
  importance: Importance;
  private: boolean;
  personIds: string[];
  repetition: Repetition | null;
  birthdayPersonId?: string | null;
  birthYearKnown?: boolean;
  exceptions: OccurrenceException<{ title?: string; private?: boolean; personIds?: string[] }>[];
};

type BriefingTask = {
  id: string;
  title: string;
  dueDate: PlainDate | null;
  dueTime: string | null;
  doneAt: string | null;
  private: boolean;
  personIds: string[];
  checklistId: string | null;
};

type BriefingChecklist = {
  id: string;
  name: string;
  startDate: PlainDate | null;
  endDate: PlainDate | null;
};

export type BriefingInput = {
  today: PlainDate;
  entries: BriefingEntry[];
  tasks: BriefingTask[];
  checklists: BriefingChecklist[];
  holidays: Map<PlainDate, string[]>;
  personNames: Map<string, string>;
};

const RANK: Record<Importance, number> = { high: 0, normal: 1, low: 2 };

/**
 * What is coming up in the next 60 days, never notes and never Private items: Entry
 * Occurrences (Birthdays with their age), Tasks overdue or due, Checklists still open with
 * their progress, and Public Holidays. The most pressing first: overdue, then by date, then
 * High Importance.
 */
export function briefingCandidates(input: BriefingInput, max = MAX_CANDIDATES): Candidate[] {
  const { today } = input;
  const last = addDays(today, BRIEFING_DAYS - 1);
  const names = (ids: string[]) =>
    ids.map((id) => input.personNames.get(id)).filter((n): n is string => Boolean(n));
  const out: Candidate[] = [];

  for (const entry of input.entries) {
    for (const o of occurrencesOf(entry, today, last)) {
      const fields = { ...entry, ...o.override };
      if (fields.private) continue;
      const age = entry.birthdayPersonId
        ? birthdayAge(entry.time.startDate, o.date, Boolean(entry.birthYearKnown))
        : null;
      const date = o.time.startDate < today ? today : o.time.startDate;
      out.push({
        kind: "entry",
        id: entry.id,
        date,
        time: o.time.allDay || date !== o.time.startDate ? null : o.time.startTime,
        title: birthdayTitle(fields.title, age),
        persons: names(fields.personIds),
        personIds: fields.personIds,
        importance: entry.importance,
      });
    }
  }

  for (const task of input.tasks) {
    if (task.private || task.doneAt || task.checklistId || !task.dueDate) continue;
    if (task.dueDate > last) continue;
    const overdue = task.dueDate < today;
    out.push({
      kind: "task",
      id: task.id,
      date: task.dueDate,
      time: task.dueTime,
      title: task.title,
      persons: names(task.personIds),
      personIds: task.personIds,
      importance: overdue ? "high" : "normal",
      ...(overdue ? { detail: "overdue" as const } : {}),
    });
  }

  for (const checklist of input.checklists) {
    if (!checklist.endDate || checklist.endDate < today || checklist.endDate > last) continue;
    if (checklist.startDate && checklist.startDate > today) continue;
    const tasks = input.tasks.filter((t) => t.checklistId === checklist.id);
    const { done, total } = checklistProgress(tasks);
    if (total === 0 || done === total) continue;
    out.push({
      kind: "checklist",
      id: checklist.id,
      date: checklist.endDate,
      time: null,
      title: checklist.name,
      persons: [],
      // Shown to a Person when any of its Tasks is theirs or Family-wide.
      personIds: tasks.some((t) => t.personIds.length === 0)
        ? []
        : [...new Set(tasks.flatMap((t) => t.personIds))],
      importance: "normal",
      detail: `${done}/${total}`,
    });
  }

  for (const [date, holidayNames] of input.holidays) {
    if (date < today || date > last) continue;
    for (const title of holidayNames) {
      out.push({
        kind: "holiday",
        id: null,
        date,
        time: null,
        title,
        persons: [],
        personIds: [],
        importance: "low",
      });
    }
  }

  return out
    .sort(
      (a, b) =>
        Number(b.detail === "overdue") - Number(a.detail === "overdue") ||
        a.date.localeCompare(b.date) ||
        RANK[a.importance] - RANK[b.importance] ||
        (a.time ?? "").localeCompare(b.time ?? ""),
    )
    .slice(0, max);
}

/** A Person's Briefing: what is theirs and what is Family-wide. */
export function forPerson(candidates: Candidate[], personId: string): Candidate[] {
  const filter = { personIds: [personId], familyWide: true, holidays: true };
  return candidates.filter((c) => matchesFilter(c.personIds, filter));
}

/** The next 7 days (and anything overdue) as a string; when it changes, the Briefing is rewritten. */
export function weekOf(candidates: Candidate[], today: PlainDate): string {
  const last = addDays(today, REWRITE_DAYS - 1);
  return JSON.stringify(
    candidates
      .filter((c) => c.date <= last)
      .map((c) => [c.kind, c.id, c.date, c.time, c.title, c.persons, c.importance, c.detail]),
  );
}

/** The link a candidate's phrase opens, if any. */
export function candidateLink(candidate: Candidate): Segment["link"] {
  return candidate.kind === "holiday" || !candidate.id
    ? undefined
    : { kind: candidate.kind, id: candidate.id, date: candidate.date };
}

const TEXTS: Record<
  Language,
  {
    today: string;
    tomorrow: string;
    inDays: (n: number) => string;
    overdue: (n: number) => string;
    nothing: string;
  }
> = {
  "pt-PT": {
    today: "hoje",
    tomorrow: "amanhã",
    inDays: (n) => `daqui a ${n} dias`,
    overdue: (n) => (n === 1 ? "atrasada 1 dia" : `atrasada ${n} dias`),
    nothing: "Nada marcado para os próximos dias.",
  },
  en: {
    today: "today",
    tomorrow: "tomorrow",
    inDays: (n) => `in ${n} days`,
    overdue: (n) => (n === 1 ? "1 day overdue" : `${n} days overdue`),
    nothing: "Nothing planned for the coming days.",
  },
};

const LOCALES: Record<Language, string> = { "pt-PT": "pt-PT", en: "en-GB" };

/**
 * The fallback when the model fails: the most pressing candidates as a countdown list,
 * "Mum's birthday · in 6 days (Wed 7 Oct)".
 */
export function countdown(
  candidates: Candidate[],
  today: PlainDate,
  language: Language,
): Segment[] {
  const texts = TEXTS[language];
  const items = candidates.slice(0, FALLBACK_ITEMS);
  if (items.length === 0) return [{ text: texts.nothing }];
  return items.map((c) => {
    const days = daysBetween(today, c.date);
    const when =
      c.detail === "overdue"
        ? texts.overdue(-days)
        : days === 0
          ? texts.today
          : days === 1
            ? texts.tomorrow
            : texts.inDays(days);
    const date = formatPlainDate(c.date, LOCALES[language], {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    const progress = c.detail && c.detail !== "overdue" ? ` (${c.detail})` : "";
    return { text: `${c.title}${progress} · ${when} (${date})`, link: candidateLink(c) };
  });
}
