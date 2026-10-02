import { app } from "./app";
import { backupJob, imageCleanupJob } from "./backup";
import { getDb, type Db } from "./db";
import { startDueRounds } from "./routes/checklists";
import { errorSummaryJob, logServerError } from "./routes/errors";
import { weatherJob } from "./routes/weather";

/** Scheduler jobs, in order; a failing job goes to the Error Log and the others still run. */
const JOBS: Record<string, (db: Db, env: Env, now: Date) => Promise<void>> = {
  "checklist-rounds": (db, _env, now) => startDueRounds(db, now),
  weather: weatherJob,
  backup: backupJob,
  "image-cleanup": imageCleanupJob,
  "error-summary": errorSummaryJob,
};

export default {
  fetch: app.fetch,
  /** One Cron Trigger every 5 minutes; each job decides by the clock whether it's due. */
  async scheduled(controller, env) {
    const db = getDb(env.DB);
    const now = new Date(controller.scheduledTime);
    for (const [name, job] of Object.entries(JOBS)) {
      try {
        await job(db, env, now);
      } catch (error) {
        console.error(name, error);
        await logServerError(db, now, `scheduler ${name}`, error);
      }
    }
  },
} satisfies ExportedHandler<Env>;
