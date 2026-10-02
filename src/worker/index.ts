import { app } from "./app";

export default {
  fetch: app.fetch,
  async scheduled() {
    // The Scheduler's jobs arrive with their tickets (#58 onwards).
  },
} satisfies ExportedHandler<Env>;
