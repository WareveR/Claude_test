// Voice commands that create a new Entry or Task, from one sentence or several.
import { checklistFromTask } from "../../core/checklist";
import { MAX_TEMPLATE_ITEMS, templateText } from "../../core/checklist-template";
import {
  entryValues,
  parseVoiceCreate,
  taskValues,
  voiceSummary,
  type VoiceCreate,
} from "../../core/voice";
import type { VoiceState } from "./helpers";

/** At most this many further Entries or Tasks come from one sentence, after the first. */
const MAX_MORE = 4;

export function createCommand({
  answer,
  active,
  types,
  templates,
  today,
  language,
  names,
  failed,
}: VoiceState) {
  const create = parseVoiceCreate(answer, active.length, types.length, templates.length);
  if (!create) return failed;
  const general = types.find((t) => t.builtinKey === "general") ?? types[0];
  /** One new Entry or Task, as the browser sends it, and how it reads back. */
  const proposal = (create: VoiceCreate) => {
    const personIds = create.persons.map((i) => active[i].id);
    if (create.kind === "task") {
      const values = taskValues(create, personIds);
      const template = create.list == null ? null : templates[create.list];
      const own = create.items ?? [];
      const list = template ? templateText(template, language) : null;
      const summary = voiceSummary(
        "task",
        {
          ...values,
          date: values.dueDate,
          time: list || own.length > 0 ? null : values.dueTime,
          allDay: false,
          list: list?.name,
          items: own.length,
        },
        names(values.personIds),
        language,
      );
      if (!list && own.length === 0) return { kind: "task" as const, values, summary };
      // A Task with items is kept as a Checklist (ADR 0008); Edit opens the Task form with them.
      const items = [...new Set([...(list?.items ?? []), ...own])].slice(0, MAX_TEMPLATE_ITEMS);
      return {
        kind: "checklist" as const,
        values: { ...checklistFromTask({ ...values, entryId: null }), items },
        summary,
        form: { values, templateId: template?.id ?? null, items: own },
      };
    }
    const type = create.type === null ? general : types[create.type];
    const values = entryValues(create, type, personIds, today);
    return {
      kind: "entry" as const,
      values,
      summary: voiceSummary(
        "entry",
        {
          title: values.title,
          date: values.time.startDate,
          time: values.time.allDay ? null : values.time.startTime,
          allDay: values.time.allDay,
          repetition: values.repetition,
          reminders: create.reminders,
          private: values.private,
          notes: create.notes,
        },
        names(values.personIds),
        language,
      ),
    };
  };
  // "I have a massage on Friday at 10 and my wife has one at 11" is two Entries.
  const more = (Array.isArray(answer.others) ? answer.others : [])
    .map((o) => parseVoiceCreate(o, active.length, types.length, templates.length))
    .filter((o): o is VoiceCreate => o !== null)
    .slice(0, MAX_MORE)
    .map(proposal);
  return { outcome: "create" as const, ...proposal(create), more };
}
