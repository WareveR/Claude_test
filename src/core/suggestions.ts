import type { ClockTime } from "./entry-time";
import { addDays, addMonths, daysInMonth, weekday, type PlainDate } from "./plain-date";
import type { Repetition } from "./repetition";
import { parseVoiceFields } from "./voice";

/**
 * Suggestions: a catalogue of things that repeat in a Portuguese family's life, grouped by area,
 * that the Family ticks to fill the calendar in one go. Nothing here saves; each ticked idea
 * becomes one or more drafts the Family reviews before they are created as Tasks or Entries.
 */
export const AREAS = [
  "car",
  "home",
  "bills",
  "paperwork",
  "health",
  "school",
  "pets",
  "routine",
] as const;
export type Area = (typeof AREAS)[number];

/** How much a yearly tax comes to, which decides how many instalments it is paid in. */
export const BANDS = ["upTo100", "upTo500", "over500"] as const;
export type Band = (typeof BANDS)[number];

/** A bill paid by hand is a Task to tick; one paid by direct debit is only a notice. */
export type Payment = "manual" | "debit";

type Rule =
  /** Due on this day every year (month 1 = January). */
  | { type: "yearly"; month: number; day: number }
  /** Due on this day every month; a missing day falls on the month's last day. */
  | { type: "monthly"; day: number }
  /** Every N months from the 1st of next month. */
  | { type: "everyMonths"; months: number }
  /** On these weekdays (Monday = 0), at a time for an Entry. */
  | { type: "weekly"; weekdays: number[]; time: ClockTime | null }
  | { type: "iuc" }
  | { type: "inspection" }
  | { type: "imi" }
  /** Once, a month before a document's expiry date. */
  | { type: "expiry" };

export type Idea = {
  id: string;
  area: Area;
  /** A Task is something to do by a date; an Entry happens at a time. */
  kind: "task" | "entry";
  /** A bill: paid by hand or by direct debit. */
  bill?: boolean;
  rule: Rule;
};

const yearly = (month: number, day = 1): Rule => ({ type: "yearly", month, day });
const monthly = (day: number): Rule => ({ type: "monthly", day });
const weekly = (weekdays: number[], time: ClockTime | null = null): Rule => ({
  type: "weekly",
  weekdays,
  time,
});

export const IDEAS: Idea[] = [
  { id: "iuc", area: "car", kind: "task", bill: true, rule: { type: "iuc" } },
  { id: "inspection", area: "car", kind: "task", rule: { type: "inspection" } },
  { id: "carInsurance", area: "car", kind: "task", bill: true, rule: yearly(3) },
  { id: "carService", area: "car", kind: "task", rule: yearly(4) },
  { id: "tyres", area: "car", kind: "task", rule: monthly(1) },
  { id: "imi", area: "home", kind: "task", bill: true, rule: { type: "imi" } },
  { id: "homeInsurance", area: "home", kind: "task", bill: true, rule: yearly(1) },
  { id: "condominium", area: "home", kind: "task", bill: true, rule: monthly(8) },
  { id: "boiler", area: "home", kind: "task", rule: yearly(10) },
  { id: "chimney", area: "home", kind: "task", rule: yearly(9) },
  { id: "blinds", area: "home", kind: "task", rule: yearly(4) },
  { id: "radiators", area: "home", kind: "task", rule: yearly(10, 15) },
  { id: "gutters", area: "home", kind: "task", rule: yearly(11) },
  { id: "smokeAlarm", area: "home", kind: "task", rule: yearly(10, 25) },
  { id: "airCon", area: "home", kind: "task", rule: yearly(5) },
  { id: "electricity", area: "bills", kind: "task", bill: true, rule: monthly(20) },
  { id: "water", area: "bills", kind: "task", bill: true, rule: monthly(15) },
  { id: "gas", area: "bills", kind: "task", bill: true, rule: monthly(20) },
  { id: "internet", area: "bills", kind: "task", bill: true, rule: monthly(5) },
  { id: "rent", area: "bills", kind: "task", bill: true, rule: monthly(1) },
  { id: "schoolFees", area: "bills", kind: "task", bill: true, rule: monthly(8) },
  { id: "gymFees", area: "bills", kind: "task", bill: true, rule: monthly(1) },
  { id: "irs", area: "paperwork", kind: "task", rule: yearly(6, 30) },
  { id: "idCard", area: "paperwork", kind: "task", rule: { type: "expiry" } },
  { id: "drivingLicence", area: "paperwork", kind: "task", rule: { type: "expiry" } },
  { id: "passport", area: "paperwork", kind: "task", rule: { type: "expiry" } },
  { id: "healthInsurance", area: "paperwork", kind: "task", bill: true, rule: yearly(1) },
  { id: "dentist", area: "health", kind: "task", rule: yearly(2) },
  { id: "gp", area: "health", kind: "task", rule: yearly(1) },
  { id: "eyes", area: "health", kind: "task", rule: yearly(6) },
  { id: "bloodTests", area: "health", kind: "task", rule: yearly(2) },
  { id: "vaccines", area: "health", kind: "task", rule: yearly(9) },
  { id: "enrolment", area: "school", kind: "task", rule: yearly(6) },
  { id: "textbooks", area: "school", kind: "task", rule: yearly(7) },
  { id: "schoolSupplies", area: "school", kind: "task", rule: yearly(8) },
  { id: "activities", area: "school", kind: "task", rule: yearly(9) },
  { id: "rabies", area: "pets", kind: "task", rule: yearly(5) },
  { id: "deworming", area: "pets", kind: "task", rule: { type: "everyMonths", months: 3 } },
  { id: "vet", area: "pets", kind: "task", rule: yearly(3) },
  { id: "gym", area: "routine", kind: "entry", rule: weekly([0, 2], "19:00") },
  { id: "groceries", area: "routine", kind: "entry", rule: weekly([1, 3], "10:00") },
  { id: "swimming", area: "routine", kind: "entry", rule: weekly([5], "10:00") },
  { id: "catechism", area: "routine", kind: "entry", rule: weekly([5], "15:00") },
  { id: "music", area: "routine", kind: "entry", rule: weekly([2], "18:00") },
  { id: "scouts", area: "routine", kind: "entry", rule: weekly([5], "14:30") },
  { id: "plants", area: "routine", kind: "task", rule: weekly([2, 5]) },
  { id: "sheets", area: "routine", kind: "task", rule: weekly([6]) },
  { id: "cleaning", area: "routine", kind: "task", rule: weekly([5]) },
];

/** What the Family answered once for a whole area. */
export type Answers = {
  /** The car's first registration date ("data da matrícula"). */
  registration: PlainDate | null;
  iucBand: Band;
  imiBand: Band;
  /** When each document expires, by idea id. */
  expiry: Record<string, PlainDate | null>;
};

/** One Task or Entry to be created; the browser gives it its title in the device's language. */
export type Draft = {
  key: string;
  ideaId: string;
  kind: "task" | "entry";
  date: PlainDate;
  time: ClockTime | null;
  repetition: Repetition | null;
  /** One instalment of a tax paid in several. */
  part?: { n: number; of: number };
  /** A bill paid by direct debit: an all-day notice, nothing to tick. */
  debit?: boolean;
  /** For "Pagar IUC 2027" and the like, when only one year follows that rule. */
  year?: number;
};

const NEVER = { type: "never" } as const;
const every = (
  frequency: Repetition["frequency"],
  interval = 1,
  end: Repetition["end"] = NEVER,
): Repetition => ({ frequency, interval, end });

function make(year: number, month: number, day: number): PlainDate {
  const d = Math.min(day, daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const lastDay = (year: number, month: number) => make(year, month, 31);

/** The first date on or after `from` that falls on this day of the year. */
function nextYearly(month: number, day: number, from: PlainDate): PlainDate {
  const year = Number(from.slice(0, 4));
  const date = make(year, month, day);
  return date >= from ? date : make(year + 1, month, day);
}

/** The first date on or after `from` that falls on this day of the month. */
function nextMonthly(day: number, from: PlainDate): PlainDate {
  const [y, m] = from.split("-").map(Number);
  const date = make(y, m, day);
  if (date >= from) return date;
  const [ny, nm] = addMonths(make(y, m, 1), 1)
    .split("-")
    .map(Number);
  return make(ny, nm, day);
}

/** The first date on or after `from` that falls on one of these weekdays. */
export function nextWeekday(weekdays: number[], from: PlainDate): PlainDate {
  for (let k = 0; k < 7; k++) {
    const date = addDays(from, k);
    if (weekdays.includes(weekday(date))) return date;
  }
  return from;
}

/**
 * IUC (Imposto Único de Circulação). Until 2026 it is paid by the end of the registration month.
 * Decree-Law 161/2026 moves it: in 2027 it is paid in October, or July and October above €500;
 * from 2028 in April, April and October above €100, or April, July and October above €500.
 */
export function iucDates(
  registration: PlainDate | null,
  band: Band,
  today: PlainDate,
): Omit<Draft, "key" | "ideaId" | "kind">[] {
  const out: Omit<Draft, "key" | "ideaId" | "kind">[] = [];
  if (registration) {
    const due = lastDay(2026, Number(registration.slice(5, 7)));
    if (due >= today) out.push({ date: due, time: null, repetition: null, year: 2026 });
  }
  const in2027 = band === "over500" ? [7, 10] : [10];
  in2027.forEach((month, i) => {
    const due = lastDay(2027, month);
    if (due >= today) {
      out.push({
        date: due,
        time: null,
        repetition: null,
        year: 2027,
        ...(in2027.length > 1 ? { part: { n: i + 1, of: in2027.length } } : {}),
      });
    }
  });
  const from2028 = band === "upTo100" ? [4] : band === "upTo500" ? [4, 10] : [4, 7, 10];
  const start = today > "2028-01-01" ? today : "2028-01-01";
  from2028.forEach((month, i) => {
    out.push({
      date: nextYearly(month, 31, start),
      time: null,
      repetition: every("yearly"),
      ...(from2028.length > 1 ? { part: { n: i + 1, of: from2028.length } } : {}),
    });
  });
  return out;
}

/**
 * Periodic inspection of a passenger car (Decree-Law 144/2012): first by the 4th anniversary of
 * its registration, then every 2 years until it is 8, then every year.
 */
export function inspectionDates(
  registration: PlainDate,
  today: PlainDate,
): Omit<Draft, "key" | "ideaId" | "kind">[] {
  const [y, m, d] = registration.split("-").map(Number);
  const at = (age: number) => make(y + age, m, d);
  const yearlyFrom = (age: number) => {
    let a = age;
    while (at(a) < today) a++;
    return { date: at(a), time: null, repetition: every("yearly") };
  };
  for (const age of [4, 6, 8]) {
    if (at(age) < today) continue;
    const biennial = {
      date: at(age),
      time: null,
      repetition: every("yearly", 2, { type: "until", date: at(8) }),
    };
    return age === 8 ? [yearlyFrom(8)] : [biennial, yearlyFrom(9)];
  }
  return [yearlyFrom(9)];
}

/** IMI (Imposto Municipal sobre Imóveis): May, May and November above €100, or May, August and November above €500. */
export function imiDates(band: Band, today: PlainDate): Omit<Draft, "key" | "ideaId" | "kind">[] {
  const months = band === "upTo100" ? [5] : band === "upTo500" ? [5, 11] : [5, 8, 11];
  return months.map((month, i) => ({
    date: nextYearly(month, 31, today),
    time: null,
    repetition: every("yearly"),
    ...(months.length > 1 ? { part: { n: i + 1, of: months.length } } : {}),
  }));
}

/** What one ticked idea becomes; empty while an answer it needs is missing. */
export function draftsFor(
  idea: Idea,
  payment: Payment,
  answers: Answers,
  today: PlainDate,
): Draft[] {
  const rule = idea.rule;
  let dates: Omit<Draft, "key" | "ideaId" | "kind">[];
  switch (rule.type) {
    case "yearly":
      dates = [
        { date: nextYearly(rule.month, rule.day, today), time: null, repetition: every("yearly") },
      ];
      break;
    case "monthly":
      dates = [{ date: nextMonthly(rule.day, today), time: null, repetition: every("monthly") }];
      break;
    case "everyMonths":
      dates = [
        {
          date: addMonths(`${today.slice(0, 8)}01`, 1),
          time: null,
          repetition: every("monthly", rule.months),
        },
      ];
      break;
    case "weekly":
      dates = [
        {
          date: nextWeekday(rule.weekdays, today),
          time: rule.time,
          repetition: { ...every("weekly"), weekdays: [...rule.weekdays] },
        },
      ];
      break;
    case "iuc":
      dates = iucDates(answers.registration, answers.iucBand, today);
      break;
    case "inspection":
      dates = answers.registration ? inspectionDates(answers.registration, today) : [];
      break;
    case "imi":
      dates = imiDates(answers.imiBand, today);
      break;
    case "expiry": {
      const expiry = answers.expiry[idea.id];
      const due = expiry ? addMonths(expiry, -1) : null;
      dates = due && due >= today ? [{ date: due, time: null, repetition: null }] : [];
      break;
    }
  }
  const debit = Boolean(idea.bill) && payment === "debit";
  return dates.map((d, i) => ({
    ...d,
    key: `${idea.id}:${i}`,
    ideaId: idea.id,
    kind: debit ? "entry" : idea.kind,
    ...(debit ? { debit: true } : {}),
  }));
}

const normalise = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Words that name a whole area, in both v1 languages, already free of accents. */
const THEMES: Record<string, Area> = {
  carro: "car",
  carros: "car",
  automovel: "car",
  mota: "car",
  car: "car",
  cars: "car",
  casa: "home",
  manutencao: "home",
  home: "home",
  house: "home",
  contas: "bills",
  faturas: "bills",
  pagamentos: "bills",
  bills: "bills",
  papelada: "paperwork",
  documentos: "paperwork",
  impostos: "paperwork",
  financas: "paperwork",
  paperwork: "paperwork",
  documents: "paperwork",
  taxes: "paperwork",
  saude: "health",
  medicos: "health",
  consultas: "health",
  health: "health",
  escola: "school",
  filhos: "school",
  miudos: "school",
  aulas: "school",
  school: "school",
  kids: "school",
  animais: "pets",
  cao: "pets",
  caes: "pets",
  gato: "pets",
  gatos: "pets",
  pets: "pets",
  dog: "pets",
  cat: "pets",
  rotina: "routine",
  semana: "routine",
  "dia a dia": "routine",
  routine: "routine",
  week: "routine",
};

const ARTICLES = /^(o|a|os|as|um|uma|the|my|o meu|a minha|os meus|as minhas) /;

/** The area a short phrase names as a whole ("carro", "o cão", "pets"), or null. */
export function themeOf(phrase: string): Area | null {
  const text = normalise(phrase).replace(ARTICLES, "");
  return THEMES[text] ?? null;
}

/** The longest text the free-text box takes, and the most phrases read at once. */
export const MAX_TEXT = 1000;
export const MAX_PHRASES = 20;

/** Splits what was written or said into phrases: one per comma, semicolon or line. */
export function phrasesOf(text: string): string[] {
  return text
    .split(/[,;\n]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, MAX_PHRASES);
}

/** Something written in the free-text box, as the model read it. */
export type WrittenDraft = {
  kind: "task" | "entry";
  title: string;
  date: PlainDate;
  time: ClockTime | null;
  repetition: Repetition | null;
};

/** The model's list checked item by item: a bad item is dropped, a bad field left out. */
export function parseWritten(value: unknown, today: PlainDate): WrittenDraft[] | null {
  const items = (value as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return null;
  const out: WrittenDraft[] = [];
  for (const item of items.slice(0, 40)) {
    if (typeof item !== "object" || item === null) continue;
    const v = item as Record<string, unknown>;
    if (v.kind !== "entry" && v.kind !== "task") continue;
    const f = parseVoiceFields(v, 0, 0);
    if (!f.title) continue;
    const repetition: Repetition | null = f.repeat
      ? {
          frequency: f.repeat.frequency,
          interval: f.repeat.interval,
          ...(f.repeat.weekdays ? { weekdays: f.repeat.weekdays } : {}),
          end: NEVER,
        }
      : null;
    const from = f.date && f.date >= today ? f.date : today;
    const date = repetition?.weekdays ? nextWeekday(repetition.weekdays, from) : from;
    out.push({ kind: v.kind, title: f.title, date, time: f.time, repetition });
  }
  return out;
}
