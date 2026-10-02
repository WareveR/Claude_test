import { Hono } from "hono";
import { isLanguage } from "../../core/languages";
import { familyNow } from "../../core/task";
import {
  entryValues,
  MAX_SENTENCE,
  parseVoiceCreate,
  taskValues,
  voiceSummary,
} from "../../core/voice";
import { readVoice } from "../ai";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

/**
 * Voice Entry: one spoken or typed sentence becomes a new Entry or Task, filled in but not saved.
 * The browser reads the summary back and saves it through the usual routes, or opens the form.
 */
export const voiceRoutes = new Hono<AppEnv>().use(requireDevice);

voiceRoutes.post("/voice", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const sentence = typeof body.sentence === "string" ? body.sentence.trim() : "";
  if (!sentence || sentence.length > MAX_SENTENCE) {
    return c.json({ error: "invalid", field: "sentence" }, 400);
  }
  const db = c.get("db");
  const [[family], persons, nicknames, types] = await Promise.all([
    db.select().from(schema.family).limit(1),
    db.select().from(schema.person),
    db.select().from(schema.personNickname),
    db.select().from(schema.entryType),
  ]);
  const deviceLanguage = c.get("device").language;
  const language = isLanguage(deviceLanguage)
    ? deviceLanguage
    : isLanguage(family.language)
      ? family.language
      : "pt-PT";
  const { today } = familyNow(family.timeZone, c.get("now"));
  const active = persons.filter((p) => !p.archived);

  const answer = parseVoiceCreate(
    await readVoice(c.env, {
      sentence,
      today,
      timeZone: family.timeZone,
      language,
      persons: active.map((p) => ({
        name: p.name,
        nicknames: nicknames.filter((n) => n.personId === p.id).map((n) => n.nickname),
      })),
      types: types.map((t) => t.name ?? t.builtinKey ?? ""),
    }),
    active.length,
    types.length,
  );
  if (!answer) return c.json({ outcome: "failed", sentence });

  const personIds = answer.persons.map((i) => active[i].id);
  const nameOf = (id: string) => persons.find((p) => p.id === id)?.name ?? "";
  if (answer.kind === "task") {
    const values = taskValues(answer, personIds);
    return c.json({
      outcome: "create",
      kind: "task",
      values,
      summary: voiceSummary(
        "task",
        { ...values, date: values.dueDate, time: values.dueTime, allDay: false },
        values.personIds.map(nameOf),
        language,
      ),
    });
  }
  const general = types.find((t) => t.builtinKey === "general") ?? types[0];
  const type = answer.type === null ? general : types[answer.type];
  const values = entryValues(answer, type, personIds, today);
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
      values.personIds.map(nameOf),
      language,
    ),
  });
});
