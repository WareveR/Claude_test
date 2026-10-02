import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { birthdayAge, birthdayTitle } from "../../core/birthday";
import { occurrencesOf, type OccurrenceException } from "../../core/occurrences";
import type { EntryTime } from "../../core/entry-time";
import type { Importance } from "../../core/entry-type";
import { addDays, type PlainDate } from "../../core/plain-date";
import type { Repetition } from "../../core/repetition";
import { api } from "../api";

export type Entry = {
  id: string;
  title: string;
  entryTypeId: string;
  time: EntryTime;
  personIds: string[];
  importance: Importance;
  location: string;
  notes: string;
  icon: string | null;
  private: boolean;
  reminders: number[];
  repetition: Repetition | null;
  /** Birthday Entries: the start date carries the real birth year, so the age shows. */
  birthYearKnown?: boolean;
  seriesId?: string | null;
  /** A synced Birthday's Person; its date, title and Person change only on the Person. */
  birthdayPersonId?: string | null;
  exceptions?: OccurrenceException<Partial<EntryDraft>>[];
};

export type EntryDraft = Omit<Entry, "id" | "seriesId" | "exceptions" | "birthdayPersonId">;

/** One Occurrence of an Entry, drawn like an Entry but at its own time. */
export type Shown = Entry & { occurrenceDate: string; key: string };

/** Entries overlapping the window, both ends included. */
export function useEntries(from: PlainDate, to: PlainDate) {
  return useQuery({
    queryKey: ["entries", from, to],
    queryFn: () => api<Entry[]>(`/entries?from=${from}&to=${to}`),
  });
}

export function useEntry(id: string | undefined) {
  return useQuery({
    queryKey: ["entry", id],
    queryFn: () => api<Entry>(`/entries/${id}`),
    enabled: Boolean(id),
  });
}

/** The Occurrences of every Entry touching the window, expanded in the browser. */
export function useOccurrences(from: PlainDate, to: PlainDate) {
  const entries = useEntries(from, to);
  const shown = useMemo(
    () =>
      (entries.data ?? []).flatMap((entry) =>
        occurrencesOf(entry, from, to).map((o): Shown => ({
          ...entry,
          title: birthdayTitle(
            entry.title,
            birthdayAge(entry.time.startDate, o.date, Boolean(entry.birthYearKnown)),
          ),
          time: o.time,
          occurrenceDate: o.date,
          key: `${entry.id}:${o.date}`,
        })),
      ),
    [entries.data, from, to],
  );
  return { ...entries, data: entries.data ? shown : undefined };
}

/** Where an Entry opens: a repeating one names its Occurrence. */
export function entryPath(entry: Entry | Shown): string {
  return entry.repetition && "occurrenceDate" in entry
    ? `/entries/${entry.id}?occurrence=${entry.occurrenceDate}`
    : `/entries/${entry.id}`;
}

/** The values one Occurrence shows: the series with that Occurrence's own changes. */
export function occurrenceValues(entry: Entry, date: PlainDate): Entry | null {
  const [occurrence] = occurrencesOf(entry, addDays(date, -40), addDays(date, 40)).filter(
    (o) => o.date === date,
  );
  return occurrence ? { ...entry, ...occurrence.override, time: occurrence.time } : null;
}
