import { and, eq, inArray, isNotNull, lt } from "drizzle-orm";
import { addDays, addMonths } from "../core/plain-date";
import { familyNow } from "../core/task";
import { APP_VERSION } from "../core/version";
import type { Db } from "./db";
import { schema } from "./db";

/** Both daily jobs wait until the night is quiet, before the Briefings at dawn. */
const NIGHT_HOUR = 3;
const NIGHTLY_KEPT_DAYS = 30;
const MONTHLY_KEPT_MONTHS = 12;
const IMAGE_KEPT_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

/** Short-lived or rebuildable tables a restore doesn't need. */
const SKIPPED_TABLES = new Set([
  "d1_migrations",
  "sign_in_throttle",
  "recovery_token",
  "scheduler_run",
  "weather_cache",
  "briefing",
  "briefing_pending",
]);

/**
 * Claims a job for the Family's current day once it is past NIGHT_HOUR, so it runs once a day
 * even with overlapping Scheduler runs. Returns the Family date, or null when not due.
 */
async function claimNight(db: Db, job: string, now: Date): Promise<string | null> {
  const [family] = await db.select({ timeZone: schema.family.timeZone }).from(schema.family);
  if (!family) return null;
  const { today, minutes } = familyNow(family.timeZone, now);
  if (minutes < NIGHT_HOUR * 60) return null;
  const claimed = await db
    .insert(schema.schedulerRun)
    .values({ job, key: today, at: now.toISOString() })
    .onConflictDoNothing()
    .returning();
  return claimed.length > 0 ? today : null;
}

/** The database's own tables, by name. */
export async function tableNames(d1: D1Database): Promise<string[]> {
  const { results } = await d1
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name",
    )
    .all<{ name: string }>();
  return results.map((r) => r.name);
}

/** Rows of the given tables, column names as stored. */
export async function readTables(d1: D1Database, names: string[]) {
  const data: Record<string, Record<string, unknown>[]> = {};
  for (const name of names) {
    data[name] = (
      await d1.prepare(`SELECT * FROM "${name}"`).all<Record<string, unknown>>()
    ).results;
  }
  return data;
}

/** Every table of the database as rows, column names as stored, for a whole-database restore. */
export async function snapshot(d1: D1Database, now: Date) {
  const names = (await tableNames(d1)).filter((name) => !SKIPPED_TABLES.has(name));
  const data = await readTables(d1, names);
  return {
    format: "family-calendar-backup",
    version: 1,
    appVersion: APP_VERSION,
    createdAt: now.toISOString(),
    tables: data,
  };
}

/**
 * Scheduler: one full JSON Backup a night to the Backup bucket. Keeps 30 nightly copies and the
 * first copy of each month for 12 months. A failure is logged by the Scheduler; the next night
 * tries again.
 */
export async function backupJob(db: Db, env: Env, now: Date) {
  const today = await claimNight(db, "backup", now);
  if (!today) return;
  const body = JSON.stringify(await snapshot(env.DB, now));
  const options = { httpMetadata: { contentType: "application/json" } };
  await env.BACKUPS.put(`nightly/${today}.json`, body, options);
  const monthly = `monthly/${today.slice(0, 7)}.json`;
  if (!(await env.BACKUPS.head(monthly))) await env.BACKUPS.put(monthly, body, options);

  const keepNightly = `nightly/${addDays(today, -NIGHTLY_KEPT_DAYS + 1)}.json`;
  const keepMonthly = `monthly/${addMonths(today, -MONTHLY_KEPT_MONTHS + 1).slice(0, 7)}.json`;
  const old = [
    ...(await env.BACKUPS.list({ prefix: "nightly/" })).objects.filter((o) => o.key < keepNightly),
    ...(await env.BACKUPS.list({ prefix: "monthly/" })).objects.filter((o) => o.key < keepMonthly),
  ];
  if (old.length > 0) await env.BACKUPS.delete(old.map((o) => o.key));
}

/**
 * Scheduler: once a night, marks images still referenced as used now and deletes those unused
 * for 30 days. Images are never overwritten, so a Backup's image keys stay valid that long.
 */
export async function imageCleanupJob(db: Db, env: Env, now: Date) {
  if (!(await claimNight(db, "image-cleanup", now))) return;
  const [photos, thumbnails] = await Promise.all([
    db
      .select({ key: schema.person.photoKey })
      .from(schema.person)
      .where(isNotNull(schema.person.photoKey)),
    db
      .select({ key: schema.entryType.thumbnailKey })
      .from(schema.entryType)
      .where(isNotNull(schema.entryType.thumbnailKey)),
  ]);
  const used = new Set([...photos, ...thumbnails].map((r) => r.key));
  const images = await db.select({ key: schema.image.key }).from(schema.image);
  const usedKeys = images.map((i) => i.key).filter((key) => used.has(key));
  // D1 binds at most 100 parameters per query.
  for (let i = 0; i < usedKeys.length; i += 90) {
    await db
      .update(schema.image)
      .set({ lastUsedAt: now.toISOString() })
      .where(inArray(schema.image.key, usedKeys.slice(i, i + 90)));
  }
  const cutoff = new Date(now.getTime() - IMAGE_KEPT_DAYS * DAY).toISOString();
  const stale = await db
    .select({ key: schema.image.key })
    .from(schema.image)
    .where(lt(schema.image.lastUsedAt, cutoff));
  for (const { key } of stale) {
    if (used.has(key)) continue;
    await env.IMAGES.delete(key);
    await db
      .delete(schema.image)
      .where(and(eq(schema.image.key, key), lt(schema.image.lastUsedAt, cutoff)));
  }
}
