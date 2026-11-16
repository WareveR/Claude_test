// Voice commands about Tasks: items added to or ticked on a list, and moving overdue Tasks.
import { MAX_TEMPLATE_ITEMS, MAX_TEMPLATE_TEXT } from "../../core/checklist-template";
import type { Language } from "../../core/languages";
import { formatPlainDate, isPlainDate } from "../../core/plain-date";
import { familyNow, isOverdue } from "../../core/task";
import { randomId } from "../auth/crypto";
import { LOCALES, type Plan, type VoiceState } from "./helpers";

const ITEMS_TEXTS: Record<Language, { add: string; done: string; on: (name: string) => string }> = {
  "pt-PT": { add: "juntar", done: "feito", on: (name) => `Em ${name}` },
  en: { add: "add", done: "done", on: (name) => `On ${name}` },
};

/** Items to add to, or tick on, one of the Tasks with items. */
export function checklistItemsCommand({ answer, checklists, language, failed }: VoiceState) {
  const index = answer.checklist;
  const list =
    Number.isInteger(index) && (index as number) >= 0 ? checklists[index as number] : undefined;
  if (!list) return { outcome: "notFound" as const };
  const strings = (v: unknown) =>
    Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
  const known = (s: string) => s.trim().toLocaleLowerCase();
  const add = [
    ...new Set(
      strings(answer.items)
        .map((s) => s.trim().slice(0, MAX_TEMPLATE_TEXT))
        .filter((s) => s && !list.items.some((i) => known(i.title) === known(s))),
    ),
  ].slice(0, MAX_TEMPLATE_ITEMS);
  const tick = list.items.filter(
    (i) => !i.doneAt && strings(answer.tick).some((s) => known(s) === known(i.title)),
  );
  if (add.length === 0 && tick.length === 0) return failed;
  const ids = add.map(() => randomId());
  const texts = ITEMS_TEXTS[language];
  const plan: Omit<Plan, "kind"> & { kind: "checklist" } = {
    kind: "checklist",
    id: list.id,
    date: null,
    label: list.name,
    summary: `${texts.on(list.name)}: ${[
      add.length > 0 ? `${texts.add} ${add.join(", ")}` : "",
      tick.length > 0 ? `${texts.done} ${tick.map((i) => i.title).join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("; ")}`,
    scope: "all",
    apply: {
      all: [
        ...(add.length > 0
          ? [
              {
                method: "POST" as const,
                path: `/checklists/${list.id}/items`,
                body: { items: add, ids },
              },
            ]
          : []),
        ...tick.map((i) => ({ method: "POST" as const, path: `/tasks/${i.id}/done` })),
      ],
    },
    undo: [
      ...tick.map((i) => ({ method: "DELETE" as const, path: `/tasks/${i.id}/done` })),
      ...ids.map((id) => ({ method: "DELETE" as const, path: `/tasks/${id}` })),
    ],
  };
  return { outcome: "change" as const, plan };
}

/** Moves every overdue Task to a day, with Undo. */
export function overdueCommand({ answer, family, now, tasks, today, language }: VoiceState) {
  const clock = familyNow(family.timeZone, now);
  const late = tasks.filter((t) => !t.checklistId && isOverdue(t, clock));
  if (late.length === 0) return { outcome: "noneOverdue" as const };
  const date =
    typeof answer.date === "string" && isPlainDate(answer.date) && answer.date >= today
      ? answer.date
      : today;
  const body = (t: (typeof late)[number], dueDate: string) => ({
    title: t.title,
    notes: t.notes,
    dueDate,
    dueTime: t.dueTime,
    personIds: t.personIds,
    private: t.private,
    importance: t.importance,
    repetition: t.repetition,
    checklistId: t.checklistId,
    parentId: t.parentId,
    entryId: t.entryId,
  });
  const when = formatPlainDate(date, LOCALES[language], {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const plan: Omit<Plan, "kind"> & { kind: "task" } = {
    kind: "task",
    id: late.map((t) => t.id).join(","),
    date: null,
    label: late.map((t) => t.title).join(", "),
    summary: `${language === "en" ? "Move to" : "Passar para"} ${when}: ${late.map((t) => t.title).join(", ")}`,
    scope: "all",
    apply: {
      all: late.map((t) => ({
        method: "PUT" as const,
        path: `/tasks/${t.id}`,
        body: body(t, date),
      })),
    },
    undo: late.map((t) => ({
      method: "PUT" as const,
      path: `/tasks/${t.id}`,
      body: body(t, t.dueDate!),
    })),
  };
  return { outcome: "change" as const, plan };
}
