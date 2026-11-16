// Voice commands that change an Entry or Task: planning the requests that apply and undo it.
import { occurrencesOf } from "../../core/occurrences";
import { parseVoiceFields } from "../../core/voice";
import {
  changedRepetition,
  changedTime,
  changeSummary,
  hasChange,
  parseVoiceChange,
  touchesBirthday,
  type Target,
  type VoiceChange,
} from "../../core/voice-change";
import { labelOf, type Context, type Plan, type Request, type VoiceState } from "./helpers";

/** The notes with the sentence's note added on a new line. */
function withNote(notes: string, note: string | null) {
  return note ? [notes.trimEnd(), note].filter(Boolean).join("\n") : notes;
}

/** How one change applies to one target: the requests to send, or "locked" for a synced Birthday. */
export function planFor(
  target: Target,
  change: VoiceChange,
  personIds: string[] | null,
  reading: { on: string | null; scope: "this" | "following" | null },
  context: Context,
): Plan | "locked" {
  const { language, names } = context;
  const summary = changeSummary(target.title, change, names(personIds ?? []), language);
  const base = {
    kind: target.kind,
    id: target.id,
    label: labelOf(target, language),
    summary,
  };

  if (target.kind === "task") {
    const task = context.tasks.find((t) => t.id === target.id)!;
    const old = {
      title: task.title,
      notes: task.notes,
      dueDate: task.dueDate,
      dueTime: task.dueTime,
      personIds: task.personIds,
      private: task.private,
      repetition: task.repetition,
      checklistId: task.checklistId,
    };
    const dueDate = change.date ?? old.dueDate;
    const values = {
      ...old,
      title: change.title ?? old.title,
      dueDate,
      dueTime: dueDate ? (change.time ?? old.dueTime) : null,
      personIds: personIds ?? old.personIds,
      private: change.private ?? old.private,
      notes: withNote(old.notes, change.notes),
      repetition: dueDate ? (changedRepetition(change.repeat) ?? old.repetition) : null,
    };
    const edits = JSON.stringify(values) !== JSON.stringify(old);
    const apply: Request[] = [];
    const undo: Request[] = [];
    if (edits) {
      apply.push({ method: "PUT", path: `/tasks/${task.id}`, body: values });
      undo.push({ method: "PUT", path: `/tasks/${task.id}`, body: old });
    }
    if (change.done) {
      apply.push({ method: "POST", path: `/tasks/${task.id}/done` });
      undo.unshift({ method: "DELETE", path: `/tasks/${task.id}/done` });
    }
    return { ...base, date: null, scope: "all", apply: { all: apply }, undo };
  }

  const entry = context.entries.find((e) => e.id === target.id)!;
  const { birthdayPersonId, exceptions, ...stored } = entry;
  if (birthdayPersonId && touchesBirthday(change)) return "locked";
  const edit = (values: typeof stored) => ({
    ...values,
    title: change.title ?? values.title,
    time: changedTime(values.time, change),
    personIds: personIds ?? values.personIds,
    location: change.location ?? values.location,
    importance: change.importance ?? values.importance,
    reminders: change.reminders ?? values.reminders,
    private: change.private ?? values.private,
    notes: withNote(values.notes, change.notes),
  });

  if (!entry.repetition || birthdayPersonId) {
    // A synced Birthday's edits always apply to every year.
    const values = birthdayPersonId
      ? {
          ...stored,
          location: change.location ?? stored.location,
          importance: change.importance ?? stored.importance,
          reminders: change.reminders ?? stored.reminders,
        }
      : { ...edit(stored), repetition: changedRepetition(change.repeat) ?? stored.repetition };
    return {
      ...base,
      date: target.date,
      scope: "all",
      apply: { all: [{ method: "PUT", path: `/entries/${entry.id}`, body: values }] },
      undo: [{ method: "PUT", path: `/entries/${entry.id}`, body: stored }],
    };
  }

  // A repeating Entry: the Occurrence named in the sentence, or the one the model saw.
  const date =
    (reading.on &&
      occurrencesOf(entry, reading.on, reading.on).find(
        (o) => o.date === reading.on || o.time.startDate === reading.on,
      )?.date) ||
    target.date;
  const [occurrence] = occurrencesOf(entry, date, date).filter((o) => o.date === date);
  const exception = exceptions.find((x) => x.date === date);
  const current = {
    ...stored,
    ...((exception?.override as Partial<typeof stored> | null) ?? {}),
    time: occurrence?.time ?? stored.time,
  };
  const repetition = changedRepetition(change.repeat);
  const following: Request[] = [
    {
      method: "POST",
      path: `/entries/${entry.id}/following/${date}`,
      body: { ...edit(current), repetition: repetition ?? stored.repetition },
    },
  ];
  if (repetition) {
    // A new Repetition always applies from this Occurrence on.
    return { ...base, date, scope: "following", apply: { following }, undo: null };
  }
  return {
    ...base,
    date,
    scope: reading.scope ?? "ask",
    apply: {
      this: [
        {
          method: "PUT",
          path: `/entries/${entry.id}/occurrences/${date}`,
          body: { ...edit(current), repetition: stored.repetition },
        },
      ],
      following,
    },
    undo: null,
  };
}

/** "Move the dentist to Friday": one plan, or up to three to choose from. */
export function changeCommand(state: VoiceState) {
  const { answer, active, types, targets, entries, tasks, language, names, failed } = state;
  const fields = parseVoiceFields(answer, active.length, types.length);
  const reading = parseVoiceChange(answer, fields, targets.length);
  if (reading.several) return { outcome: "oneAtATime" as const };
  if (reading.targets.length === 0) return { outcome: "notFound" as const };
  if (!hasChange(reading.change)) return failed;
  const personIds = reading.change.persons?.map((i) => active[i].id) ?? null;
  const plans = reading.targets.slice(0, 3).map((i) =>
    planFor(targets[i], reading.change, personIds, reading, {
      entries,
      tasks,
      language,
      names,
    }),
  );
  if (plans.length === 1) {
    return plans[0] === "locked"
      ? { outcome: "locked" as const }
      : { outcome: "change" as const, plan: plans[0] };
  }
  const options = plans.filter((p): p is Plan => p !== "locked");
  if (options.length === 0) return { outcome: "locked" as const };
  return options.length === 1
    ? { outcome: "change" as const, plan: options[0] }
    : { outcome: "choose" as const, options };
}
