import { and, desc, eq, gt, gte, lt } from "drizzle-orm";
import { Hono, type ErrorHandler } from "hono";
import { isErrorCode, newErrorCode } from "../../core/error-code";
import { isLanguage } from "../../core/languages";
import { familyNow } from "../../core/task";
import { APP_VERSION } from "../../core/version";
import { randomId } from "../auth/crypto";
import type { Db } from "../db";
import { schema } from "../db";
import { EMAIL_TEXTS, sendEmail } from "../email";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** Errors are kept this long. */
export const ERROR_LOG_DAYS = 90;
/** At most this many Reports an hour, so a loop can't flood the inbox. */
const REPORTS_PER_HOUR = 5;
/** The daily summary goes out on the first Scheduler run after this Family-local hour. */
const SUMMARY_HOUR = 7;

type ErrorRow = typeof schema.errorLog.$inferSelect;

function clip(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function textsFor(language: string) {
  return EMAIL_TEXTS[isLanguage(language) ? language : "en"];
}

function describe(row: ErrorRow) {
  return [
    row.code,
    row.at,
    row.deviceName ?? row.source,
    `v${row.appVersion}`,
    row.action,
    row.message,
  ].join(" · ");
}

/** Logs a failure inside the Worker or the Scheduler and returns its code; never throws. */
export async function logServerError(
  db: Db,
  now: Date,
  action: string,
  error: unknown,
  deviceName: string | null = null,
) {
  const code = newErrorCode();
  try {
    await db.insert(schema.errorLog).values({
      id: randomId(),
      code,
      at: now.toISOString(),
      source: "server",
      deviceName,
      appVersion: APP_VERSION,
      action: action.slice(0, 200),
      message: (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(
        0,
        1000,
      ),
    });
  } catch (logError) {
    console.error("error log failed", logError);
  }
  return code;
}

/** The Worker's error handler: logs the failure and answers 500 with its code. */
export const unexpectedError: ErrorHandler<AppEnv> = async (error, c) => {
  console.error(error);
  const action = `${c.req.method} ${new URL(c.req.url).pathname}`;
  const code = await logServerError(
    c.get("db"),
    c.get("now"),
    action,
    error,
    c.get("device")?.name,
  );
  return c.json({ error: "server_error", code }, 500);
};

/** Settings › Error log, and the errors devices send (also later, after being offline). */
export const errorRoutes = new Hono<AppEnv>().use(requireDevice);

errorRoutes.post("/errors", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!isErrorCode(body.code)) return c.json({ error: "invalid", field: "code" }, 400);
  const now = c.get("now");
  const at = new Date(typeof body.at === "string" ? body.at : NaN);
  await c
    .get("db")
    .insert(schema.errorLog)
    .values({
      id: randomId(),
      code: body.code,
      // A queued error keeps its own time; a clock in the future is not believed.
      at: (Number.isNaN(at.getTime()) || at > now ? now : at).toISOString(),
      source: "device",
      deviceName: c.get("device").name,
      appVersion: clip(body.appVersion, 40) || "unknown",
      action: clip(body.action, 200),
      message: clip(body.message, 1000),
    })
    // The same error sent twice (a retry after going offline) is kept once.
    .onConflictDoNothing();
  return c.body(null, 204);
});

errorRoutes.get("/errors", async (c) => {
  const since = new Date(c.get("now").getTime() - ERROR_LOG_DAYS * DAY).toISOString();
  const rows = await c
    .get("db")
    .select({
      code: schema.errorLog.code,
      at: schema.errorLog.at,
      source: schema.errorLog.source,
      deviceName: schema.errorLog.deviceName,
      appVersion: schema.errorLog.appVersion,
      action: schema.errorLog.action,
      message: schema.errorLog.message,
      comment: schema.errorLog.comment,
    })
    .from(schema.errorLog)
    .where(gte(schema.errorLog.at, since))
    .orderBy(desc(schema.errorLog.at))
    .limit(500);
  return c.json(rows);
});

errorRoutes.post("/errors/:code/report", async (c) => {
  const db = c.get("db");
  const now = c.get("now");
  const [row] = await db
    .select()
    .from(schema.errorLog)
    .where(eq(schema.errorLog.code, c.req.param("code")));
  if (!row) return c.json({ error: "not_found" }, 404);

  const hourAgo = new Date(now.getTime() - HOUR).toISOString();
  const recent = await db
    .select({ id: schema.errorLog.id })
    .from(schema.errorLog)
    .where(gt(schema.errorLog.reportedAt, hourAgo));
  if (recent.length >= REPORTS_PER_HOUR) {
    return c.json({ error: "too_many_reports", retryAfter: 3600 }, 429);
  }

  const [family] = await db.select().from(schema.family).limit(1);
  const body = await c.req.json().catch(() => ({}));
  const comment = clip(body.comment, 1000).trim();
  await db
    .update(schema.errorLog)
    .set({ comment: comment || null, reportedAt: now.toISOString() })
    .where(eq(schema.errorLog.id, row.id));
  if (!family.recoveryEmail) return c.json({ error: "no_recovery_email" }, 409);
  const texts = textsFor(family.language);
  const sent = await sendEmail(c.env, {
    to: family.recoveryEmail,
    subject: texts.reportSubject(row.code),
    text: texts.reportText(describe(row), comment),
  });
  if (!sent) return c.json({ error: "email_failed" }, 502);
  return c.body(null, 204);
});

/**
 * Scheduler job: once a day, after 07:00 Family time, emails a summary of the errors since the
 * previous summary (only when there were any) and forgets errors older than 90 days.
 */
export async function errorSummaryJob(db: Db, env: Env, now: Date) {
  const [family] = await db.select().from(schema.family).limit(1);
  if (!family) return;
  const { today, minutes } = familyNow(family.timeZone, now);
  if (minutes < SUMMARY_HOUR * 60) return;

  const [previous] = await db
    .select()
    .from(schema.schedulerRun)
    .where(eq(schema.schedulerRun.job, "error-summary"))
    .orderBy(desc(schema.schedulerRun.at))
    .limit(1);
  if (previous?.key === today) return;
  // Claiming the day first means two overlapping runs can't both send.
  const claimed = await db
    .insert(schema.schedulerRun)
    .values({ job: "error-summary", key: today, at: now.toISOString() })
    .onConflictDoNothing()
    .returning();
  if (claimed.length === 0) return;

  await db
    .delete(schema.errorLog)
    .where(lt(schema.errorLog.at, new Date(now.getTime() - ERROR_LOG_DAYS * DAY).toISOString()));
  const since = previous?.at ?? new Date(now.getTime() - DAY).toISOString();
  const errors = await db
    .select()
    .from(schema.errorLog)
    .where(and(gte(schema.errorLog.at, since), lt(schema.errorLog.at, now.toISOString())))
    .orderBy(schema.errorLog.at);
  if (errors.length === 0 || !family.recoveryEmail) return;
  const texts = textsFor(family.language);
  await sendEmail(env, {
    to: family.recoveryEmail,
    subject: texts.summarySubject(errors.length),
    text: texts.summaryText(errors.map(describe).join("\n")),
  });
}
