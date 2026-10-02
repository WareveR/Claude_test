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
    kind: { type: "string", enum: ["entry", "task"] },
    title: { type: "string" },
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
  },
  required: ["kind", "title", "type", "persons", "date", "time", "allDay"],
};

export type VoiceContext = {
  sentence: string;
  today: PlainDate;
  timeZone: string;
  language: Language;
  persons: { name: string; nicknames: string[] }[];
  types: string[];
};

/** The prompt that turns one sentence into a new Entry or Task. */
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
        "You turn one sentence from a family member into a new entry for the family calendar or a new task.",
        `The sentence is in ${LANGUAGE_NAMES[context.language]}; keep the title in that language, short, without the date, time or names.`,
        'An "entry" happens at a time (appointment, birthday, trip, class); a "task" is something to do, possibly by a due date.',
        "Give dates as YYYY-MM-DD and times as HH:mm (24-hour), worked out from today's date; null when the sentence doesn't say.",
        '"persons" lists the numbers of the people it is for; "type" is the number of the best entry type, or null.',
        '"repeat" only when the sentence says it repeats; weekdays are 0 = Monday … 6 = Sunday.',
        "Answer only with JSON matching the schema.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `Today is ${day} ${context.today}, time zone ${context.timeZone}.`,
        `People:\n${persons || "(none)"}`,
        `Entry types:\n${context.types.map((t, i) => `${i}. ${t}`).join("\n")}`,
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
