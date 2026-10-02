import { useMemo } from "react";
import { checklistProgress } from "../../core/checklist";
import type { PlainDate } from "../../core/plain-date";
import type { Shown } from "../entries/model";
import type { EntryType } from "../entry-types/model";
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

/** Each Checklist period touching the window as an all-day bar ("Summer cleaning 3/8"). */
export function useChecklistBars(from: PlainDate, to: PlainDate): Shown[] {
  const checklists = useChecklists().data;
  const tasks = useTasks().data;
  return useMemo(
    () =>
      (checklists ?? [])
        .filter((c) => c.startDate && c.endDate && c.startDate <= to && c.endDate >= from)
        .map((c) => {
          const { done, total } = checklistProgress(
            (tasks ?? []).filter((t) => t.checklistId === c.id),
          );
          return {
            id: c.id,
            key: `checklist:${c.id}`,
            href: `/checklists/${c.id}`,
            occurrenceDate: c.startDate!,
            title: `${c.name} ${done}/${total}`,
            entryTypeId: CHECKLIST_BAR_TYPE.id,
            time: { allDay: true, startDate: c.startDate!, endDate: c.endDate! },
            personIds: [],
            importance: "normal",
            location: "",
            notes: "",
            icon: null,
            private: false,
            reminders: [],
            repetition: null,
          } satisfies Shown;
        }),
    [checklists, tasks, from, to],
  );
}
