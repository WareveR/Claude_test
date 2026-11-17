import { isClockTime, type ClockTime } from "./entry-time";
import { addDays, daysBetween, isPlainDate, type PlainDate } from "./plain-date";

/**
 * A Medication one Person takes: what, how much, at which times of day, from when to when.
 * Private by default: seen in full only by whoever added it and the Accounts of its Person.
 */
export type Medication = {
  id: string;
  personId: string;
  name: string;
  /** "1 comprimido", "5 ml". */
  dose: string;
  /** The times of day it is taken, in order. */
  times: ClockTime[];
  startDate: PlainDate;
  /** The last day of the treatment; null goes on until changed. */
  endDate: PlainDate | null;
  private: boolean;
  notes: string;
  createdBy: string | null;
  createdAt: string;
  changedAt: string;
};

export type MedicationInput = Pick<
  Medication,
  "personId" | "name" | "dose" | "times" | "startDate" | "endDate" | "private" | "notes"
>;

/** One dose taken, by the date and time it was due. */
export type Dose = { medicationId: string; date: PlainDate; time: ClockTime; takenAt: string };

export const MAX_TIMES = 8;
const MAX_TEXT = 100;
const MAX_NOTES = 1000;
/** The longest a treatment may be set for; longer ones run without an end. */
const MAX_DAYS = 3660;

/** A Medication as sent by the browser, cleaned; or the first bad field. */
export function parseMedication(
  body: Record<string, unknown>,
): { medication: MedicationInput } | { field: string } {
  const text = (key: string, max: number) => {
    const value = body[key] ?? "";
    return typeof value === "string" && value.trim().length <= max ? value.trim() : null;
  };
  if (typeof body.personId !== "string" || !body.personId) return { field: "personId" };
  const name = text("name", MAX_TEXT);
  if (!name) return { field: "name" };
  const dose = text("dose", MAX_TEXT);
  if (dose === null) return { field: "dose" };
  const times = body.times;
  if (
    !Array.isArray(times) ||
    times.length === 0 ||
    times.length > MAX_TIMES ||
    !times.every((t) => isClockTime(t))
  ) {
    return { field: "times" };
  }
  const startDate = body.startDate;
  if (typeof startDate !== "string" || !isPlainDate(startDate)) return { field: "startDate" };
  const endDate = body.endDate ?? null;
  if (
    endDate !== null &&
    (typeof endDate !== "string" ||
      !isPlainDate(endDate) ||
      endDate < startDate ||
      daysBetween(startDate, endDate) > MAX_DAYS)
  ) {
    return { field: "endDate" };
  }
  const notes = text("notes", MAX_NOTES);
  if (notes === null) return { field: "notes" };
  return {
    medication: {
      personId: body.personId,
      name,
      dose,
      times: [...new Set(times as ClockTime[])].sort(),
      startDate,
      endDate: endDate as PlainDate | null,
      private: body.private === undefined ? true : Boolean(body.private),
      notes,
    },
  };
}

/** One dose due: a Medication at one date and time. */
export type DueDose = { medication: Medication; date: PlainDate; time: ClockTime };

/** The doses due on a day, by time. */
export function dosesOn(medications: Medication[], date: PlainDate): DueDose[] {
  return medications
    .filter((m) => m.startDate <= date && (m.endDate === null || m.endDate >= date))
    .flatMap((medication) => medication.times.map((time) => ({ medication, date, time })))
    .sort(
      (a, b) => a.time.localeCompare(b.time) || a.medication.name.localeCompare(b.medication.name),
    );
}

/** The doses due after `from` and up to `to`, both wall-clock moments ("2026-11-17T08:00"). */
export function dosesBetween(medications: Medication[], from: string, to: string): DueDose[] {
  const [first, last] = [from.slice(0, 10), to.slice(0, 10)];
  const out: DueDose[] = [];
  for (let date = first; date <= last; date = addDays(date, 1)) {
    for (const dose of dosesOn(medications, date)) {
      const at = `${date}T${dose.time}`;
      if (at > from && at <= to) out.push(dose);
    }
  }
  return out;
}

const REMINDER_TEXTS = {
  "pt-PT": {
    hidden: (time: string) => `Medicação às ${time}`,
    shown: (what: string, who: string, time: string) => `${what} · ${who} às ${time}`,
    taken: "Tomado",
  },
  en: {
    hidden: (time: string) => `Medication at ${time}`,
    shown: (what: string, who: string, time: string) => `${what} · ${who} at ${time}`,
    taken: "Taken",
  },
} as const;

/**
 * What a dose's Reminder says. A Private one names nothing, since a notification shows on a
 * locked screen; an open one names the Medication, its dose and its Person.
 */
export function doseReminder(
  due: DueDose,
  personName: string,
  language: "pt-PT" | "en",
): { title: string; taken: string } {
  const texts = REMINDER_TEXTS[language];
  const { medication, time } = due;
  const what = [medication.name, medication.dose].filter(Boolean).join(" ");
  return {
    title: medication.private ? texts.hidden(time) : texts.shown(what, personName, time),
    taken: texts.taken,
  };
}
