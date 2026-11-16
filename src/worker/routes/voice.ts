import { Hono } from "hono";
import { isLanguage } from "../../core/languages";
import { MAX_SENTENCE } from "../../core/voice";
import { changeTargets } from "../../core/voice-change";
import { familyNow } from "../../core/task";
import { templateText } from "../../core/checklist-template";
import { readVoice } from "../ai";
import { AI_CALLS_PER_DAY, day, withinLimit } from "../usage";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";
import { readShoppingPhrase } from "../../core/shopping-phrase";
import { briefingCommand, openCommand } from "../voice/navigation";
import { questionCommand, weatherCommand } from "../voice/agenda";
import { changeCommand } from "../voice/change";
import { createCommand } from "../voice/create";
import { deleteCommand } from "../voice/delete";
import { relativeCommand } from "../voice/family-tree";
import { describeTarget, loadAll, type VoiceState } from "../voice/helpers";
import { listCommand, personCommand } from "../voice/persons";
import { NAMES_SHOP, shoppingAnswer, shoppingCommand } from "../voice/shopping";
import { checklistItemsCommand, overdueCommand } from "../voice/tasks";
import { MAX_RECORDING, transcribeVoice } from "../voice/transcribe";

export { MAX_RECORDING };

/**
 * Voice Entry: one spoken or typed sentence becomes a new Entry or Task (a Task with items, from
 * the sentence or a predefined list, is a Checklist), a change to one, things to put on the
 * Shopping List, a new Person, a new predefined list, or deleting an Entry or Task; or the
 * answer to a question about what is on the calendar, or a place in the app to open.
 * Nothing is saved here: the answer carries the requests the browser sends to the usual routes
 * once the Family member says yes, so every rule of those routes still applies.
 */
export const voiceRoutes = new Hono<AppEnv>().use(requireDevice);

/** At most this many corrections follow one sentence. */
export const MAX_CORRECTIONS = 5;

/** Dictation: one recording from the microphone becomes the sentence, read by Workers AI. */
voiceRoutes.post("/voice/transcribe", transcribeVoice);

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
  if (
    !(await withinLimit(
      c.get("db"),
      `ai:${c.get("account").id}`,
      day(c.get("now")),
      AI_CALLS_PER_DAY,
    ))
  ) {
    return c.json({ error: "too_many_requests", retryAfter: 3600 }, 429);
  }
  const db = c.get("db");
  // "comprar leite e ovos" needs no model.
  // A shop named after the things ("leite no Lidl") goes to the model, which keeps it apart.
  const shopping =
    corrections.length === 0 && !NAMES_SHOP.test(sentence) && readShoppingPhrase(sentence);
  if (shopping) return c.json(await shoppingAnswer(db, shopping));
  const loaded = await loadAll(db, c.get("account"));
  const { family, persons, nicknames, types, templates, tasks, checklists, relatives } = loaded;
  const { entries } = loaded;
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
  const failed = { outcome: "failed" as const, sentence };
  if (typeof raw !== "object" || raw === null) return c.json(failed);
  const answer = raw as Record<string, unknown>;

  const state: VoiceState = {
    ...loaded,
    db,
    now: c.get("now"),
    viewer,
    answer,
    failed,
    language,
    today,
    active,
    names,
    targets,
  };
  const reply = async () => {
    switch (answer.action) {
      case "delete":
        return deleteCommand(state);
      case "items":
        return checklistItemsCommand(state);
      case "briefing":
        return briefingCommand(state);
      case "overdue":
        return overdueCommand(state);
      case "weather":
        return await weatherCommand(state);
      case "relative":
        return relativeCommand(state);
      case "open":
        return openCommand(state);
      case "question":
        return await questionCommand(state);
      case "shopping":
        return await shoppingCommand(state);
      case "person":
        return personCommand(state);
      case "list":
        return listCommand(state);
      case "change":
        return changeCommand(state);
      default:
        return createCommand(state);
    }
  };
  return c.json(await reply());
});
