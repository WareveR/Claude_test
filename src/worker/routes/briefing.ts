import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import {
  BRIEFING_DAYS,
  briefingCandidates,
  countdown,
  forPerson,
  MAX_CANDIDATES,
  weekOf,
  type Candidate,
} from "../../core/briefing";
import { publicHolidays } from "../../core/holidays";
import { isLanguage, LANGUAGES, type Language } from "../../core/languages";
import { addDays, type PlainDate } from "../../core/plain-date";
import { familyNow } from "../../core/task";
import { writeBriefing } from "../ai";
import type { Db } from "../db";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";
import { allEntries } from "./entries";

const FAMILY = "family";
/** The Scheduler writes the day's Briefings from this hour, Family time. */
const DAWN_HOUR = 5;
/** Refresh at most this often, so a tap-happy hand doesn't spend the AI allowance. */
const REFRESH_GAP = 60 * 1000;

type Person = { id: string; name: string; archived: boolean };

/** Everything the Briefings are written from, read once. */
async function readCalendar(db: Db, now: Date) {
  const [family] = await db.select().from(schema.family).limit(1);
  const { today } = familyNow(family.timeZone, now);
  const [entries, tasks, taskLinks, checklists, persons, Holidays] = await Promise.all([
    allEntries(db),
    db.select().from(schema.task),
    db.select().from(schema.taskPerson),
    db.select().from(schema.checklist),
    db
      .select({ id: schema.person.id, name: schema.person.name, archived: schema.person.archived })
      .from(schema.person),
    import("date-holidays").then((m) => m.default),
  ]);
  const input = {
    today,
    entries: entries.map((e) => ({
      ...e,
      exceptions: e.exceptions.map((x) => ({
        date: x.date,
        skipped: x.skipped,
        override: x.override as { title?: string; private?: boolean; personIds?: string[] } | null,
      })),
    })),
    tasks: tasks.map((t) => ({
      ...t,
      personIds: taskLinks.filter((l) => l.taskId === t.id).map((l) => l.personId),
    })),
    checklists,
    personNames: new Map(persons.map((p) => [p.id, p.name])),
  };
  /** Every candidate in one language, uncapped, so each Person's list is cut after filtering. */
  const candidatesIn = (language: Language) =>
    briefingCandidates(
      {
        ...input,
        holidays: publicHolidays(
          Holidays,
          family.holidayPlaces,
          today,
          addDays(today, BRIEFING_DAYS - 1),
          language,
        ),
      },
      Infinity,
    );
  return { family, today, persons: persons as Person[], candidatesIn };
}

function scopeCandidates(all: Candidate[], scope: string) {
  return (scope === FAMILY ? all : forPerson(all, scope)).slice(0, MAX_CANDIDATES);
}

/** Writes and keeps one Briefing: the model's, or the countdown list. */
async function writeOne(
  db: Db,
  env: Env,
  now: Date,
  today: PlainDate,
  scope: string,
  language: Language,
  candidates: Candidate[],
  personName?: string,
) {
  const written = await writeBriefing(env, candidates, today, language, personName);
  const row = {
    scope,
    language,
    segments: written ?? countdown(candidates, today, language),
    fallback: !written,
    writtenAt: now.toISOString(),
    week: weekOf(candidates, today),
  };
  await db
    .insert(schema.briefing)
    .values(row)
    .onConflictDoUpdate({
      target: [schema.briefing.scope, schema.briefing.language],
      set: {
        segments: row.segments,
        fallback: row.fallback,
        writtenAt: row.writtenAt,
        week: row.week,
      },
    });
  return row;
}

/** Writes one scope's Briefing in one language, reading the calendar for it. */
export async function writeScopeBriefing(
  db: Db,
  env: Env,
  now: Date,
  scope: string,
  language: Language,
) {
  const { today, persons, candidatesIn } = await readCalendar(db, now);
  const name = persons.find((p) => p.id === scope)?.name;
  const candidates = scopeCandidates(candidatesIn(language), scope);
  return writeOne(db, env, now, today, scope, language, candidates, name);
}

/** The languages Briefings are kept in: the Family Language and every Signed-in Device's. */
async function languagesInUse(db: Db, familyLanguage: string): Promise<Language[]> {
  const devices = await db
    .selectDistinct({ language: schema.signedInDevice.language })
    .from(schema.signedInDevice);
  const used = new Set([familyLanguage, ...devices.map((d) => d.language)]);
  return LANGUAGES.filter((l) => used.has(l));
}

/**
 * Scheduler: from 05:00 Family time, every Briefing once a day (the Family's and each
 * non-archived Person's, in each language in use). After that, when an Entry or Task changed, the
 * Briefings whose next 7 days look different are rewritten, so a burst of edits causes one rewrite.
 */
export async function briefingJob(db: Db, env: Env, now: Date) {
  const [family] = await db.select().from(schema.family).limit(1);
  if (!family) return;
  const { today, minutes } = familyNow(family.timeZone, now);
  if (minutes < DAWN_HOUR * 60) return;
  const claimed = await db
    .insert(schema.schedulerRun)
    .values({ job: "briefing", key: today, at: now.toISOString() })
    .onConflictDoNothing()
    .returning();
  const daily = claimed.length > 0;
  // Taken before reading, so an edit made while writing marks the Briefings again.
  const pending = await db.delete(schema.briefingPending).returning();
  if (!daily && pending.length === 0) return;

  const calendar = await readCalendar(db, now);
  const languages = await languagesInUse(db, family.language);
  const scopes = [
    { scope: FAMILY, name: undefined as string | undefined },
    ...calendar.persons.filter((p) => !p.archived).map((p) => ({ scope: p.id, name: p.name })),
  ];
  const stored = daily ? [] : await db.select().from(schema.briefing);
  for (const language of languages) {
    const all = calendar.candidatesIn(language);
    for (const { scope, name } of scopes) {
      const candidates = scopeCandidates(all, scope);
      if (!daily) {
        const row = stored.find((r) => r.scope === scope && r.language === language);
        if (row && row.week === weekOf(candidates, calendar.today)) continue;
      }
      await writeOne(db, env, now, calendar.today, scope, language, candidates, name);
    }
  }
}

/** After an Entry or Task changes, the next Scheduler run checks whether the Briefings are stale. */
export const markBriefingsStale = createMiddleware<AppEnv>(async (c, next) => {
  await next();
  if (c.req.method === "GET" || c.res.status >= 400) return;
  await c.get("db").insert(schema.briefingPending).values({ id: 1 }).onConflictDoNothing();
});

async function stored(db: Db, scope: string, language: string) {
  const [row] = await db
    .select()
    .from(schema.briefing)
    .where(and(eq(schema.briefing.scope, scope), eq(schema.briefing.language, language)));
  return row ?? null;
}

function present(row: Awaited<ReturnType<typeof stored>>) {
  return row && { segments: row.segments, fallback: row.fallback, writtenAt: row.writtenAt };
}

/** Which language this device reads the Briefing in. */
async function languageOf(db: Db, deviceLanguage: string | null): Promise<Language> {
  if (isLanguage(deviceLanguage)) return deviceLanguage;
  const [family] = await db.select({ language: schema.family.language }).from(schema.family);
  return isLanguage(family?.language) ? family.language : "pt-PT";
}

/** `?person=` picks a non-archived Person's Briefing; anything else is the Family's. */
async function scopeOf(db: Db, personId: string | undefined) {
  if (!personId) return FAMILY;
  const [person] = await db
    .select({ archived: schema.person.archived })
    .from(schema.person)
    .where(eq(schema.person.id, personId));
  return person && !person.archived ? personId : FAMILY;
}

/** The band atop today's day view. Never written on page load: only by the Scheduler or Refresh. */
export const briefingRoutes = new Hono<AppEnv>().use(requireDevice);

briefingRoutes.get("/briefing", async (c) => {
  const db = c.get("db");
  const language = await languageOf(db, c.get("device").language);
  const scope = await scopeOf(db, c.req.query("person"));
  return c.json(present(await stored(db, scope, language)));
});

briefingRoutes.post("/briefing/refresh", async (c) => {
  const db = c.get("db");
  const now = c.get("now");
  const language = await languageOf(db, c.get("device").language);
  const scope = await scopeOf(db, c.req.query("person"));
  const existing = await stored(db, scope, language);
  if (existing && now.getTime() - Date.parse(existing.writtenAt) < REFRESH_GAP) {
    return c.json(present(existing));
  }
  return c.json(present(await writeScopeBriefing(db, c.env, now, scope, language)));
});
