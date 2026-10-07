import { useMemo } from "react";
import { checklistProgress, checklistSpans } from "../../core/checklist";
import { checklistMatches } from "../../core/person-filter";
import type { PlainDate } from "../../core/plain-date";
import type { Shown } from "../entries/model";
import type { EntryType } from "../entry-types/model";
import { usePersonFilter } from "../filter/model";
import { useTasks } from "../tasks/model";
import { useChecklists } from "./model";

/** Checklist period bars borrow the Entry drawing with a neutral colour of their own. */
export const CHECKLIST_BAR_TYPE: EntryType = {
  id: "checklist",
  builtinKey: null,
  name: null,
  color: "#607d8b",
  icon: "house",
  thumbnailKey: null,
  defaults: {},
  deletable: false,
};

/**
 * Each Checklist touching the window as an all-day bar ("Summer cleaning 3/8"): a repeating one
 * on each of its rounds' days, not across the whole time.
 */
export function useChecklistBars(from: PlainDate, to: PlainDate): Shown[] {
  const checklists = useChecklists().data;
  const tasks = useTasks().data;
  const filter = usePersonFilter();
  return useMemo(
    () =>
      (checklists ?? [])
        .map((c) => ({ c, own: (tasks ?? []).filter((t) => t.checklistId === c.id) }))
        .filter(({ own }) =>
          checklistMatches(
            own.map((t) => t.personIds),
            filter,
          ),
        )
        .flatMap(({ c, own }) => {
          const { done, total } = checklistProgress(own);
          return checklistSpans(c, from, to).map(
            (span) =>
              ({
                id: c.id,
                key: `checklist:${c.id}:${span.startDate}`,
                href: `/checklists/${c.id}`,
                occurrenceDate: span.startDate,
                title: `${c.name} ${done}/${total}`,
                entryTypeId: CHECKLIST_BAR_TYPE.id,
                time: { allDay: true, startDate: span.startDate, endDate: span.endDate },
                personIds: [],
                importance: "normal",
                location: "",
                notes: "",
                icon: null,
                private: false,
                reminders: [],
                repetition: null,
              }) satisfies Shown,
          );
        }),
    [checklists, tasks, filter, from, to],
  );
}
