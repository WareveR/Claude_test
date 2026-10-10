import type { TFunction } from "i18next";
import type { ClockTime } from "../../core/entry-time";
import { addDays, formatPlainDate, type PlainDate } from "../../core/plain-date";
import type { Repetition } from "../../core/repetition";
import type { Draft } from "../../core/suggestions";
import { entryValues, type EntryValues, type TaskValues } from "../../core/voice";
import type { EntryType } from "../entry-types/model";

/** One Task or Entry on its way to being created, from an idea or from the box. */
export type Item = {
  key: string;
  kind: "task" | "entry";
  title: string;
  notes: string;
  date: PlainDate;
  time: ClockTime | null;
  repetition: Repetition | null;
  /** A bill paid by direct debit: an all-day notice with no Reminders. */
  debit: boolean;
};

/** A change made in the review to one Item's first date, time or Repetition. */
export type Edit = Partial<Pick<Item, "date" | "time" | "repetition">>;

/** An idea's draft with its title, in the device's language. */
export function itemOf(draft: Draft, t: TFunction): Item {
  const id = draft.ideaId;
  let title: string = draft.debit
    ? t("suggestions.debitTitle", { name: t(`suggestions.short.${id}`) })
    : t(`suggestions.ideas.${id}`);
  if (draft.year) title = `${title} ${draft.year}`;
  if (draft.part) title = `${title} (${t("suggestions.part", { n: draft.part.n })})`;
  return {
    key: draft.key,
    kind: draft.kind,
    title,
    notes: draft.debit ? "" : t(`suggestions.notes.${id}`, { defaultValue: "" }),
    date: draft.date,
    time: draft.time,
    repetition: draft.repetition,
    debit: Boolean(draft.debit),
  };
}

const MONDAY = "2026-10-05";

/** "Every 2 weeks on Mon, Wed · first 12 Oct 2026", or "Once, 30 Nov 2026". */
export function describeItem(
  item: Pick<Item, "date" | "time" | "repetition">,
  t: TFunction,
  locale: string,
): string {
  const date = formatPlainDate(item.date, locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const at = item.time ? ` · ${item.time}` : "";
  const rep = item.repetition;
  if (!rep) return `${t("suggestions.once", { date })}${at}`;
  const parts = [t(`suggestions.every.${rep.frequency}`, { count: rep.interval })];
  if (rep.weekdays) {
    parts.push(
      rep.weekdays
        .map((d) => formatPlainDate(addDays(MONDAY, d), locale, { weekday: "short" }))
        .join(", "),
    );
  }
  const first = t("suggestions.first", { date });
  const until =
    rep.end.type === "until"
      ? ` · ${t("suggestions.until", {
          date: formatPlainDate(rep.end.date, locale, { month: "short", year: "numeric" }),
        })}`
      : "";
  return `${parts.join(" ")}${at} · ${first}${until}`;
}

/** The body of POST /entries or POST /tasks for one Item. */
export function requestOf(
  item: Item,
  general: Pick<EntryType, "id" | "defaults">,
  today: PlainDate,
): { route: "entries"; body: EntryValues } | { route: "tasks"; body: TaskValues } {
  if (item.kind === "task") {
    return {
      route: "tasks",
      body: {
        title: item.title,
        notes: item.notes,
        dueDate: item.date,
        dueTime: item.time,
        personIds: [],
        private: false,
        repetition: item.repetition,
        checklistId: null,
      },
    };
  }
  const allDay = item.debit || !item.time;
  const values = entryValues(
    {
      kind: "entry",
      title: item.title,
      type: null,
      persons: [],
      date: item.date,
      time: allDay ? null : item.time,
      endDate: null,
      endTime: null,
      allDay,
      location: null,
      importance: item.debit ? "low" : null,
      repeat: null,
    },
    general,
    [],
    today,
  );
  return {
    route: "entries",
    body: {
      ...values,
      notes: item.notes,
      repetition: item.repetition,
      reminders: item.debit ? [] : values.reminders,
    },
  };
}
