import { asc } from "drizzle-orm";
import { Hono } from "hono";
import { checklistFromTask } from "../../core/checklist";
import { MAX_TEMPLATE_ITEMS, MAX_TEMPLATE_TEXT, templateText } from "../../core/checklist-template";
import { freeColor } from "../../core/person-colors";
import { isLanguage, type Language } from "../../core/languages";
import { formatPlainDate, isPlainDate } from "../../core/plain-date";
import { familyNow, isOverdue } from "../../core/task";
import {
  entryValues,
  MAX_SENTENCE,
  parseVoiceCreate,
  parseVoiceFields,
  personSummary,
  taskValues,
  templateSummary,
  voiceSummary,
  type VoiceCreate,
} from "../../core/voice";
import {
  changedRepetition,
  changedTime,
  changeSummary,
  changeTargets,
  hasChange,
  parseVoiceChange,
  removeSummary,
  touchesBirthday,
  type Target,
  type VoiceChange,
} from "../../core/voice-change";
import { occurrencesOf } from "../../core/occurrences";
import { parseVoiceOpen } from "../../core/voice-open";
import { agendaAnswer, questionDays, whenAnswer } from "../../core/voice-question";
import { suggestionFor, rankSuggestions } from "../../core/shopping";
import {
  readShoppingPhrase,
  shoppingMatches,
  shoppingToAdd,
  splitShoppingNames,
} from "../../core/shopping-phrase";
import { forStore } from "../../core/shopping";
import { readVoice, transcribe } from "../ai";
import { randomId } from "../auth/crypto";
import { schema, type Db } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";
import { allEntries } from "./entries";
import { allRelatives } from "./relatives";
import { voiceWeather } from "./weather";
import { weatherAnswer } from "../../core/voice-weather";
import type { Relative } from "../../core/family-tree";
import type { Account } from "../auth/account";
import { seesInFull } from "../private";

/**
 * Voice Entry: one spoken or typed sentence becomes a new Entry or Task (a Task with items, from
 * the sentence or a predefined list, is a Checklist), a change to one, things to put on the
 * Shopping List, a new Person, a new predefined list, or deleting an Entry or Task; or the
 * answer to a question about what is on the calendar, or a place in the app to open.
 * Nothing is saved here: the answer carries the requests the browser sends to the usual routes
 * once the Family member says yes, so every rule of those routes still applies.
 */
export const voiceRoutes = new Hono<AppEnv>().use(requireDevice);

/** One call to the API the browser makes to apply a change, or to undo it. */
type Request = { method: "PUT" | "POST" | "PATCH" | "DELETE"; path: string; body?: unknown };

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
  /** Deletes instead of changing: asked as "Delete?", and never undone. */
  remove?: true;
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

/** What a voice change can find: never a Private Entry or Task hidden from this Account. */
async function loadAll(db: Db, viewer: Account) {
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

/**
 * Things to put on the Shopping List: those already open on it are left out, and each takes the
 * shop it had last, as when typed on the list.
 */
async function shoppingAnswer(db: Db, names: string[], store = "") {
  const rows = await db
    .select({
      name: schema.shoppingItem.name,
      store: schema.shoppingItem.store,
      boughtAt: schema.shoppingItem.boughtAt,
      createdAt: schema.shoppingItem.createdAt,
    })
    .from(schema.shoppingItem);
  const { add, already } = shoppingToAdd(names, rows);
  const ranked = rankSuggestions(rows);
  return {
    outcome: "shopping" as const,
    items: add.map((name) => ({
      name,
      store: store || (suggestionFor(ranked, name)?.store ?? ""),
    })),
    already,
  };
}

const SHOPPING_TEXTS: Record<
  Language,
  { bought: string; remove: string; list: string; empty: string; at: (s: string) => string }
> = {
  "pt-PT": {
    bought: "Comprado",
    remove: "Tirar da lista de compras",
    list: "Na lista de compras",
    empty: "A lista de compras está vazia.",
    at: (s) => `no ${s}`,
  },
  en: {
    bought: "Bought",
    remove: "Take off the shopping list",
    list: "On the shopping list",
    empty: "The shopping list is empty.",
    at: (s) => `at ${s}`,
  },
};

/**
 * "I bought the milk", "take the eggs off the list" and "what do we need?" about the Shopping
 * List: a plan for the items said that are open on it, with Undo, or the list read out.
 */
async function shoppingChange(
  db: Db,
  mode: "bought" | "remove" | "ask",
  names: string[],
  store: string,
  language: Language,
) {
  const items = await db.select().from(schema.shoppingItem);
  const texts = SHOPPING_TEXTS[language];
  if (mode === "ask") {
    const open = forStore(
      items.filter((i) => !i.boughtAt),
      store,
    );
    if (open.length === 0) return { outcome: "answer" as const, text: texts.empty };
    const where = store ? ` ${texts.at(store)}` : "";
    const said = open.map((i) => (i.quantity ? `${i.name} (${i.quantity})` : i.name));
    return { outcome: "answer" as const, text: `${texts.list}${where}: ${said.join(", ")}.` };
  }
  const { found } = shoppingMatches(names, items);
  if (found.length === 0) return { outcome: "notFound" as const };
  const label = found.map((i) => i.name).join(", ");
  const path = (id: string) => `/shopping/items/${id}`;
  const plan: Omit<Plan, "kind"> & { kind: "shopping" } = {
    kind: "shopping",
    id: found.map((i) => i.id).join(","),
    date: null,
    label,
    summary: `${mode === "bought" ? texts.bought : texts.remove}: ${label}`,
    scope: "all",
    apply: {
      all: found.map((i) =>
        mode === "bought"
          ? { method: "PATCH" as const, path: path(i.id), body: { bought: true } }
          : { method: "DELETE" as const, path: path(i.id) },
      ),
    },
    undo: found.map((i) =>
      mode === "bought"
        ? { method: "PATCH" as const, path: path(i.id), body: { bought: false } }
        : {
            method: "POST" as const,
            path: "/shopping/items",
            body: { id: i.id, name: i.name, quantity: i.quantity, note: i.note, store: i.store },
          },
    ),
  };
  return { outcome: "change" as const, plan };
}

/** "… no Lidl", "… at Tesco": a capitalised name after a word for where. */
const NAMES_SHOP = /\b(?:no|na|do|da|at|from)\s+\p{Lu}/u;

/** The most Tasks with items the model is shown. */
const MAX_CHECKLISTS = 40;

const ITEMS_TEXTS: Record<Language, { add: string; done: string; on: (name: string) => string }> = {
  "pt-PT": { add: "juntar", done: "feito", on: (name) => `Em ${name}` },
  en: { add: "add", done: "done", on: (name) => `On ${name}` },
};

/** At most this many corrections follow one sentence. */
export const MAX_CORRECTIONS = 5;

/** At most this many further Entries or Tasks come from one sentence, after the first. */
const MAX_MORE = 4;

/** About a minute of compressed speech; a dictated sentence is far shorter. */
export const MAX_RECORDING = 2 * 1024 * 1024;

/** Dictation: one recording from the microphone becomes the sentence, read by Workers AI. */
voiceRoutes.post("/voice/transcribe", async (c) => {
  const declared = Number(c.req.header("Content-Length") ?? 0);
  if (declared > MAX_RECORDING) return c.json({ error: "invalid", field: "audio" }, 413);
  const audio = await c.req.arrayBuffer();
  if (audio.byteLength === 0 || audio.byteLength > MAX_RECORDING) {
    return c.json({ error: "invalid", field: "audio" }, audio.byteLength === 0 ? 400 : 413);
  }
  const asked = c.req.query("language");
  const deviceLanguage = c.get("device").language;
  const language: Language = isLanguage(asked)
    ? asked
    : isLanguage(deviceLanguage)
      ? deviceLanguage
      : "pt-PT";
  const result = await transcribe(c.env, audio, language);
  if ("failed" in result) return c.json({ error: `speech model: ${result.failed}` }, 502);
  return c.json({ text: result.text });
});

voiceRoutes.post("/voice", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const sentence = typeof body.sentence === "string" ? body.sentence.trim() : "";
  if (!sentence || sentence.length > MAX_SENTENCE) {
    return c.json({ error: "invalid", field: "sentence" }, 400);
  }
  // Said after the readback ("no, at eleven"); the model applies them to the sentence.
  const corrections = Array.isArray(body.corrections) ? body.corrections : [];
  if (
    corrections.length > MAX_CORRECTIONS ||
    corrections.some((c: unknown) => typeof c !== "string" || !c.trim() || c.length > MAX_SENTENCE)
  ) {
    return c.json({ error: "invalid", field: "corrections" }, 400);
  }
  const db = c.get("db");
  // "comprar leite e ovos" needs no model.
  // A shop named after the things ("leite no Lidl") goes to the model, which keeps it apart.
  const shopping =
    corrections.length === 0 && !NAMES_SHOP.test(sentence) && readShoppingPhrase(sentence);
  if (shopping) return c.json(await shoppingAnswer(db, shopping));
  const { family, persons, nicknames, types, templates, entries, tasks, checklists, relatives } =
    await loadAll(db, c.get("account"));
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
  const viewer = c.get("account");
  const speaker = active.findIndex((p) => p.id === viewer.personId);

  const raw = await readVoice(c.env, {
    sentence,
    corrections: corrections.map((c: string) => c.trim()),
    today,
    timeZone: family.timeZone,
    language,
    persons: active.map((p) => ({
      name: p.name,
      nicknames: nicknames.filter((n) => n.personId === p.id).map((n) => n.nickname),
    })),
    types: types.map((t) => t.name ?? t.builtinKey ?? ""),
    lists: templates.map((t) => templateText(t, language).name),
    targets: targets.map((t) => describeTarget(t, names, language)),
    speaker: speaker >= 0 ? speaker : null,
    relatives: relatives.map(
      (r) =>
        `${r.name}${r.nickname ? ` (${r.nickname})` : ""}${r.birthDate ? `, born ${r.birthDate}` : ""}`,
    ),
    checklists: checklists.map(
      (l) =>
        `${l.name}: ${l.items.map((i) => (i.doneAt ? `${i.title} (done)` : i.title)).join(", ") || "(no items yet)"}`,
    ),
  });
  const failed = c.json({ outcome: "failed", sentence });
  if (typeof raw !== "object" || raw === null) return failed;
  const answer = raw as Record<string, unknown>;

  if (answer.action === "delete") {
    const fields = parseVoiceFields(answer, active.length, types.length);
    const reading = parseVoiceChange(answer, fields, targets.length);
    if (reading.several) return c.json({ outcome: "oneAtATime" });
    if (reading.targets.length === 0) return c.json({ outcome: "notFound" });
    const plans = reading.targets
      .slice(0, 3)
      .map((i) => removePlan(targets[i], reading, { entries, tasks, language, names }));
    const options = plans.filter((p): p is Plan => p !== "locked");
    if (options.length === 0) return c.json({ outcome: "locked" });
    return c.json(
      options.length === 1
        ? { outcome: "change", plan: options[0] }
        : { outcome: "choose", options },
    );
  }

  if (answer.action === "items") {
    const index = answer.checklist;
    const list =
      Number.isInteger(index) && (index as number) >= 0 ? checklists[index as number] : undefined;
    if (!list) return c.json({ outcome: "notFound" });
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
    return c.json({ outcome: "change", plan });
  }

  if (answer.action === "briefing") {
    const fields = parseVoiceFields(answer, active.length, types.length);
    const person = fields.persons.length === 1 ? active[fields.persons[0]].id : null;
    return c.json({ outcome: "briefing", person });
  }

  if (answer.action === "overdue") {
    const now = familyNow(family.timeZone, c.get("now"));
    const late = tasks.filter((t) => !t.checklistId && isOverdue(t, now));
    if (late.length === 0) return c.json({ outcome: "noneOverdue" });
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
    return c.json({ outcome: "change", plan });
  }

  if (answer.action === "weather") {
    const date = typeof answer.date === "string" && isPlainDate(answer.date) ? answer.date : today;
    const forecast = await voiceWeather(db, c.get("now"));
    return c.json({ outcome: "answer", text: weatherAnswer(date, forecast, language) });
  }

  if (answer.action === "relative") {
    const plan = relativePlan(answer, relatives, language);
    return plan ? c.json({ outcome: "change", plan }) : failed;
  }

  if (answer.action === "open") {
    const open = parseVoiceOpen(answer);
    return open ? c.json({ outcome: "open", ...open }) : failed;
  }

  if (answer.action === "question") {
    const fields = parseVoiceFields(answer, active.length, types.length);
    const asked = parseVoiceChange(answer, fields, targets.length).targets;
    if (asked.length > 0 && !fields.date) {
      const t = targets[asked[0]];
      return c.json({
        outcome: "answer",
        text: whenAnswer(
          {
            ...t,
            time: t.kind === "task" ? t.time : t.time.allDay ? null : t.time.startTime,
          },
          names,
          language,
        ),
      });
    }
    // Every Entry and Task counts, a Private one hidden from this Account as "Private".
    const [everyEntry, everyTask] = await Promise.all([allEntries(db), allTasks(db)]);
    const { from, to } = questionDays(fields.date, fields.endDate, today);
    const text = agendaAnswer(
      {
        from,
        to,
        startTime:
          fields.time && fields.endTime && fields.endTime > fields.time ? fields.time : null,
        endTime:
          fields.time && fields.endTime && fields.endTime > fields.time ? fields.endTime : null,
        personIds: fields.persons.length > 0 ? fields.persons.map((i) => active[i].id) : null,
      },
      everyEntry.map((e) => ({ ...e, hidden: !seesInFull(viewer, e, e.personIds) })),
      everyTask.map((t) => ({ ...t, hidden: !seesInFull(viewer, t, t.personIds) })),
      names,
      language,
    );
    return c.json({ outcome: "answer", text });
  }

  if (answer.action === "shopping") {
    const items = Array.isArray(answer.items)
      ? answer.items.filter((i): i is string => typeof i === "string")
      : [];
    const names = splitShoppingNames(items.join("\n"));
    const store = typeof answer.store === "string" ? answer.store.trim().slice(0, 100) : "";
    const mode = answer.shop;
    if (mode === "ask") return c.json(await shoppingChange(db, mode, [], store, language));
    if (names.length === 0) return failed;
    if (mode === "bought" || mode === "remove") {
      return c.json(await shoppingChange(db, mode, names, store, language));
    }
    return c.json(await shoppingAnswer(db, names, store));
  }

  if (answer.action === "person") {
    const name = typeof answer.title === "string" ? answer.title.trim().slice(0, 100) : "";
    if (!name) return failed;
    const known = (n: string) => n.trim().toLocaleLowerCase();
    const taken = new Set(
      [...persons.map((p) => p.name), ...nicknames.map((n) => n.nickname)].map(known),
    );
    if (taken.has(known(name))) return c.json({ outcome: "personExists" });
    const born = typeof answer.date === "string" && isPlainDate(answer.date) ? answer.date : null;
    const values = {
      name,
      color: freeColor(persons.filter((p) => !p.archived).map((p) => p.color)),
      photoKey: null,
      dateOfBirth: born && born <= today ? born : null,
      nicknames: [
        ...new Set(
          (Array.isArray(answer.nicknames) ? answer.nicknames : [])
            .filter((n): n is string => typeof n === "string")
            .map((n) => n.trim())
            .filter((n) => n && known(n) !== known(name)),
        ),
      ].slice(0, 10),
    };
    return c.json({
      outcome: "create",
      kind: "person",
      values,
      summary: personSummary(values, language),
    });
  }

  if (answer.action === "list") {
    const name = typeof answer.title === "string" ? answer.title.trim() : "";
    if (!name || name.length > MAX_TEMPLATE_TEXT) return failed;
    const known = (n: string) => n.trim().toLocaleLowerCase();
    if (templates.some((t) => known(templateText(t, language).name) === known(name))) {
      return c.json({ outcome: "listExists" });
    }
    const items = [
      ...new Set(
        (Array.isArray(answer.items) ? answer.items : [])
          .filter((i): i is string => typeof i === "string")
          .map((i) => i.trim().slice(0, MAX_TEMPLATE_TEXT))
          .filter(Boolean),
      ),
    ].slice(0, MAX_TEMPLATE_ITEMS);
    const values = { name, items };
    return c.json({
      outcome: "create",
      kind: "template",
      values,
      summary: templateSummary(values, language),
    });
  }

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
  return c.json({ outcome: "create", ...proposal(create), more });
});

type Context = {
  entries: Awaited<ReturnType<typeof allEntries>>;
  tasks: Awaited<ReturnType<typeof allTasks>>;
  language: Language;
  names: (ids: string[]) => string[];
};

/** The notes with the sentence's note added on a new line. */
function withNote(notes: string, note: string | null) {
  return note ? [notes.trimEnd(), note].filter(Boolean).join("\n") : notes;
}

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

/**
 * How deleting one target goes: a Task or a one-off Entry goes for good, a repeating Entry loses
 * one Occurrence or ends before it. A synced Birthday is deleted only through its Person.
 */
function removePlan(
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

const TREE_TEXTS: Record<
  Language,
  {
    add: string;
    change: string;
    born: string;
    died: string;
    relation: Record<
      "parent" | "child" | "partner" | "sibling",
      (name: string, sex: "f" | "m" | "") => string
    >;
  }
> = {
  "pt-PT": {
    add: "Nova pessoa na árvore",
    change: "Alterar na árvore",
    born: "nasceu a",
    died: "faleceu a",
    relation: {
      parent: (n, s) => `${s === "f" ? "mãe" : s === "m" ? "pai" : "pai ou mãe"} de ${n}`,
      child: (n, s) => `${s === "f" ? "filha" : s === "m" ? "filho" : "filho ou filha"} de ${n}`,
      partner: (n, s) =>
        `${s === "f" ? "companheira" : s === "m" ? "companheiro" : "companheiro ou companheira"} de ${n}`,
      sibling: (n, s) => `${s === "f" ? "irmã" : s === "m" ? "irmão" : "irmão ou irmã"} de ${n}`,
    },
  },
  en: {
    add: "New person in the tree",
    change: "Change in the tree",
    born: "born",
    died: "died",
    relation: {
      parent: (n, s) => `${s === "f" ? "mother" : s === "m" ? "father" : "parent"} of ${n}`,
      child: (n, s) => `${s === "f" ? "daughter" : s === "m" ? "son" : "child"} of ${n}`,
      partner: (n) => `partner of ${n}`,
      sibling: (n, s) => `${s === "f" ? "sister" : s === "m" ? "brother" : "sibling"} of ${n}`,
    },
  },
};

/**
 * Adding someone to the Family Tree, linked to a Relative already in it, or changing one's
 * dates or nickname; with Undo either way.
 */
function relativePlan(
  answer: Record<string, unknown>,
  tree: Relative[],
  language: Language,
): (Omit<Plan, "kind"> & { kind: "relative" }) | null {
  const texts = TREE_TEXTS[language];
  const at = (v: unknown) => (Number.isInteger(v) ? tree[v as number] : undefined);
  const day = (v: unknown) => (typeof v === "string" && isPlainDate(v) ? v : null);
  const long = (d: string) =>
    formatPlainDate(d, LOCALES[language], { day: "numeric", month: "long", year: "numeric" });
  const nickname = Array.isArray(answer.nicknames)
    ? (answer.nicknames.find((n): n is string => typeof n === "string" && !!n.trim()) ?? "")
        .trim()
        .slice(0, 80)
    : "";
  const birthDate = day(answer.date);
  const deathDate = day(answer.endDate);
  const details = [
    nickname ? `“${nickname}”` : "",
    birthDate ? `${texts.born} ${long(birthDate)}` : "",
    deathDate ? `${texts.died} ${long(deathDate)}` : "",
  ];
  const changed = at(answer.relative);
  if (changed) {
    const patch = {
      ...(birthDate ? { birthDate } : {}),
      ...(deathDate ? { deathDate } : {}),
      ...(nickname ? { nickname } : {}),
    };
    if (Object.keys(patch).length === 0) return null;
    const old = Object.fromEntries(
      Object.keys(patch).map((k) => [k, changed[k as keyof typeof patch]]),
    );
    return {
      kind: "relative",
      id: changed.id,
      date: null,
      label: changed.name,
      summary: `${texts.change}: ${[changed.name, ...details].filter(Boolean).join(", ")}`,
      scope: "all",
      apply: { all: [{ method: "PATCH", path: `/relatives/${changed.id}`, body: patch }] },
      undo: [{ method: "PATCH", path: `/relatives/${changed.id}`, body: old }],
    };
  }
  const name = typeof answer.title === "string" ? answer.title.trim().slice(0, 80) : "";
  if (!name) return null;
  const of = at(answer.of);
  const relation =
    of && ["parent", "child", "partner", "sibling"].includes(answer.relation as string)
      ? (answer.relation as "parent" | "child" | "partner" | "sibling")
      : null;
  const sex = answer.sex === "f" || answer.sex === "m" ? answer.sex : "";
  const id = randomId();
  const body = {
    id,
    name,
    nickname,
    sex,
    birthDate,
    deathDate,
    parentIds: relation === "child" ? [of!.id] : relation === "sibling" ? of!.parentIds : [],
    childIds: relation === "parent" ? [of!.id] : [],
    partnerIds: relation === "partner" ? [of!.id] : [],
  };
  return {
    kind: "relative",
    id,
    date: null,
    label: name,
    summary: `${texts.add}: ${[
      name,
      relation ? texts.relation[relation](of!.name, sex) : "",
      ...details,
    ]
      .filter(Boolean)
      .join(", ")}`,
    scope: "all",
    apply: { all: [{ method: "POST", path: "/relatives", body }] },
    undo: [{ method: "DELETE", path: `/relatives/${id}` }],
  };
}
