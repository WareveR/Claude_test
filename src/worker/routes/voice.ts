import { Hono } from "hono";
import { isLanguage, type Language } from "../../core/languages";
import { formatPlainDate } from "../../core/plain-date";
import { familyNow } from "../../core/task";
import {
  entryValues,
  MAX_SENTENCE,
  parseVoiceCreate,
  parseVoiceFields,
  taskValues,
  voiceSummary,
} from "../../core/voice";
import {
  changedRepetition,
  changedTime,
  changeSummary,
  changeTargets,
  hasChange,
  parseVoiceChange,
  touchesBirthday,
  type Target,
  type VoiceChange,
} from "../../core/voice-change";
import { occurrencesOf } from "../../core/occurrences";
import { readVoice } from "../ai";
import { schema, type Db } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";
import { allEntries } from "./entries";

/**
 * Voice Entry: one spoken or typed sentence becomes a new Entry or Task, or a change to one.
 * Nothing is saved here: the answer carries the requests the browser sends to the usual routes
 * once the Family member says yes, so every rule of those routes still applies.
 */
export const voiceRoutes = new Hono<AppEnv>().use(requireDevice);

/** One call to the API the browser makes to apply a change, or to undo it. */
type Request = { method: "PUT" | "POST" | "DELETE"; path: string; body?: unknown };

/** One way to apply a change to one Entry or Task. */
type Plan = {
  kind: "entry" | "task";
  id: string;
  /** The Occurrence meant, for an Entry. */
  date: string | null;
  /** What it is now, to pick from when several match ("Dinner · Fri 9 Oct"). */
  label: string;
  summary: string;
  /** For a repeating Entry the browser asks "only this time or from now on?" when this is "ask". */
  scope: "all" | "this" | "following" | "ask";
  apply: Partial<Record<"all" | "this" | "following", Request[]>>;
  /** Undoes "all"; none for a repeating Entry. */
  undo: Request[] | null;
};

const LOCALES: Record<Language, string> = { "pt-PT": "pt-PT", en: "en-GB" };

function describeTarget(t: Target, names: (ids: string[]) => string[], language: Language) {
  const when = t.date
    ? `${formatPlainDate(t.date, LOCALES[language], { weekday: "short", day: "numeric", month: "short" })}${
        t.kind === "entry"
          ? t.time.allDay
            ? ""
            : ` ${t.time.startTime}`
          : t.time
            ? ` ${t.time}`
            : ""
      }`
    : "";
  const persons = names(t.personIds);
  return [
    t.kind,
    `"${t.title}"`,
    t.kind === "task" ? (t.date ? `due ${when}` : "no date") : when,
    persons.length > 0 ? `for ${persons.join(", ")}` : "",
    t.repeating ? "(repeats)" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function labelOf(t: Target, language: Language) {
  if (!t.date) return t.title;
  const date = formatPlainDate(t.date, LOCALES[language], {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return `${t.title} · ${date}`;
}

async function allTasks(db: Db) {
  const [tasks, links] = await Promise.all([
    db.select().from(schema.task),
    db.select().from(schema.taskPerson),
  ]);
  return tasks.map((t) => ({
    ...t,
    personIds: links.filter((l) => l.taskId === t.id).map((l) => l.personId),
  }));
}

async function loadAll(db: Db) {
  const [[family], persons, nicknames, types, entries, tasks] = await Promise.all([
    db.select().from(schema.family).limit(1),
    db.select().from(schema.person),
    db.select().from(schema.personNickname),
    db.select().from(schema.entryType),
    allEntries(db),
    allTasks(db),
  ]);
  return { family, persons, nicknames, types, entries, tasks };
}

voiceRoutes.post("/voice", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const sentence = typeof body.sentence === "string" ? body.sentence.trim() : "";
  if (!sentence || sentence.length > MAX_SENTENCE) {
    return c.json({ error: "invalid", field: "sentence" }, 400);
  }
  const db = c.get("db");
  const { family, persons, nicknames, types, entries, tasks } = await loadAll(db);
  const deviceLanguage = c.get("device").language;
  const language = isLanguage(deviceLanguage)
    ? deviceLanguage
    : isLanguage(family.language)
      ? family.language
      : "pt-PT";
  const { today } = familyNow(family.timeZone, c.get("now"));
  const active = persons.filter((p) => !p.archived);
  const nameOf = (id: string) => persons.find((p) => p.id === id)?.name ?? "";
  const names = (ids: string[]) => ids.map(nameOf).filter(Boolean);
  const targets = changeTargets(entries, tasks, today);

  const raw = await readVoice(c.env, {
    sentence,
    today,
    timeZone: family.timeZone,
    language,
    persons: active.map((p) => ({
      name: p.name,
      nicknames: nicknames.filter((n) => n.personId === p.id).map((n) => n.nickname),
    })),
    types: types.map((t) => t.name ?? t.builtinKey ?? ""),
    targets: targets.map((t) => describeTarget(t, names, language)),
  });
  const failed = c.json({ outcome: "failed", sentence });
  if (typeof raw !== "object" || raw === null) return failed;
  const answer = raw as Record<string, unknown>;

  if (answer.action === "delete") return c.json({ outcome: "refused" });

  if (answer.action === "change") {
    const fields = parseVoiceFields(answer, active.length, types.length);
    const reading = parseVoiceChange(answer, fields, targets.length);
    if (reading.several) return c.json({ outcome: "oneAtATime" });
    if (reading.targets.length === 0) return c.json({ outcome: "notFound" });
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
      return c.json(
        plans[0] === "locked" ? { outcome: "locked" } : { outcome: "change", plan: plans[0] },
      );
    }
    const options = plans.filter((p): p is Plan => p !== "locked");
    if (options.length === 0) return c.json({ outcome: "locked" });
    return c.json(
      options.length === 1
        ? { outcome: "change", plan: options[0] }
        : { outcome: "choose", options },
    );
  }

  const create = parseVoiceCreate(answer, active.length, types.length);
  if (!create) return failed;
  const personIds = create.persons.map((i) => active[i].id);
  if (create.kind === "task") {
    const values = taskValues(create, personIds);
    return c.json({
      outcome: "create",
      kind: "task",
      values,
      summary: voiceSummary(
        "task",
        { ...values, date: values.dueDate, time: values.dueTime, allDay: false },
        names(values.personIds),
        language,
      ),
    });
  }
  const general = types.find((t) => t.builtinKey === "general") ?? types[0];
  const type = create.type === null ? general : types[create.type];
  const values = entryValues(create, type, personIds, today);
  return c.json({
    outcome: "create",
    kind: "entry",
    values,
    summary: voiceSummary(
      "entry",
      {
        title: values.title,
        date: values.time.startDate,
        time: values.time.allDay ? null : values.time.startTime,
        allDay: values.time.allDay,
        repetition: values.repetition,
      },
      names(values.personIds),
      language,
    ),
  });
});

type Context = {
  entries: Awaited<ReturnType<typeof allEntries>>;
  tasks: Awaited<ReturnType<typeof allTasks>>;
  language: Language;
  names: (ids: string[]) => string[];
};

/** How one change applies to one target: the requests to send, or "locked" for a synced Birthday. */
function planFor(
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
  });

  if (!entry.repetition || birthdayPersonId) {
    // A synced Birthday's edits always apply to every year.
    const values = birthdayPersonId
      ? {
          ...stored,
          location: change.location ?? stored.location,
          importance: change.importance ?? stored.importance,
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
