// Voice commands that delete an Entry or Task, or one Occurrence of a repeating Entry.
import { parseVoiceFields } from "../../core/voice";
import { parseVoiceChange, removeSummary, type Target } from "../../core/voice-change";
import { occurrencesOf } from "../../core/occurrences";
import { labelOf, type Context, type Plan, type VoiceState } from "./helpers";

/**
 * How deleting one target goes: a Task or a one-off Entry goes for good, a repeating Entry loses
 * one Occurrence or ends before it. A synced Birthday is deleted only through its Person.
 */
export function removePlan(
  target: Target,
  reading: { on: string | null; scope: "this" | "following" | null },
  context: Context,
): Plan | "locked" {
  const label = labelOf(target, context.language);
  const base = { kind: target.kind, id: target.id, label, undo: null, remove: true as const };
  if (target.kind === "task") {
    return {
      ...base,
      date: null,
      summary: removeSummary(label, context.language),
      scope: "all",
      apply: { all: [{ method: "DELETE", path: `/tasks/${target.id}` }] },
    };
  }
  const entry = context.entries.find((e) => e.id === target.id)!;
  if (entry.birthdayPersonId) return "locked";
  if (!entry.repetition) {
    return {
      ...base,
      date: target.date,
      summary: removeSummary(label, context.language),
      scope: "all",
      apply: { all: [{ method: "DELETE", path: `/entries/${entry.id}` }] },
    };
  }
  const date =
    (reading.on &&
      occurrencesOf(entry, reading.on, reading.on).find(
        (o) => o.date === reading.on || o.time.startDate === reading.on,
      )?.date) ||
    target.date;
  const dated = labelOf({ ...target, date }, context.language);
  return {
    ...base,
    label: dated,
    date,
    summary: removeSummary(dated, context.language),
    scope: reading.scope ?? "ask",
    apply: {
      this: [{ method: "DELETE", path: `/entries/${entry.id}/occurrences/${date}` }],
      following: [{ method: "DELETE", path: `/entries/${entry.id}/following/${date}` }],
    },
  };
}

/** "Delete the dentist": one plan, or up to three to choose from. */
export function deleteCommand({
  answer,
  active,
  types,
  targets,
  entries,
  tasks,
  language,
  names,
}: VoiceState) {
  const fields = parseVoiceFields(answer, active.length, types.length);
  const reading = parseVoiceChange(answer, fields, targets.length);
  if (reading.several) return { outcome: "oneAtATime" as const };
  if (reading.targets.length === 0) return { outcome: "notFound" as const };
  const plans = reading.targets
    .slice(0, 3)
    .map((i) => removePlan(targets[i], reading, { entries, tasks, language, names }));
  const options = plans.filter((p): p is Plan => p !== "locked");
  if (options.length === 0) return { outcome: "locked" as const };
  return options.length === 1
    ? { outcome: "change" as const, plan: options[0] }
    : { outcome: "choose" as const, options };
}
