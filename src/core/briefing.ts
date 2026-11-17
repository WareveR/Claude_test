import { liftClashes, liftMissing, type LiftRole } from "./lifts";
import { birthdayAge, birthdayTitle } from "./birthday";
import { checklistProgress, roundEnd } from "./checklist";
import type { Importance } from "./entry-type";
import type { EntryTime } from "./entry-time";
import type { Language } from "./languages";
import { occurrencesOf, type OccurrenceException } from "./occurrences";
import { matchesFilter } from "./person-filter";
import { addDays, daysBetween, formatPlainDate, type PlainDate } from "./plain-date";
import type { Repetition } from "./repetition";
import type { ClockChange } from "./clock-change";
import type { Bin } from "./waste";
import type { DayWeather, HourWeather } from "./weather";

/** How far ahead the Briefing looks. */
export const BRIEFING_DAYS = 60;
/** At most this many candidates go to the model, the most pressing first. */
export const MAX_CANDIDATES = 40;
/** A Public Holiday is only worth a word this close: one in 47 days is no news. */
export const HOLIDAY_DAYS = 14;
/** A change this close makes the Briefing out of date. */
export const REWRITE_DAYS = 7;
const FALLBACK_ITEMS = 8;

/** Something the Briefing may mention: only titles, dates, Persons' names and Importance. */
export type Candidate = {
  kind: "entry" | "task" | "checklist" | "holiday";
  /** The Entry, Task or Checklist it links to; none for a Public Holiday. */
  id: string | null;
  date: PlainDate;
  time: string | null;
  /** When a timed Entry ends that day ("24:00" when it runs past midnight), to spot clashes. */
  end?: string;
  title: string;
  /** Where an Entry takes place, so the evening Briefing can say when to leave. */
  location?: string;
  persons: string[];
  /** Who it is for, to pick a Person's Briefing; never sent to the model. Empty is Family-wide. */
  personIds: string[];
  importance: Importance;
  /**
   * Set on a Private Entry or Task: only an Account Briefing whose Account sees it in full may
   * mention it (its creator, or the Account of a Person it is for).
   */
  private?: { createdBy: string | null };
  /** A Task past its due date, or a Checklist's "3/8". */
  detail?: "overdue" | `${number}/${number}`;
  /** The title of the Entry a Task or Checklist prepares for, when that Entry is coming up. */
  prepares?: string;
  /** An Entry's Lift: who takes and who picks up (names, "" for nobody yet), and their ids. */
  lift?: { dropOff: string; pickUp: string; dropOffId: string | null; pickUpId: string | null };
};

/**
 * Which Briefing is current: the morning one from 05:00 is about today and the coming days; the
 * evening one from 19:00 is about tomorrow, what to get ready tonight and when to leave.
 */
export type Edition = "morning" | "evening";
/** The evening Briefing is written from this hour, Family time. */
export const EVENING_HOUR = 19;

/** The edition current at this many minutes past midnight, Family time. */
export function editionAt(minutes: number): Edition {
  return minutes >= EVENING_HOUR * 60 ? "evening" : "morning";
}

/**
 * What the evening Briefing tells: today's Entries are over by then, so only what is still to do
 * today, anything overdue, and from tomorrow on.
 */
export function forEdition(
  candidates: Candidate[],
  today: PlainDate,
  edition: Edition,
): Candidate[] {
  if (edition === "morning") return candidates;
  return candidates.filter((c) => c.date !== today || c.kind === "task" || c.kind === "checklist");
}

/** The Family's weather for today and tomorrow, and their hours, which the Briefing opens with. */
export type BriefingWeather = { place: string; days: DayWeather[]; hours: HourWeather[] };

/** What else the Briefing may tell besides the candidates; none of it is Private. */
export type BriefingExtras = {
  weather: BriefingWeather | null;
  /** A change of the clocks in the next 7 days. */
  clockChange: ClockChange | null;
  /** The bins collected today, to put out tonight; empty when none or none set up. */
  bins?: Bin[];
  /** Clashes and full days in the next 7 days, from this Briefing's own candidates. */
  logistics?: Logistics;
};

export const NO_EXTRAS: BriefingExtras = { weather: null, clockChange: null, bins: [] };

/** A piece of Briefing text; one with `link` opens that Entry Occurrence, Task or Checklist. */
export type Segment = {
  text: string;
  link?: { kind: "entry" | "task" | "checklist"; id: string; date: PlainDate };
};

type BriefingEntry = {
  id: string;
  title: string;
  location?: string;
  time: EntryTime;
  importance: Importance;
  private: boolean;
  createdBy?: string | null;
  personIds: string[];
  repetition: Repetition | null;
  birthdayPersonId?: string | null;
  birthYearKnown?: boolean;
  /** Who takes its Persons and who picks them up, when it needs a Lift. */
  lift?: { dropOffId: string | null; pickUpId: string | null };
  exceptions: OccurrenceException<{
    title?: string;
    location?: string;
    private?: boolean;
    personIds?: string[];
  }>[];
};

type BriefingTask = {
  id: string;
  title: string;
  dueDate: PlainDate | null;
  dueTime: string | null;
  doneAt: string | null;
  private: boolean;
  createdBy?: string | null;
  personIds: string[];
  checklistId: string | null;
  /** The Entry a loose Task prepares for. */
  entryId?: string | null;
};

type BriefingChecklist = {
  id: string;
  name: string;
  startDate: PlainDate | null;
  endDate: PlainDate | null;
  repetition?: Repetition | null;
  /** The Entry the Checklist prepares for, such as a trip. */
  entryId?: string | null;
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

/** A timed Entry without an end is taken to last this long. */
const DEFAULT_MINUTES = 60;

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(minutes: number) {
  const m = Math.min(minutes, 24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** When a timed Occurrence ends on its first day. */
function endOf(time: Extract<EntryTime, { allDay: false }>) {
  if (time.endDate && time.endDate > time.startDate) return "24:00";
  if (time.endTime && time.endTime > time.startTime) return time.endTime;
  return fromMinutes(toMinutes(time.startTime) + DEFAULT_MINUTES);
}

/**
 * What is coming up in the next 60 days, never notes: Entry
 * Occurrences (Birthdays with their age), Tasks overdue or due, Checklists still open with
 * their progress, and Public Holidays in the next 14 days. A Task or Checklist that prepares for a coming Entry says
 * which; a Checklist without a period counts on that Entry's date. The most pressing first:
 * overdue, then by date, then High Importance. Private items carry `private`, so only their own
 * Account's Briefing keeps them (forAccount); every other Briefing drops them (publicOnly).
 */
export function briefingCandidates(input: BriefingInput, max = MAX_CANDIDATES): Candidate[] {
  const { today } = input;
  const last = addDays(today, BRIEFING_DAYS - 1);
  const names = (ids: string[]) =>
    ids.map((id) => input.personNames.get(id)).filter((n): n is string => Boolean(n));
  const out: Candidate[] = [];
  /** Each coming, non-Private Entry's next date and title, for what prepares for it. */
  const coming = new Map<string, { date: PlainDate; title: string }>();

  for (const entry of input.entries) {
    for (const o of occurrencesOf(entry, today, last)) {
      const fields = { ...entry, ...o.override };
      const age = entry.birthdayPersonId
        ? birthdayAge(entry.time.startDate, o.date, Boolean(entry.birthYearKnown))
        : null;
      const date = o.time.startDate < today ? today : o.time.startDate;
      // A Private Entry's title never names a public Task's "for «…»".
      if (!fields.private && !coming.has(entry.id))
        coming.set(entry.id, { date, title: fields.title });
      out.push({
        kind: "entry",
        id: entry.id,
        date,
        time: o.time.allDay || date !== o.time.startDate ? null : o.time.startTime,
        ...(!o.time.allDay && date === o.time.startDate ? { end: endOf(o.time) } : {}),
        title: birthdayTitle(fields.title, age),
        ...(fields.location ? { location: fields.location } : {}),
        persons: names(fields.personIds),
        personIds: fields.personIds,
        importance: entry.importance,
        ...(fields.private ? { private: { createdBy: entry.createdBy ?? null } } : {}),
        ...(entry.lift
          ? {
              lift: {
                dropOff: entry.lift.dropOffId ? (names([entry.lift.dropOffId])[0] ?? "") : "",
                pickUp: entry.lift.pickUpId ? (names([entry.lift.pickUpId])[0] ?? "") : "",
                ...entry.lift,
              },
            }
          : {}),
      });
    }
  }

  for (const task of input.tasks) {
    if (task.doneAt || task.checklistId || !task.dueDate) continue;
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
      ...prepares(task.entryId),
      ...(task.private ? { private: { createdBy: task.createdBy ?? null } } : {}),
    });
  }

  for (const checklist of input.checklists) {
    const end = roundEnd(checklist) ?? (checklist.entryId && coming.get(checklist.entryId)?.date);
    if (!end || end < today || end > last) continue;
    if (checklist.startDate && checklist.startDate > today) continue;
    const tasks = input.tasks.filter((t) => t.checklistId === checklist.id);
    const { done, total } = checklistProgress(tasks);
    if (total === 0 || done === total) continue;
    out.push({
      kind: "checklist",
      id: checklist.id,
      date: end,
      time: null,
      title: checklist.name,
      persons: [],
      // Shown to a Person when any of its Tasks is theirs or Family-wide.
      personIds: tasks.some((t) => t.personIds.length === 0)
        ? []
        : [...new Set(tasks.flatMap((t) => t.personIds))],
      importance: "normal",
      detail: `${done}/${total}`,
      ...prepares(checklist.entryId),
    });
  }

  function prepares(entryId: string | null | undefined) {
    const title = entryId && coming.get(entryId)?.title;
    return title ? { prepares: title } : {};
  }

  for (const [date, holidayNames] of input.holidays) {
    if (date < today || date > addDays(today, HOLIDAY_DAYS - 1)) continue;
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

/** Everything but Private items: the Family's and each Person's Briefing, which anyone may read. */
export function publicOnly(candidates: Candidate[]): Candidate[] {
  return candidates.filter((c) => !c.private);
}

/** A Person's Briefing: what is theirs and what is Family-wide, never Private. */
export function forPerson(candidates: Candidate[], personId: string): Candidate[] {
  const filter = { personIds: [personId], familyWide: true, holidays: true, layers: [] };
  return publicOnly(candidates).filter((c) => matchesFilter(c.personIds, filter));
}

/** Who reads an Account Briefing: the Account and the Person it belongs to, if any. */
export type BriefingReader = { id: string; personId: string | null };

/**
 * An Account's own Briefing, read only on its devices: its Person's Briefing (or the Family's,
 * for an Account without a Person) plus the Private items it sees in full, which are the ones
 * it created and the ones for its Person.
 */
export function forAccount(candidates: Candidate[], reader: BriefingReader): Candidate[] {
  const filter = reader.personId
    ? { personIds: [reader.personId], familyWide: true, holidays: true, layers: [] }
    : null;
  return candidates.filter((c) => {
    if (c.private) {
      return (
        c.private.createdBy === reader.id ||
        (reader.personId !== null && c.personIds.includes(reader.personId))
      );
    }
    return !filter || matchesFilter(c.personIds, filter);
  });
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
    prepares: (title: string) => string;
    nothing: string;
  }
> = {
  "pt-PT": {
    today: "hoje",
    tomorrow: "amanhã",
    inDays: (n) => `daqui a ${n} dias`,
    overdue: (n) => (n === 1 ? "atrasada 1 dia" : `atrasada ${n} dias`),
    prepares: (title) => `para «${title}»`,
    nothing: "Nada marcado para os próximos dias.",
  },
  en: {
    today: "today",
    tomorrow: "tomorrow",
    inDays: (n) => `in ${n} days`,
    overdue: (n) => (n === 1 ? "1 day overdue" : `${n} days overdue`),
    prepares: (title) => `for "${title}"`,
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
    const prep = c.prepares ? ` ${texts.prepares(c.prepares)}` : "";
    return { text: `${c.title}${progress}${prep} · ${when} (${date})`, link: candidateLink(c) };
  });
}

/**
 * The Briefing as sentences to read aloud, one at a time: browsers cut a long utterance short. The
 * countdown list's "Title · tomorrow (Tue 27 Oct)" reads as "Title, tomorrow (Tue 27 Oct)".
 */
export function briefingSentences(segments: Segment[], fallback: boolean): string[] {
  const text = fallback
    ? segments.map((s) => s.text.replace(/\s*·\s*/g, ", ")).join("\n")
    : segments.map((s) => s.text).join("");
  return text
    .split(/\n+|(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** A day with this many Entries is a full one. */
export const FULL_DAY = 5;
/** A week with this many full days, or this many Entries, is a very full one. */
export const FULL_WEEK_DAYS = 3;
export const FULL_WEEK_ENTRIES = 20;

/** What the next 7 days need sorting out, for the Briefing to point out. */
export type Logistics = {
  /** One Person with two Entries at the same time. */
  clashes: { person: string; date: PlainDate; first: string; second: string; time: string }[];
  /**
   * An Entry only for Persons without an Account (children, mostly) while every Person with an
   * Account is busy: who takes them?
   */
  unaccompanied: { title: string; persons: string[]; date: PlainDate; time: string }[];
  /**
   * An Entry needing a Lift with nobody yet to take or pick up its Persons, or whose taker or
   * picker has something else on at that moment.
   */
  lifts: {
    title: string;
    date: PlainDate;
    time: string;
    missing: LiftRole[];
    busy: { role: LiftRole; person: string; title: string }[];
  }[];
  /** Days with at least FULL_DAY Entries. */
  fullDays: { date: PlainDate; entries: number }[];
  /** The week as a whole is very full. */
  fullWeek: boolean;
};

const overlaps = (a: Candidate, b: Candidate) =>
  a.date === b.date && a.time! < b.end! && b.time! < a.end!;

/**
 * Clashes, children left without an adult and very full days in the next 7 days, from the
 * Briefing's own candidates (so a Briefing never hints at a Private item it can't name).
 * `adults` are the Persons with an Account.
 */
export function logistics(
  candidates: Candidate[],
  today: PlainDate,
  adults: Set<string>,
): Logistics {
  const last = addDays(today, REWRITE_DAYS - 1);
  const week = candidates.filter((c) => c.kind === "entry" && c.date >= today && c.date <= last);
  const timed = week.filter((c) => c.time && c.end);
  const clashes: Logistics["clashes"] = [];
  const seen = new Set<string>();
  for (const [i, a] of timed.entries()) {
    for (const b of timed.slice(i + 1)) {
      if (!overlaps(a, b)) continue;
      for (const [k, id] of a.personIds.entries()) {
        const key = `${id}|${a.id}|${b.id}|${a.date}`;
        if (!b.personIds.includes(id) || seen.has(key)) continue;
        seen.add(key);
        const time = a.time! < b.time! ? b.time! : a.time!;
        clashes.push({
          person: a.persons[k] ?? "",
          date: a.date,
          first: a.title,
          second: b.title,
          time,
        });
      }
    }
  }
  const lifts: Logistics["lifts"] = [];
  for (const c of timed) {
    if (!c.lift) continue;
    const { lift } = c;
    const others = timed
      .filter((o) => o.date === c.date)
      .map((o) => ({
        id: o.id ?? "",
        title: o.title,
        personIds: o.personIds,
        start: o.time!,
        end: o.end!,
      }));
    const busy = liftClashes(
      { entryId: c.id ?? "", dropOffId: lift.dropOffId, pickUpId: lift.pickUpId },
      { start: c.time!, end: c.end! },
      others,
    ).map((b) => ({
      role: b.role,
      person: b.role === "dropOff" ? lift.dropOff : lift.pickUp,
      title: b.title,
    }));
    const missing = liftMissing(lift);
    if (missing.length > 0 || busy.length > 0) {
      lifts.push({ title: c.title, date: c.date, time: c.time!, missing, busy });
    }
  }
  const unaccompanied: Logistics["unaccompanied"] = [];
  if (adults.size > 0) {
    for (const c of timed) {
      if (c.personIds.length === 0 || c.personIds.some((id) => adults.has(id))) continue;
      // A Lift says who takes them: "lifts" speaks of it instead.
      if (c.lift) continue;
      const busy = [...adults].every((adult) =>
        timed.some((o) => o !== c && o.personIds.includes(adult) && overlaps(o, c)),
      );
      if (busy) {
        unaccompanied.push({ title: c.title, persons: c.persons, date: c.date, time: c.time! });
      }
    }
  }
  const perDay = new Map<PlainDate, number>();
  for (const c of week) perDay.set(c.date, (perDay.get(c.date) ?? 0) + 1);
  const fullDays = [...perDay]
    .filter(([, n]) => n >= FULL_DAY)
    .map(([date, entries]) => ({ date, entries }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    clashes,
    unaccompanied,
    lifts,
    fullDays,
    fullWeek: fullDays.length >= FULL_WEEK_DAYS || week.length >= FULL_WEEK_ENTRIES,
  };
}

/** An hour with at least this chance of rain is worth an umbrella. */
export const RAIN_LIKELY = 40;
/** Colder or hotter than this during an Entry is worth a word. */
const COLD = 5;
const HOT = 32;

/** The weather during one of the Briefing's Entries, when worth a word. */
export type EntryWeather = {
  /** The candidate's position in the list the model reads. */
  item: number;
  rain: number;
  temp: number;
  code: number;
};

/**
 * Rain likely, cold or heat during the timed Entries of the given days (today's in the morning,
 * tomorrow's in the evening): the worst hour from the Entry's start to its end. The model decides
 * which are outdoors (a training, a match, a picnic) and only mentions those.
 */
export function weatherDuring(
  candidates: Candidate[],
  hours: HourWeather[],
  dates: PlainDate[],
): EntryWeather[] {
  const out: EntryWeather[] = [];
  for (const [item, c] of candidates.entries()) {
    if (c.kind !== "entry" || !c.time || !c.end || !dates.includes(c.date)) continue;
    const start = `${c.date}T${c.time.slice(0, 2)}:00`;
    const end = `${c.date}T${c.end}`;
    const during = hours.filter((h) => h.time >= start && h.time < end);
    if (during.length === 0) continue;
    const wettest = during.reduce((a, b) => (b.rain > a.rain ? b : a));
    const temps = during.map((h) => h.temp);
    const cold = Math.min(...temps);
    const hot = Math.max(...temps);
    if (wettest.rain >= RAIN_LIKELY) {
      out.push({ item, rain: wettest.rain, temp: wettest.temp, code: wettest.code });
    } else if (cold <= COLD || hot >= HOT) {
      const temp = cold <= COLD ? cold : hot;
      out.push({ item, rain: wettest.rain, temp, code: wettest.code });
    }
  }
  return out;
}
