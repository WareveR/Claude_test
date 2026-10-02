import { app } from "./app";
import { getDb } from "./db";
import { startDueRounds } from "./routes/checklists";

export default {
  fetch: app.fetch,
  /** One Cron Trigger every 5 minutes; each job decides by the clock whether it's due. */
  async scheduled(controller, env) {
    await startDueRounds(getDb(env.DB), new Date(controller.scheduledTime));
  },
} satisfies ExportedHandler<Env>;
