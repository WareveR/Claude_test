import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import {
  BRIEFING_DAYS,
  briefingCandidates,
  countdown,
  editionAt,
  forAccount,
  forEdition,
  forPerson,
  MAX_CANDIDATES,
  publicOnly,
  REWRITE_DAYS,
  weekOf,
  type BriefingExtras,
  type BriefingReader,
  type Candidate,
  type Edition,
} from "../../core/briefing";
import { clockChangeWithin } from "../../core/clock-change";
import { publicHolidays } from "../../core/holidays";
import { isLanguage, LANGUAGES, type Language } from "../../core/languages";
import { addDays, weekday, type PlainDate } from "../../core/plain-date";
import { familyNow } from "../../core/task";
import { binsOn } from "../../core/waste";
import { writeBriefing } from "../ai";
import type { Db } from "../db";
import { personsBy, schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";
import { allEntries } from "./entries";
import { briefingWeather } from "./weather";

const FAMILY = "family";
/** An Account's own Briefing, with its Private items, is kept under "account:<id>". */
const ACCOUNT = "account:";
/** The Scheduler writes the day's Briefings from this hour, Family time. */
const DAWN_HOUR = 5;
/** Refresh at most this often, so a tap-happy hand doesn't spend the AI allowance. */
const REFRESH_GAP = 60 * 1000;

type Person = { id: string; name: string; archived: boolean };

/** Everything the Briefings are written from, read once. */
async function readCalendar(db: Db, now: Date) {
  const [family] = await db.select().from(schema.family).limit(1);
  const { today, minutes } = familyNow(family.timeZone, now);
  const edition = editionAt(minutes);
  const [entries, tasks, taskLinks, checklists, persons, accounts, Holidays, weather] =
    await Promise.all([
      allEntries(db),
      db.select().from(schema.task),
      db.select().from(schema.taskPerson),
      db.select().from(schema.checklist),
      db
        .select({
          id: schema.person.id,
          name: schema.person.name,
          archived: schema.person.archived,
        })
        .from(schema.person),
      db
        .select({
          id: schema.account.id,
          personId: schema.account.personId,
          passwordHash: schema.account.passwordHash,
        })
        .from(schema.account),
      import("date-holidays").then((m) => m.default),
      briefingWeather(db, now),
    ]);
  const personsOfTask = personsBy(taskLinks, (l) => l.taskId);
  const input = {
    today,
    entries: entries.map((e) => ({
      ...e,
      exceptions: e.exceptions.map((x) => ({
        date: x.date,
        skipped: x.skipped,
        override: x.override as {
          title?: string;
          location?: string;
          private?: boolean;
          personIds?: string[];
        } | null,
      })),
    })),
    tasks: tasks.map((t) => ({
      ...t,
      personIds: personsOfTask.get(t.id) ?? [],
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
  const extras: BriefingExtras = {
    weather,
    clockChange: clockChangeWithin(family.timeZone, today, REWRITE_DAYS),
    bins: binsOn(family.wasteCollection, weekday(today)),
  };
  // An invited Account that hasn't set its password yet reads nothing, so gets no Briefing.
  const readers: BriefingReader[] = accounts
    .filter((a) => a.passwordHash !== "")
    .map((a) => ({ id: a.id, personId: a.personId }));
  return {
    family,
    today,
    edition,
    persons: persons as Person[],
    readers,
    candidatesIn,
    extras,
  };
}

function scopeCandidates(
  all: Candidate[],
  scope: string,
  readers: BriefingReader[],
  today: PlainDate,
  edition: Edition,
) {
  const reader = scope.startsWith(ACCOUNT)
    ? readers.find((r) => ACCOUNT + r.id === scope)
    : undefined;
  const picked = reader
    ? forAccount(all, reader)
    : scope === FAMILY
      ? publicOnly(all)
      : forPerson(all, scope);
  return forEdition(picked, today, edition).slice(0, MAX_CANDIDATES);
}

/** The name the model speaks to in a scope's Briefing: the Person's, or the Account's Person's. */
function nameOf(scope: string, persons: Person[], readers: BriefingReader[]) {
  const personId = scope.startsWith(ACCOUNT)
    ? readers.find((r) => ACCOUNT + r.id === scope)?.personId
    : scope;
  return persons.find((p) => p.id === personId)?.name;
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
  extras: BriefingExtras,
  edition: Edition,
  personName?: string,
) {
  const written = await writeBriefing(
    env,
    candidates,
    today,
    language,
    extras,
    personName,
    edition,
  );
  const row = {
    scope,
    language,
    segments: written ?? countdown(candidates, today, language),
    fallback: !written,
    writtenAt: now.toISOString(),
    week: weekOf(candidates, today),
    edition,
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
        edition: row.edition,
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
  const { today, edition, persons, readers, candidatesIn, extras } = await readCalendar(db, now);
  const name = nameOf(scope, persons, readers);
  const candidates = scopeCandidates(candidatesIn(language), scope, readers, today, edition);
  return writeOne(db, env, now, today, scope, language, candidates, extras, edition, name);
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
 * Scheduler: from 05:00 Family time every Briefing is written as the morning edition (the
 * Family's, each non-archived Person's and each Account's own, in each language in use), and from
 * 19:00 again as the evening edition, about tomorrow. In between, when an Entry or Task changed,
 * the Briefings whose next 7 days look different are rewritten in the current edition, so a burst
 * of edits causes one rewrite.
 */
export async function briefingJob(db: Db, env: Env, now: Date) {
  const [family] = await db.select().from(schema.family).limit(1);
  if (!family) return;
  const { today, minutes } = familyNow(family.timeZone, now);
  if (minutes < DAWN_HOUR * 60) return;
  const edition = editionAt(minutes);
  const claimed = await db
    .insert(schema.schedulerRun)
    .values({
      job: "briefing",
      key: edition === "evening" ? `${today}-evening` : today,
      at: now.toISOString(),
    })
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
    ...calendar.readers.map((r) => ({
      scope: ACCOUNT + r.id,
      name: nameOf(ACCOUNT + r.id, calendar.persons, calendar.readers),
    })),
  ];
  const stored = daily ? [] : await db.select().from(schema.briefing);
  for (const language of languages) {
    const all = calendar.candidatesIn(language);
    for (const { scope, name } of scopes) {
      const candidates = scopeCandidates(
        all,
        scope,
        calendar.readers,
        calendar.today,
        calendar.edition,
      );
      if (!daily) {
        const row = stored.find((r) => r.scope === scope && r.language === language);
        if (row && row.week === weekOf(candidates, calendar.today)) continue;
      }
      await writeOne(
        db,
        env,
        now,
        calendar.today,
        scope,
        language,
        candidates,
        calendar.extras,
        calendar.edition,
        name,
      );
    }
  }
}

/**
 * After an Entry or Task changes, the next 15-minute Scheduler run checks whether the Briefings
 * are stale.
 */
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
  return (
    row && {
      segments: row.segments,
      fallback: row.fallback,
      writtenAt: row.writtenAt,
      edition: row.edition,
    }
  );
}

/** Which language this device reads the Briefing in. */
async function languageOf(db: Db, deviceLanguage: string | null): Promise<Language> {
  if (isLanguage(deviceLanguage)) return deviceLanguage;
  const [family] = await db.select({ language: schema.family.language }).from(schema.family);
  return isLanguage(family?.language) ? family.language : "pt-PT";
}

/**
 * `?mine=1` picks the signed-in Account's own Briefing, with its Private items; `?person=` a
 * non-archived Person's; anything else is the Family's.
 */
async function scopeOf(
  db: Db,
  accountId: string,
  mine: string | undefined,
  personId: string | undefined,
) {
  if (mine === "1") return ACCOUNT + accountId;
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
  const scope = await scopeOf(db, c.get("account").id, c.req.query("mine"), c.req.query("person"));
  return c.json(present(await stored(db, scope, language)));
});

briefingRoutes.post("/briefing/refresh", async (c) => {
  const db = c.get("db");
  const now = c.get("now");
  const language = await languageOf(db, c.get("device").language);
  const scope = await scopeOf(db, c.get("account").id, c.req.query("mine"), c.req.query("person"));
  const existing = await stored(db, scope, language);
  if (existing && now.getTime() - Date.parse(existing.writtenAt) < REFRESH_GAP) {
    return c.json(present(existing));
  }
  return c.json(present(await writeScopeBriefing(db, c.env, now, scope, language)));
});
