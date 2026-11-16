import { app } from "./app";
import { backupJob, imageCleanupJob } from "./backup";
import { getDb, type Db } from "./db";
import { startDueRounds } from "./routes/checklists";
import { errorSummaryJob, logServerError } from "./routes/errors";
import { weatherJob } from "./routes/weather";
import { briefingJob } from "./routes/briefing";
import { reminderJob } from "./routes/reminders";

type Job = (db: Db, env: Env, now: Date) => Promise<void>;

/**
 * Scheduler jobs by Cron Trigger, in order; a failing job goes to the Error Log and the others
 * still run. Only Reminders need every 5 minutes: the rest decide by the clock and are happy
 * with a quarter-hour, which keeps the frequent run within the free plan's CPU time.
 */
const SCHEDULES: Record<string, Record<string, Job>> = {
  "*/5 * * * *": { reminders: reminderJob },
  "*/15 * * * *": {
    "checklist-rounds": (db, _env, now) => startDueRounds(db, now),
    weather: weatherJob,
    briefing: briefingJob,
    backup: backupJob,
    "image-cleanup": imageCleanupJob,
    "error-summary": errorSummaryJob,
  },
};

export default {
  fetch: app.fetch,
  /** Runs the jobs of the Cron Trigger that fired; an unknown one (a manual run) runs them all. */
  async scheduled(controller, env) {
    const db = getDb(env.DB);
    const now = new Date(controller.scheduledTime);
    const jobs = SCHEDULES[controller.cron] ?? Object.assign({}, ...Object.values(SCHEDULES));
    for (const [name, job] of Object.entries<Job>(jobs)) {
      try {
        await job(db, env, now);
      } catch (error) {
        console.error(name, error);
        await logServerError(db, now, `scheduler ${name}`, error);
      }
    }
  },
} satisfies ExportedHandler<Env>;
