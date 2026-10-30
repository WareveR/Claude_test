import { daySpan, minutesOf, type ClockTime, type EntryTime } from "./entry-time";
import type { Language } from "./languages";
import { occurrencesOf, type OccurrenceException } from "./occurrences";
import { addDays, daysBetween, formatPlainDate, type PlainDate } from "./plain-date";
import type { Repetition } from "./repetition";

/** The most days one question covers, and the most things one answer reads out. */
export const MAX_QUESTION_DAYS = 14;
const MAX_SAID = 20;

const LOCALES: Record<Language, string> = { "pt-PT": "pt-PT", en: "en-GB" };

const TEXTS: Record<
  Language,
  {
    nothing: string;
    between: (from: string, to: string) => string;
    allDay: string;
    tasks: string;
    more: (n: number) => string;
    hidden: string;
    and: string;
  }
> = {
  "pt-PT": {
    nothing: "nada marcado",
    between: (from, to) => `entre as ${from} e as ${to}`,
    allDay: "todo o dia",
    tasks: "Tarefas",
    more: (n) => `e mais ${n}`,
    hidden: "Privado",
    and: " e ",
  },
  en: {
    nothing: "nothing on",
    between: (from, to) => `between ${from} and ${to}`,
    allDay: "all day",
    tasks: "Tasks",
    more: (n) => `and ${n} more`,
    hidden: "Private",
    and: " and ",
  },
};

type QuestionEntry = {
  title: string;
  time: EntryTime;
  personIds: string[];
  repetition: Repetition | null;
  exceptions: OccurrenceException<{ title?: string; personIds?: string[] }>[];
  /** Private and hidden from the one asking: said as "Private". */
  hidden: boolean;
};

type QuestionTask = {
  title: string;
  dueDate: PlainDate | null;
  dueTime: ClockTime | null;
  doneAt: string | null;
  personIds: string[];
  hidden: boolean;
};

export type Question = {
  from: PlainDate;
  to: PlainDate;
  /** A part of the day ("Friday afternoon"), or null for whole days. */
  startTime: ClockTime | null;
  endTime: ClockTime | null;
  /** Whose calendar; null for everyone. */
  personIds: string[] | null;
};

/** The days asked about: one day when no end is said, never more than two weeks. */
export function questionDays(
  date: PlainDate | null,
  endDate: PlainDate | null,
  today: PlainDate,
): { from: PlainDate; to: PlainDate } {
  const from = date ?? today;
  const to = endDate && endDate >= from ? endDate : from;
  return {
    from,
    to: daysBetween(from, to) >= MAX_QUESTION_DAYS ? addDays(from, MAX_QUESTION_DAYS - 1) : to,
  };
}

const day = (date: PlainDate, language: Language) =>
  formatPlainDate(date, LOCALES[language], { weekday: "long", day: "numeric", month: "long" });

function list(items: string[], and: string) {
  return items.length <= 1
    ? items.join("")
    : `${items.slice(0, -1).join(", ")}${and}${items.at(-1)}`;
}

/**
 * The spoken answer to "what do I have tomorrow?" or "am I free Friday afternoon?": day by day,
 * what is on (by time, with whose it is), and the Tasks due; "nothing on" when the days are empty.
 */
export function agendaAnswer(
  question: Question,
  entries: QuestionEntry[],
  tasks: QuestionTask[],
  names: (ids: string[]) => string[],
  language: Language,
): string {
  const texts = TEXTS[language];
  const window =
    question.startTime && question.endTime
      ? { start: minutesOf(question.startTime), end: minutesOf(question.endTime) }
      : null;
  const whose = (ids: string[]) =>
    question.personIds === null ||
    ids.length === 0 ||
    ids.some((id) => question.personIds!.includes(id));
  const days: string[] = [];
  let said = 0;
  let left = 0;
  for (let date = question.from; date <= question.to; date = addDays(date, 1)) {
    const on: { start: number; text: string }[] = [];
    for (const entry of entries) {
      for (const o of occurrencesOf(entry, date, date)) {
        const fields = { ...entry, ...o.override };
        if (!whose(fields.personIds)) continue;
        const title = entry.hidden ? texts.hidden : fields.title;
        const people = entry.hidden ? [] : names(fields.personIds);
        const who = people.length > 0 ? ` (${list(people, texts.and)})` : "";
        if (o.time.allDay) {
          on.push({ start: -1, text: `${title}${who}, ${texts.allDay}` });
          continue;
        }
        const span = daySpan(o.time, date);
        if (!span) continue;
        if (window && (span.end <= window.start || span.start >= window.end)) continue;
        const at =
          o.time.startDate === date
            ? o.time.startTime
            : `${String(Math.floor(span.start / 60)).padStart(2, "0")}:00`;
        on.push({ start: span.start, text: `${at} ${title}${who}` });
      }
    }
    const due = window
      ? []
      : tasks
          .filter((t) => !t.doneAt && t.dueDate === date && whose(t.personIds))
          .map((t) => (t.hidden ? texts.hidden : t.title));
    on.sort((a, b) => a.start - b.start);
    const room = Math.max(MAX_SAID - said, 0);
    const shown = on.slice(0, room).map((x) => x.text);
    left += on.length - shown.length;
    said += shown.length;
    const label = day(date, language);
    const head = window
      ? `${label}, ${texts.between(question.startTime!, question.endTime!)}`
      : label;
    const parts = [shown.length > 0 ? shown.join("; ") : on.length > 0 ? "" : texts.nothing];
    if (due.length > 0) parts.push(`${texts.tasks}: ${list(due, texts.and)}`);
    days.push(`${head}: ${parts.filter(Boolean).join(". ")}.`);
  }
  if (left > 0) days.push(`(${texts.more(left)})`);
  // Several empty days in a row read better as one.
  if (days.length > 1 && days.every((d) => d.endsWith(`: ${texts.nothing}.`))) {
    return `${day(question.from, language)} – ${day(question.to, language)}: ${texts.nothing}.`;
  }
  return days.join(" ");
}

/** "Dentist (Ana): Friday 9 October, 10:00" — the answer to "when is Ana's next dentist?". */
export function whenAnswer(
  item: { title: string; date: PlainDate | null; time: ClockTime | null; personIds: string[] },
  names: (ids: string[]) => string[],
  language: Language,
): string {
  const texts = TEXTS[language];
  const people = names(item.personIds);
  const who = people.length > 0 ? ` (${list(people, texts.and)})` : "";
  const when = item.date ? [day(item.date, language), item.time].filter(Boolean).join(", ") : "—";
  return `${item.title}${who}: ${when}.`;
}
