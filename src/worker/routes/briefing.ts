import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { BRIEFING_DAYS, briefingCandidates, countdown } from "../../core/briefing";
import { publicHolidays } from "../../core/holidays";
import { isLanguage, type Language } from "../../core/languages";
import { addDays } from "../../core/plain-date";
import { familyNow } from "../../core/task";
import { writeBriefing } from "../ai";
import type { Db } from "../db";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";
import { allEntries } from "./entries";

const FAMILY = "family";
/** The Scheduler writes the day's Briefing from this hour, Family time. */
const DAWN_HOUR = 5;
/** Refresh at most this often, so a tap-happy hand doesn't spend the AI allowance. */
const REFRESH_GAP = 60 * 1000;

/** Everything the Briefing may mention, from the Family's today on. */
async function candidatesFor(db: Db, now: Date, language: Language) {
  const [family] = await db.select().from(schema.family).limit(1);
  const { today } = familyNow(family.timeZone, now);
  const [entries, tasks, taskLinks, checklists, persons, Holidays] = await Promise.all([
    allEntries(db),
    db.select().from(schema.task),
    db.select().from(schema.taskPerson),
    db.select().from(schema.checklist),
    db.select({ id: schema.person.id, name: schema.person.name }).from(schema.person),
    import("date-holidays").then((m) => m.default),
  ]);
  const holidays = publicHolidays(
    Holidays,
    family.holidayPlaces,
    today,
    addDays(today, BRIEFING_DAYS - 1),
    language,
  );
  const candidates = briefingCandidates({
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
    holidays,
    personNames: new Map(persons.map((p) => [p.id, p.name])),
  });
  return { today, candidates };
}

/** Writes and keeps the Family's Briefing in one language: the model's, or the countdown list. */
export async function writeFamilyBriefing(db: Db, env: Env, now: Date, language: Language) {
  const { today, candidates } = await candidatesFor(db, now, language);
  const written = await writeBriefing(env, candidates, today, language);
  const row = {
    scope: FAMILY,
    language,
    segments: written ?? countdown(candidates, today, language),
    fallback: !written,
    writtenAt: now.toISOString(),
  };
  await db
    .insert(schema.briefing)
    .values(row)
    .onConflictDoUpdate({
      target: [schema.briefing.scope, schema.briefing.language],
      set: { segments: row.segments, fallback: row.fallback, writtenAt: row.writtenAt },
    });
  return row;
}

/** Scheduler: the day's Briefing, once a day from 05:00 Family time, in the Family Language. */
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
  if (claimed.length === 0) return;
  const language = isLanguage(family.language) ? family.language : "pt-PT";
  await writeFamilyBriefing(db, env, now, language);
}

async function stored(db: Db, language: string) {
  const [row] = await db
    .select()
    .from(schema.briefing)
    .where(and(eq(schema.briefing.scope, FAMILY), eq(schema.briefing.language, language)));
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

/** The band atop today's day view. Never written on page load: only by the Scheduler or Refresh. */
export const briefingRoutes = new Hono<AppEnv>().use(requireDevice);

briefingRoutes.get("/briefing", async (c) => {
  const db = c.get("db");
  const language = await languageOf(db, c.get("device").language);
  return c.json(present(await stored(db, language)));
});

briefingRoutes.post("/briefing/refresh", async (c) => {
  const db = c.get("db");
  const now = c.get("now");
  const language = await languageOf(db, c.get("device").language);
  const existing = await stored(db, language);
  if (existing && now.getTime() - Date.parse(existing.writtenAt) < REFRESH_GAP) {
    return c.json(present(existing));
  }
  return c.json(present(await writeFamilyBriefing(db, c.env, now, language)));
});
