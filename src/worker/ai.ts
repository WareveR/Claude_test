import { VOICE_PLACES } from "../core/voice-open";
import {
  candidateLink,
  NO_EXTRAS,
  type BriefingExtras,
  type BriefingWeather,
  type Candidate,
  type Segment,
} from "../core/briefing";
import type { ClockChange } from "../core/clock-change";
import type { Language } from "../core/languages";
import { formatPlainDate, type PlainDate } from "../core/plain-date";
import { weatherKind, type DayWeather, type HourWeather, type WeatherKind } from "../core/weather";

/**
 * The one place that talks to Workers AI. Every call returns a checked, typed result or null,
 * and null means "use the fallback". Tests swap `model.run` for a fake.
 */
export const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export const model = {
  run: (
    env: Env,
    input: {
      messages: { role: string; content: string }[];
      response_format: object;
      /** The model stops after this many tokens; 256 when not given. */
      max_tokens?: number;
    },
  ) => env.AI.run(MODEL, input as never) as Promise<{ response?: unknown }>,
};

/** Speech to text for dictation, so the recording stays on Cloudflare instead of the browser's own service. */
export const SPEECH_MODEL = "@cf/openai/whisper-large-v3-turbo";

export const speech = {
  run: (env: Env, input: { audio: string; language: string }) =>
    env.AI.run(SPEECH_MODEL, {
      ...input,
      task: "transcribe",
      vad_filter: true,
    } as never) as Promise<{
      text?: unknown;
    }>,
};

/** Whisper's language codes. */
const SPEECH_LANGUAGES: Record<Language, string> = { "pt-PT": "pt", en: "en" };

/**
 * Turns one recording into text: null on silence, and on a model failure the reason, so the
 * browser can show it instead of "nothing heard".
 */
export async function transcribe(
  env: Env,
  audio: ArrayBuffer,
  language: Language,
): Promise<{ text: string | null } | { failed: string }> {
  try {
    const result = await speech.run(env, {
      audio: toBase64(new Uint8Array(audio)),
      language: SPEECH_LANGUAGES[language],
    });
    const text = typeof result?.text === "string" ? result.text.trim() : "";
    return { text: text || null };
  } catch (error) {
    console.warn("speech model", error);
    return { failed: String(error instanceof Error ? error.message : error).slice(0, 200) };
  }
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  // In pieces, so a long recording doesn't overflow the call stack.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

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
    c.prepares ? `prepares for "${c.prepares}"` : "",
    c.importance === "high" ? "HIGH importance" : "",
  ];
  return parts.filter(Boolean).join(" ");
}

const SKY: Record<WeatherKind, string> = {
  sunny: "sunny",
  partlyCloudy: "partly cloudy",
  cloudy: "cloudy",
  rain: "rain",
  showers: "showers",
  thunder: "thunderstorms",
  snow: "snow",
  fog: "fog",
};

/** An hour with at least this chance of rain is worth an umbrella. */
const RAIN_LIKELY = 40;

/** One day's weather in words: "today: rain, 12 to 17 degrees, 80% chance of rain, wind up to 40 km/h". */
function describeDay(day: DayWeather, today: PlainDate) {
  const parts = [
    `${day.date === today ? "today" : "tomorrow"}: ${SKY[weatherKind(day.code)]}`,
    `${Math.round(day.min)} to ${Math.round(day.max)} degrees`,
    day.rain !== undefined ? `${Math.round(day.rain)}% chance of rain` : "",
    day.wind !== undefined ? `wind up to ${Math.round(day.wind)} km/h` : "",
    day.uv !== undefined ? `UV index ${Math.round(day.uv)}` : "",
  ];
  return parts.filter(Boolean).join(", ");
}

/** Today's hours with a real chance of rain, as "15:00 to 18:00 (up to 70%)"; empty when none. */
function rainHours(hours: HourWeather[]) {
  const wet = hours.filter((h) => h.rain >= RAIN_LIKELY);
  if (wet.length === 0) return "";
  const from = wet[0].time.slice(11, 16);
  const to = wet[wet.length - 1].time.slice(11, 16);
  const most = Math.max(...wet.map((h) => Math.round(h.rain)));
  return `rain likely today ${from === to ? `around ${from}` : `from ${from} to ${to}`} (up to ${most}%)`;
}

function describeWeather(weather: BriefingWeather | null, today: PlainDate) {
  if (!weather) return "";
  const days = weather.days.filter((d) => d.date >= today).slice(0, 2);
  if (days.length === 0) return "";
  const rain = rainHours(weather.hours);
  return `Weather in ${weather.place}: ${days.map((d) => describeDay(d, today)).join("; ")}${rain ? `; ${rain}` : ""}.`;
}

function describeClockChange(change: ClockChange | null, locale: string) {
  if (!change) return "";
  const date = formatPlainDate(change.date, locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const way = change.to > change.from ? "forward" : "back";
  return `The clocks change on ${date}: at ${change.from} they go ${way} to ${change.to}.`;
}

/** At most this many Shopping List items are named; the rest are counted. */
const SHOPPING_NAMED = 8;

function describeShopping(items: string[]) {
  if (items.length === 0) return "";
  const named = items
    .slice(0, SHOPPING_NAMED)
    .map((i) => `"${i}"`)
    .join(", ");
  const more = items.length > SHOPPING_NAMED ? ` and ${items.length - SHOPPING_NAMED} more` : "";
  return `Shopping list: ${items.length} still to buy: ${named}${more}.`;
}

/** How the host sounds, in the Briefing's own language. */
const EXAMPLES: Record<Language, string> = {
  "pt-PT": [
    "«Atenção, que no domingo muda a hora: às 2h passam a ser 1h outra vez, mais uma hora de sono!»",
    "«Para a semana há feriado, já pensaram em como o aproveitar?»",
    "«O aniversário da mãe é no fim do mês, não se esqueçam de preparar tudo!»",
    "«Hoje vai estar sol, por volta dos 25 graus, mas pode chover um pouco lá para as 17h: se saírem, levem o guarda-chuva.»",
    "«Na lista de compras já estão o leite e os ovos.»",
  ].join(" "),
  en: [
    '"Heads up: the clocks change on Sunday, at 2 they go back to 1, an extra hour in bed!"',
    '"There\'s a bank holiday next week, any plans to make the most of it?"',
    "\"Mum's birthday is at the end of the month, don't forget to get everything ready!\"",
    '"Sunny today, around 25 degrees, but a little rain is possible around 5 pm: if you go out, take an umbrella."',
    '"The shopping list already has milk and eggs."',
  ].join(" "),
};

/** The most the model may write for one Briefing (docs/runbooks/workers-ai.md). */
const BRIEFING_TOKENS = 1280;
/** The longest Briefing kept, in pieces and in characters; a longer answer is a bad one. */
const MAX_SEGMENTS = 60;
const MAX_BRIEFING_LENGTH = 3000;

/**
 * The prompt for one Briefing, told like a morning radio show so it can be played aloud, about
 * what is worth knowing soon; candidates are already free of notes and Private items.
 */
export function briefingPrompt(
  candidates: Candidate[],
  today: PlainDate,
  language: Language,
  personName?: string,
  extras: BriefingExtras = NO_EXTRAS,
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
        `You are the family's personal assistant and you tell the day's briefing like the host of a warm, lively morning radio show, in ${LANGUAGE_NAMES[language]}.`,
        personName
          ? `This briefing is for ${personName}: speak to them, about what is theirs and what the whole family does.`
          : "This briefing is for the whole family: speak to all of them.",
        "It is shown on screen and also read aloud by a speech synthesiser, so write flowing spoken sentences, never lists, bullets, emojis, symbols or abbreviations that read badly aloud.",
        "Do not greet: the app says the greeting just before your text.",
        "Tell only what they need to know soon, like a friend who keeps an eye on things, and turn facts into useful, human remarks: a practical tip, a reminder to get ready, a light question. Leave out what is far off and not important.",
        `Sound like these examples (not facts, only the tone): ${EXAMPLES[language]}`,
        "Tell it in short paragraphs, in this order, leaving out a paragraph that has nothing to say:",
        "1. Open by saying what day today is, in a lively way.",
        "2. The weather, only when given: today's sky and temperature, when rain is likely and an umbrella tip then, a coat or sunscreen only when the numbers call for it, and a word about tomorrow.",
        "3. A change of the clocks, when given: say the day and what happens to the time, as in the example.",
        "4. Today: everything on today, with its time.",
        "5. The next six days: what is on each day that has something, the HIGH importance ones first; group many small ones. A public holiday: say when, and ask how they'd like to make the most of it.",
        "6. Further ahead, only what needs getting ready: a birthday within the next month with a reminder to prepare it, and HIGH importance items.",
        "7. What to prepare: the tasks and lists that prepare for what is coming up, with their progress; also say when something important coming up within the week has nothing to prepare it, only if preparing is clearly needed (a trip, a party).",
        "8. Tasks: those planned for the next days, and every overdue one, saying how late it is; when there are overdue tasks, ask whether to do them today, move them to another day, or drop them.",
        "9. The shopping list, when given: a light word on what is already on it.",
        "10. Sign off with one short, friendly sentence, like a radio host closing the show.",
        "Link the items with natural radio transitions instead of listing them. Say dates relative to today (today, tomorrow, on Friday, next week, at the end of the month). Warm, short sentences; use only facts given here and never invent events.",
        'Answer as JSON {"segments":[{"text":"...","item":n}]}: split the sentences into pieces so that each piece names at most one item, give that item\'s number in "item", and null for pieces that name none. Joined in order, the pieces must read as the whole text. A new paragraph starts with a piece whose text begins with "\\n\\n".',
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `Today is ${day}.`,
        describeWeather(extras.weather, today),
        describeClockChange(extras.clockChange, locale),
        candidates.length > 0
          ? candidates.map((c, i) => describe(c, i, language)).join("\n")
          : "Nothing is planned.",
        describeShopping(extras.shopping),
      ]
        .filter(Boolean)
        .join("\n\n"),
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
  if (!Array.isArray(segments) || segments.length === 0 || segments.length > MAX_SEGMENTS) {
    return null;
  }
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
  if (length > MAX_BRIEFING_LENGTH) return null;
  return out.map((s) => (s.link ? s : { text: s.text }));
}

/** Asks the model for a Briefing; null on any failure, so the countdown list is used. */
export async function writeBriefing(
  env: Env,
  candidates: Candidate[],
  today: PlainDate,
  language: Language,
  extras: BriefingExtras,
  personName?: string,
): Promise<Segment[] | null> {
  if (candidates.length === 0 && !extras.weather && !extras.clockChange) return null;
  try {
    const result = await model.run(env, {
      messages: briefingPrompt(candidates, today, language, personName, extras),
      response_format: { type: "json_schema", json_schema: BRIEFING_SCHEMA },
      // Several paragraphs as JSON pieces run well past the default 256 tokens.
      max_tokens: BRIEFING_TOKENS,
    });
    // Token counts, to check real use against the free daily allowance (docs/runbooks/workers-ai.md).
    if (result && "usage" in result) console.log("briefing usage", JSON.stringify(result.usage));
    return parseBriefing(result?.response, candidates);
  } catch (error) {
    console.warn("briefing model", error);
    return null;
  }
}

const REPEAT_SCHEMA = {
  type: ["object", "null"],
  properties: {
    frequency: { type: "string", enum: ["daily", "weekly", "monthly", "yearly"] },
    interval: { type: "integer" },
    weekdays: { type: ["array", "null"], items: { type: "integer" } },
  },
};

const VOICE_SCHEMA = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["create", "change", "delete", "shopping", "person", "list", "question", "open"],
    },
    place: {
      type: ["string", "null"],
      enum: [...VOICE_PLACES, null],
    },
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
    repeat: REPEAT_SCHEMA,
    done: { type: ["boolean", "null"] },
    targets: { type: "array", items: { type: "integer" } },
    several: { type: "boolean" },
    on: { type: ["string", "null"] },
    scope: { type: ["string", "null"], enum: ["this", "following", null] },
    items: { type: "array", items: { type: "string" } },
    list: { type: ["integer", "null"] },
    nicknames: { type: "array", items: { type: "string" } },
    others: {
      type: "array",
      items: {
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
          repeat: REPEAT_SCHEMA,
        },
        required: ["kind", "title", "type", "persons", "date", "time", "allDay"],
      },
    },
  },
  required: ["action", "kind", "title", "type", "persons", "date", "time", "allDay", "targets"],
};

export type VoiceContext = {
  sentence: string;
  /** What the family member said after hearing the sentence read back, to apply to it. */
  corrections?: string[];
  today: PlainDate;
  timeZone: string;
  language: Language;
  persons: { name: string; nicknames: string[] }[];
  types: string[];
  /** The Family's predefined lists, by name. */
  lists: string[];
  /** What a change may target, already numbered by position. */
  targets: string[];
  /** The number of the Person speaking, when the Account has one. */
  speaker?: number | null;
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
        'You read one sentence from a family member about the family calendar. "action" is "create" for a new entry or task, "change" to change an existing one, "delete" to remove or cancel one, "shopping" to put things on the family\'s shopping list, "person" to add a new person to the family, "list" to make a new predefined list, "question" to ask what is on the calendar, "open" to go to a part of the app.',
        `The sentence is in ${LANGUAGE_NAMES[context.language]}; keep the title in that language, short, without the date, time or names.`,
        'An "entry" happens at a time (appointment, birthday, trip, class); a "task" is something to do, possibly by a due date.',
        "Give dates as YYYY-MM-DD and times as HH:mm (24-hour), worked out from today's date; null when the sentence doesn't say.",
        '"persons" lists the numbers of the people it is for; "type" is the number of the best entry type, or null.',
        '"repeat" only when the sentence says it repeats; weekdays are 0 = Monday … 6 = Sunday.',
        'For "create", when the sentence names two or more separate things, at different times or for different people each with their own ("I have a massage on Friday at 10 and my wife has one at 11"), the main fields hold the first and "others" holds each of the rest, every one complete with its own kind, title, type, persons, date and time; one thing the people do together stays one item and "others" is empty.',
        'A new "task" may have items: "items" lists the sub-tasks or things to remember the sentence names for it ("prepare the trip: passports, chargers and book the taxi"), short, in the sentence\'s language; "list" is the number of the predefined list it uses when the sentence asks for one or names it ("pack for the beach with the beach list"), else null. Otherwise "items" is empty.',
        '"person" is only for adding someone new to the family\'s people ("add Maria, born 3 May 2015, we call her Mimi"): "title" is the name, "nicknames" the other names they go by, "date" the date of birth if said.',
        '"list" is only for making a new predefined list, a reusable template of items, when the sentence says so ("create the predefined list Beach with towels and sunscreen"): "title" is its name and "items" its items; a list for one task or occasion is a "create" task with items.',
        '"shopping" is for buying things or adding them to the shopping list when no day or time is said ("buy milk and eggs", "we\'re out of bread"): "items" lists each thing, short, in the sentence\'s language, without verbs.',
        'For "change": "targets" lists the numbers of the existing items the sentence may mean (all that fit, best first; empty if none); "several" is true when the sentence asks to change two or more different items; "on" is the date of the one occurrence meant for a repeating item, if said; "scope" is "this" for only this time, "following" for from now on, null if not said. Fill only the fields that change and leave the rest null (title only when renamed, persons empty unless they change); "done": true when a task is done.',
        '"question" is for asking, not changing ("what do we have tomorrow?", "am I free on Friday afternoon?", "what\'s on this week?", "when is Ana\'s next dentist?"): "date" and "endDate" are the days asked about ("this week" is today to Sunday; endDate null for one day; date null for today); "time" and "endTime" a part of the day if said (morning 08:00–12:00, afternoon 12:00–19:00, evening 19:00–23:59), else null; "persons" whose calendar is asked about, empty for the whole family; for "when is the next …" about one existing item, "targets" lists the numbers of the items it may mean and date stays null.',
        '"open" is only for going somewhere in the app ("show next week", "open December", "open the shopping list", "search for dentist"): "place" is where (day, week, month, year, agenda, tasks, shopping, tree for the family tree, summary, wall, suggestions, search, settings); "date" the day it shows, if said; for "search", "title" is what to look for.',
        'For "delete": "targets", "several", "on" and "scope" work as for "change", and the other fields stay null; cancelling something that happens ("cancel Friday\'s dinner") is "delete".',
        "Answer only with JSON matching the schema.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `Today is ${day} ${context.today}, time zone ${context.timeZone}.`,
        `People:\n${persons || "(none)"}`,
        ...(context.speaker != null
          ? [`The person speaking is number ${context.speaker}; "I", "me" and "my" mean them.`]
          : []),
        `Entry types:\n${context.types.map((t, i) => `${i}. ${t}`).join("\n")}`,
        `Predefined lists:\n${context.lists.map((l, i) => `${i}. ${l}`).join("\n") || "(none)"}`,
        `Existing items:\n${context.targets.map((t, i) => `${i}. ${t}`).join("\n") || "(none)"}`,
        `Sentence: ${JSON.stringify(context.sentence)}`,
        ...(context.corrections?.length
          ? [
              `After hearing it read back, they corrected it, in this order:\n${context.corrections.map((c) => `- ${JSON.stringify(c)}`).join("\n")}\nAnswer for the sentence with every correction applied: the same request, with what they changed.`,
            ]
          : []),
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
          persons: { type: "array", items: { type: "integer" } },
        },
        required: ["kind", "title", "date", "time", "repeat", "persons"],
      },
    },
  },
  required: ["items"],
};

/** The prompt that turns the phrases of the Suggestions box into repeating Tasks and Entries. */
export function suggestionsPrompt(
  phrases: string[],
  today: PlainDate,
  language: Language,
  persons: { name: string; nicknames: string[] }[] = [],
) {
  const locale = language === "en" ? "en-GB" : "pt-PT";
  const day = formatPlainDate(today, locale, { weekday: "long" });
  const people = persons
    .map(
      (p, i) =>
        `${i}. ${p.name}${p.nicknames.length > 0 ? ` (also called ${p.nicknames.join(", ")})` : ""}`,
    )
    .join("\n");
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
        'The family\'s people are numbered below. "persons" holds the numbers of the people a phrase is for, named or by a nickname ("dad", "a mãe"); several when they do it together; empty when it names nobody, which means the whole family.',
        'When a phrase gives different days or times for different people ("gym: dad Monday 7pm, mum Tuesday 8am"), give one item per person.',
        "Answer only with JSON matching the schema.",
      ].join(" "),
    },
    {
      role: "user",
      content: `Today is ${day} ${today}.\n\nThe family's people:\n${people || "(none)"}\n\nPhrases:\n${phrases.map((p, i) => `${i + 1}. ${p}`).join("\n")}`,
    },
  ];
}

/** Asks the model to read the Suggestions box; null on any failure. */
export async function readSuggestions(
  env: Env,
  phrases: string[],
  today: PlainDate,
  language: Language,
  persons: { name: string; nicknames: string[] }[] = [],
): Promise<unknown | null> {
  try {
    const result = await model.run(env, {
      messages: suggestionsPrompt(phrases, today, language, persons),
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
