// "Quando é que estamos todos livres esta semana?": the free stretches said back, without the model.
import { clockOf, freeSlots } from "../../core/free-time";
import { occurrencesOf } from "../../core/occurrences";
import { addDays, formatPlainDate, minutesNowIn } from "../../core/plain-date";
import { fold } from "../../core/recipe";
import type { Language } from "../../core/languages";
import type { Db } from "../db";
import { allEntries } from "../routes/entries";
import { LOCALES } from "./helpers";

/** "When are we all free?", "quando estamos livres", "when is Ana free this week". */
const ASKS_FREE = /\b(?:quando|when)\b.*\b(?:livres?|free)\b/iu;
/** Said of oneself: "quando é que eu estou livre". */
const SELF = /\b(?:eu|estou|i|i'm|am)\b/iu;

export function asksFreeTime(sentence: string) {
  return ASKS_FREE.test(sentence);
}

/** How long a stretch must be to be worth saying. */
const MINUTES = 60;
const SAID = 4;

const TEXTS: Record<
  Language,
  { free: (who: string, many: boolean) => string; none: string; all: string; and: string }
> = {
  "pt-PT": {
    free: (who, many) => `${who} ${many ? "estão livres" : "está livre"} esta semana`,
    none: "Esta semana não há uma hora livre em comum.",
    all: "Todos",
    and: " e ",
  },
  en: {
    free: (who, many) => `${who} ${many ? "are" : "is"} free this week`,
    none: "There's no free hour in common this week.",
    all: "Everyone",
    and: " and ",
  },
};

/**
 * The next free stretches of an hour or more in the coming 7 days for the Persons named in the
 * sentence (by name or nickname), or everyone. Every Entry counts, Private ones too: only their
 * times are used, never said.
 */
export async function freeTimeAnswer({
  db,
  sentence,
  persons,
  nicknames,
  speakerId,
  family,
  today,
  now,
  language,
}: {
  db: Db;
  sentence: string;
  persons: { id: string; name: string }[];
  nicknames: { personId: string; nickname: string }[];
  speakerId: string | null;
  family: { timeZone: string; sleepStartHour: number; sleepEndHour: number };
  today: string;
  now: Date;
  language: Language;
}) {
  const said = ` ${fold(sentence).replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  const named = persons.filter(
    (p) =>
      said.includes(` ${fold(p.name)} `) ||
      nicknames.some((n) => n.personId === p.id && said.includes(` ${fold(n.nickname)} `)),
  );
  if (speakerId && SELF.test(sentence) && !named.some((p) => p.id === speakerId)) {
    const me = persons.find((p) => p.id === speakerId);
    if (me) named.push(me);
  }
  const to = addDays(today, 6);
  const entries = await allEntries(db);
  const busy = entries.flatMap((e) =>
    occurrencesOf(e, today, to).map((o) => ({
      time: o.time,
      personIds: (o.override as { personIds?: string[] } | null)?.personIds ?? e.personIds,
    })),
  );
  const slots = freeSlots({
    busy,
    personIds: named.length > 0 ? named.map((p) => p.id) : persons.map((p) => p.id),
    from: today,
    to,
    sleep: { start: family.sleepStartHour, end: family.sleepEndHour },
    minutes: MINUTES,
    today,
    nowMinutes: minutesNowIn(family.timeZone, now),
  });
  const texts = TEXTS[language];
  if (slots.length === 0) return { outcome: "answer" as const, text: texts.none };
  const who = named.length > 0 ? named.map((p) => p.name).join(texts.and) : texts.all;
  const when = slots
    .slice(0, SAID)
    .map(
      (s) =>
        `${formatPlainDate(s.date, LOCALES[language], { weekday: "long", day: "numeric" })} ${clockOf(s.start)}–${clockOf(s.end)}`,
    );
  return {
    outcome: "answer" as const,
    text: `${texts.free(who, named.length > 1 || (named.length === 0 && language === "pt-PT"))}: ${when.join(", ")}.`,
  };
}
