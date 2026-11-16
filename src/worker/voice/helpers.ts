// Shared types, labels and loaders for the voice command handlers.
import { asc } from "drizzle-orm";
import { formatPlainDate } from "../../core/plain-date";
import type { Language } from "../../core/languages";
import type { changeTargets, Target } from "../../core/voice-change";
import type { Account } from "../auth/account";
import { personsBy, schema, type Db } from "../db";
import { seesInFull } from "../private";
import { allEntries } from "../routes/entries";
import { allRelatives } from "../routes/relatives";

/** One call to the API the browser makes to apply a change, or to undo it. */
export type Request = { method: "PUT" | "POST" | "PATCH" | "DELETE"; path: string; body?: unknown };

/** One way to apply a change to one Entry or Task. */
export type Plan = {
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
  /** Deletes instead of changing: asked as "Delete?", and never undone. */
  remove?: true;
};

export const LOCALES: Record<Language, string> = { "pt-PT": "pt-PT", en: "en-GB" };

export function describeTarget(t: Target, names: (ids: string[]) => string[], language: Language) {
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

export function labelOf(t: Target, language: Language) {
  if (!t.date) return t.title;
  const date = formatPlainDate(t.date, LOCALES[language], {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return `${t.title} · ${date}`;
}

export async function allTasks(db: Db) {
  const [tasks, links] = await Promise.all([
    db.select().from(schema.task),
    db.select().from(schema.taskPerson),
  ]);
  const personsOf = personsBy(links, (l) => l.taskId);
  return tasks.map((t) => ({
    ...t,
    personIds: personsOf.get(t.id) ?? [],
  }));
}

/** The most Tasks with items the model is shown. */
export const MAX_CHECKLISTS = 40;

/** What a voice change can find: never a Private Entry or Task hidden from this Account. */
export async function loadAll(db: Db, viewer: Account) {
  const [[family], persons, nicknames, types, templates, entries, tasks, checklists, relatives] =
    await Promise.all([
      db.select().from(schema.family).limit(1),
      db.select().from(schema.person),
      db.select().from(schema.personNickname),
      db.select().from(schema.entryType),
      db
        .select()
        .from(schema.checklistTemplate)
        .orderBy(asc(schema.checklistTemplate.createdAt), asc(schema.checklistTemplate.id)),
      allEntries(db),
      allTasks(db),
      db.select().from(schema.checklist).orderBy(asc(schema.checklist.name)),
      allRelatives(db),
    ]);
  return {
    relatives,
    checklists: checklists.slice(0, MAX_CHECKLISTS).map((c) => ({
      ...c,
      items: tasks.filter((t) => t.checklistId === c.id),
    })),
    family,
    persons,
    nicknames,
    types,
    templates,
    entries: entries.filter((e) => seesInFull(viewer, e, e.personIds)),
    tasks: tasks.filter((t) => seesInFull(viewer, t, t.personIds)),
  };
}

/** One target a voice change can apply to, with what is needed to plan it. */
export type Context = {
  entries: Awaited<ReturnType<typeof allEntries>>;
  tasks: Awaited<ReturnType<typeof allTasks>>;
  language: Language;
  names: (ids: string[]) => string[];
};

/** Everything a command handler reads: the loaded calendar, the speaker and the model's answer. */
export type VoiceState = Awaited<ReturnType<typeof loadAll>> & {
  db: Db;
  now: Date;
  viewer: Account;
  answer: Record<string, unknown>;
  /** The answer for a sentence the model could not make sense of. */
  failed: { outcome: "failed"; sentence: string };
  language: Language;
  today: string;
  active: Awaited<ReturnType<typeof loadAll>>["persons"];
  names: (ids: string[]) => string[];
  targets: ReturnType<typeof changeTargets>;
};
