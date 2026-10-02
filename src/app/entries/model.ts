import { useQuery } from "@tanstack/react-query";
import type { EntryTime } from "../../core/entry-time";
import type { Importance } from "../../core/entry-type";
import type { PlainDate } from "../../core/plain-date";
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
};

export type EntryDraft = Omit<Entry, "id" | "repetition">;

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
