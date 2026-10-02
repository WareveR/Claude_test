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
export function briefingPrompt(candidates: Candidate[], today: PlainDate, language: Language) {
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
): Promise<Segment[] | null> {
  if (candidates.length === 0) return null;
  try {
    const result = await model.run(env, {
      messages: briefingPrompt(candidates, today, language),
      response_format: { type: "json_schema", json_schema: BRIEFING_SCHEMA },
    });
    return parseBriefing(result?.response, candidates);
  } catch (error) {
    console.warn("briefing model", error);
    return null;
  }
}
