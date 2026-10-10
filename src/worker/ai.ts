import { candidateLink, type Candidate, type Segment } from "../core/briefing";
import type { Language } from "../core/languages";
import { formatPlainDate, type PlainDate } from "../core/plain-date";

/**
 * The one place that talks to Workers AI. Every call returns a checked, typed result or null,
 * and null means "use the fallback". Tests swap `model.run` for a fake.
 */
export const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export const model = {
  run: (
    env: Env,
    input: { messages: { role: string; content: string }[]; response_format: object },
  ) => env.AI.run(MODEL, input as never) as Promise<{ response?: unknown }>,
};

const LANGUAGE_NAMES: Record<Language, string> = {
  "pt-PT": "European Portuguese (Portugal, not Brazil)",
  en: "British English",
};

const BRIEFING_SCHEMA = {
  type: "object",
  properties: {
    segments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          item: { type: ["integer", "null"] },
        },
        required: ["text", "item"],
      },
    },
  },
  required: ["segments"],
};

function describe(c: Candidate, i: number, language: Language) {
  const locale = language === "en" ? "en-GB" : "pt-PT";
  const date = formatPlainDate(c.date, locale, { weekday: "long", day: "numeric", month: "long" });
  const parts = [
    `${i}.`,
    c.kind,
    `"${c.title}"`,
    c.detail === "overdue" ? `overdue since ${date}` : `${date}${c.time ? ` ${c.time}` : ""}`,
    c.persons.length > 0 ? `for ${c.persons.join(", ")}` : "",
    c.detail && c.detail !== "overdue" ? `progress ${c.detail}` : "",
    c.importance === "high" ? "HIGH importance" : "",
  ];
  return parts.filter(Boolean).join(" ");
}

/** The prompt for one Briefing; candidates are already free of notes and Private items. */
export function briefingPrompt(
  candidates: Candidate[],
  today: PlainDate,
  language: Language,
  personName?: string,
) {
  const locale = language === "en" ? "en-GB" : "pt-PT";
  const day = formatPlainDate(today, locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return [
    {
      role: "system",
      content: [
        `You write the short morning briefing of a family calendar, in ${LANGUAGE_NAMES[language]}.`,
        personName
          ? `This briefing is for ${personName}: speak to them, about what is theirs and what the whole family does.`
          : "This briefing is for the whole family.",
        "Pick 3 to 5 items from the numbered list, favouring HIGH importance, overdue items and the nearest dates.",
        "Write 2 to 4 short, warm, plain sentences saying what is coming up and what deserves attention. Say dates relative to today (today, tomorrow, on Friday, in 10 days).",
        "You may end with one practical suggestion or question. Use only facts from the list; never invent events.",
        'Answer as JSON {"segments":[{"text":"...","item":n}]}: split the sentences into pieces so that each piece names at most one item, give that item\'s number in "item", and null for pieces that name none. Joined in order, the pieces must read as the whole text.',
      ].join(" "),
    },
    {
      role: "user",
      content: `Today is ${day}.\n\n${candidates.map((c, i) => describe(c, i, language)).join("\n")}`,
    },
  ];
}

/** Checks the model's answer; anything off makes it null. */
export function parseBriefing(response: unknown, candidates: Candidate[]): Segment[] | null {
  let value = response;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  const segments = (value as { segments?: unknown } | null)?.segments;
  if (!Array.isArray(segments) || segments.length === 0 || segments.length > 20) return null;
  const out: Segment[] = [];
  let length = 0;
  for (const s of segments as { text?: unknown; item?: unknown }[]) {
    if (typeof s?.text !== "string" || !s.text.trim()) return null;
    length += s.text.length;
    const item = s.item;
    if (item !== null && item !== undefined) {
      if (typeof item !== "number" || !Number.isInteger(item) || !candidates[item]) return null;
      out.push({ text: s.text, link: candidateLink(candidates[item]) });
    } else {
      out.push({ text: s.text });
    }
  }
  if (length > 1200) return null;
  return out.map((s) => (s.link ? s : { text: s.text }));
}

/** Asks the model for a Briefing; null on any failure, so the countdown list is used. */
export async function writeBriefing(
  env: Env,
  candidates: Candidate[],
  today: PlainDate,
  language: Language,
  personName?: string,
): Promise<Segment[] | null> {
  if (candidates.length === 0) return null;
  try {
    const result = await model.run(env, {
      messages: briefingPrompt(candidates, today, language, personName),
      response_format: { type: "json_schema", json_schema: BRIEFING_SCHEMA },
    });
    // Token counts, to check real use against the free daily allowance (docs/runbooks/workers-ai.md).
    if (result && "usage" in result) console.log("briefing usage", JSON.stringify(result.usage));
    return parseBriefing(result?.response, candidates);
  } catch (error) {
    console.warn("briefing model", error);
    return null;
  }
}

const VOICE_SCHEMA = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["create", "change", "delete"] },
    kind: { type: ["string", "null"], enum: ["entry", "task", null] },
    title: { type: ["string", "null"] },
    type: { type: ["integer", "null"] },
    persons: { type: "array", items: { type: "integer" } },
    date: { type: ["string", "null"] },
    time: { type: ["string", "null"] },
    endDate: { type: ["string", "null"] },
    endTime: { type: ["string", "null"] },
    allDay: { type: ["boolean", "null"] },
    location: { type: ["string", "null"] },
    importance: { type: ["string", "null"], enum: ["low", "normal", "high", null] },
    repeat: {
      type: ["object", "null"],
      properties: {
        frequency: { type: "string", enum: ["daily", "weekly", "monthly", "yearly"] },
        interval: { type: "integer" },
        weekdays: { type: ["array", "null"], items: { type: "integer" } },
      },
    },
    done: { type: ["boolean", "null"] },
    targets: { type: "array", items: { type: "integer" } },
    several: { type: "boolean" },
    on: { type: ["string", "null"] },
    scope: { type: ["string", "null"], enum: ["this", "following", null] },
  },
  required: ["action", "kind", "title", "type", "persons", "date", "time", "allDay", "targets"],
};

export type VoiceContext = {
  sentence: string;
  today: PlainDate;
  timeZone: string;
  language: Language;
  persons: { name: string; nicknames: string[] }[];
  types: string[];
  /** What a change may target, already numbered by position. */
  targets: string[];
};

/** The prompt that turns one sentence into a new Entry or Task, or a change to one. */
export function voicePrompt(context: VoiceContext) {
  const locale = context.language === "en" ? "en-GB" : "pt-PT";
  const day = formatPlainDate(context.today, locale, { weekday: "long" });
  const persons = context.persons
    .map(
      (p, i) =>
        `${i}. ${p.name}${p.nicknames.length > 0 ? ` (also called ${p.nicknames.join(", ")})` : ""}`,
    )
    .join("\n");
  return [
    {
      role: "system",
      content: [
        'You read one sentence from a family member about the family calendar. "action" is "create" for a new entry or task, "change" to change an existing one, "delete" to remove or cancel one.',
        `The sentence is in ${LANGUAGE_NAMES[context.language]}; keep the title in that language, short, without the date, time or names.`,
        'An "entry" happens at a time (appointment, birthday, trip, class); a "task" is something to do, possibly by a due date.',
        "Give dates as YYYY-MM-DD and times as HH:mm (24-hour), worked out from today's date; null when the sentence doesn't say.",
        '"persons" lists the numbers of the people it is for; "type" is the number of the best entry type, or null.',
        '"repeat" only when the sentence says it repeats; weekdays are 0 = Monday … 6 = Sunday.',
        'For "change": "targets" lists the numbers of the existing items the sentence may mean (all that fit, best first; empty if none); "several" is true when the sentence asks to change two or more different items; "on" is the date of the one occurrence meant for a repeating item, if said; "scope" is "this" for only this time, "following" for from now on, null if not said. Fill only the fields that change and leave the rest null (title only when renamed, persons empty unless they change); "done": true when a task is done.',
        "Answer only with JSON matching the schema.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `Today is ${day} ${context.today}, time zone ${context.timeZone}.`,
        `People:\n${persons || "(none)"}`,
        `Entry types:\n${context.types.map((t, i) => `${i}. ${t}`).join("\n")}`,
        `Existing items:\n${context.targets.map((t, i) => `${i}. ${t}`).join("\n") || "(none)"}`,
        `Sentence: ${JSON.stringify(context.sentence)}`,
      ].join("\n\n"),
    },
  ];
}

/** Asks the model to read a Voice Entry sentence; null on any failure, so the plain form opens. */
export async function readVoice(env: Env, context: VoiceContext): Promise<unknown | null> {
  try {
    const result = await model.run(env, {
      messages: voicePrompt(context),
      response_format: { type: "json_schema", json_schema: VOICE_SCHEMA },
    });
    if (result && "usage" in result) console.log("voice usage", JSON.stringify(result.usage));
    const response = result?.response;
    if (typeof response !== "string") return response ?? null;
    try {
      return JSON.parse(response);
    } catch {
      return null;
    }
  } catch (error) {
    console.warn("voice model", error);
    return null;
  }
}

const SUGGESTIONS_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["entry", "task"] },
          title: { type: "string" },
          date: { type: ["string", "null"] },
          time: { type: ["string", "null"] },
          repeat: VOICE_SCHEMA.properties.repeat,
        },
        required: ["kind", "title", "date", "time", "repeat"],
      },
    },
  },
  required: ["items"],
};

/** The prompt that turns the phrases of the Suggestions box into repeating Tasks and Entries. */
export function suggestionsPrompt(phrases: string[], today: PlainDate, language: Language) {
  const locale = language === "en" ? "en-GB" : "pt-PT";
  const day = formatPlainDate(today, locale, { weekday: "long" });
  return [
    {
      role: "system",
      content: [
        "A family is filling in its calendar with the things that repeat in its life. Read each numbered phrase.",
        `The phrases are in ${LANGUAGE_NAMES[language]}; write titles in that language, short, without the date, time or names.`,
        'A phrase about one thing ("gym on Monday and Wednesday at 7pm", "pay the water bill on the 15th") gives one item.',
        'A phrase naming a whole topic ("baby", "garden", "swimming pool") gives up to 8 items a family in Portugal commonly has to remember for it, each with a sensible repeat.',
        'An "entry" happens at a time (class, gym, appointment); a "task" is something to do or pay by a date.',
        'Give "repeat" whenever the thing repeats; weekdays are 0 = Monday … 6 = Sunday. Give the first date as YYYY-MM-DD and times as HH:mm (24-hour), worked out from today; null when not said.',
        "Answer only with JSON matching the schema.",
      ].join(" "),
    },
    {
      role: "user",
      content: `Today is ${day} ${today}.\n\n${phrases.map((p, i) => `${i + 1}. ${p}`).join("\n")}`,
    },
  ];
}

/** Asks the model to read the Suggestions box; null on any failure. */
export async function readSuggestions(
  env: Env,
  phrases: string[],
  today: PlainDate,
  language: Language,
): Promise<unknown | null> {
  try {
    const result = await model.run(env, {
      messages: suggestionsPrompt(phrases, today, language),
      response_format: { type: "json_schema", json_schema: SUGGESTIONS_SCHEMA },
    });
    if (result && "usage" in result) console.log("suggestions usage", JSON.stringify(result.usage));
    const response = result?.response;
    if (typeof response !== "string") return response ?? null;
    try {
      return JSON.parse(response);
    } catch {
      return null;
    }
  } catch (error) {
    console.warn("suggestions model", error);
    return null;
  }
}
