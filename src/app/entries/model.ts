import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { birthdayAge, birthdayTitle } from "../../core/birthday";
import { occurrencesOf, type OccurrenceException } from "../../core/occurrences";
import type { EntryTime } from "../../core/entry-time";
import type { Importance } from "../../core/entry-type";
import { moveStart } from "../../core/entry-time";
import { addDays, daysBetween, type PlainDate } from "../../core/plain-date";
import type { Repetition } from "../../core/repetition";
import { api, RANGE_STALE_TIME } from "../api";
import i18n from "../i18n";
import { fromList } from "../offline/from-list";
import type { Scope } from "./ScopeDialog";

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
  /** Private and not this Account's to see: only its time and Persons came. */
  hidden?: boolean;
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
export type Shown = Entry & {
  occurrenceDate: string;
  key: string;
  /** Where it opens when it isn't an Entry, such as a Checklist's period bar. */
  href?: string;
};

/** A hidden Private Entry, and an Occurrence of one edited alone to be Private, read "Private". */
export function nameHidden(entry: Entry): Entry {
  const name = i18n.t("entries.private");
  const exceptions = entry.exceptions?.map((e) =>
    (e.override as { hidden?: boolean } | null)?.hidden
      ? { ...e, override: { ...e.override, title: name } }
      : e,
  );
  return { ...entry, title: entry.hidden ? name : entry.title, exceptions };
}

/** The query that holds the Entries overlapping a window. */
export const entriesKey = (from: PlainDate, to: PlainDate) => ["entries", from, to];

/** The request for the Entries overlapping a window: shared by the views and their prefetching. */
export function entriesQuery(from: PlainDate, to: PlainDate) {
  return queryOptions({
    queryKey: entriesKey(from, to),
    queryFn: async () => (await api<Entry[]>(`/entries?from=${from}&to=${to}`)).map(nameHidden),
    staleTime: RANGE_STALE_TIME,
  });
}

/** Entries overlapping the window, both ends included. */
export function useEntries(from: PlainDate, to: PlainDate) {
  return useQuery(entriesQuery(from, to));
}

export function useEntry(id: string | undefined) {
  const queryClient = useQueryClient();
  // The calendar already holds the Entry: it shows at once while its own request runs.
  const listed = () => fromList<Entry>(queryClient, ["entries"], id);
  return useQuery({
    queryKey: ["entry", id],
    queryFn: async () => nameHidden(await api<Entry>(`/entries/${id}`)),
    enabled: Boolean(id),
    initialData: () => listed()?.data,
    initialDataUpdatedAt: () => listed()?.updatedAt,
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
  if ("href" in entry && entry.href) return entry.href;
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

/**
 * Saves an edited Entry. A repeating Entry's change applies to the Occurrence it was made on,
 * to it and the following, or to every Occurrence.
 */
export function saveEntry(
  entry: Entry,
  draft: EntryDraft,
  occurrence: { date: PlainDate; scope: Scope } | null,
) {
  const at = `/entries/${entry.id}`;
  if (!occurrence) return api(at, { method: "PUT", body: draft });
  const { date, scope } = occurrence;
  if (scope === "this") {
    return api(`${at}/occurrences/${date}`, {
      method: "PUT",
      body: { ...draft, repetition: null },
    });
  }
  if (scope === "following") {
    return api(`${at}/following/${date}`, { method: "POST", body: draft });
  }
  // "All": move the series by however far this Occurrence was moved.
  const shift = daysBetween(date, draft.time.startDate);
  const time = moveStart(draft.time, addDays(entry.time.startDate, shift));
  return api(at, { method: "PUT", body: { ...draft, time } });
}
