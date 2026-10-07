import { Hono } from "hono";
import { calendar } from "../../core/ics";
import { APP_VERSION } from "../../core/version";
import { readTables } from "../backup";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";
import { allEntries } from "./entries";

/**
 * The tables a full Export holds, with columns it leaves out. Never the password hash, secrets,
 * Signed-in Devices or the Error Log; a new table must be added here or to NOT_EXPORTED.
 */
export const EXPORTED: Record<string, string[]> = {
  family: ["password_hash", "setup_code_hash"],
  person: [],
  person_nickname: [],
  image: [],
  entry_type: [],
  entry: [],
  entry_person: [],
  occurrence_exception: [],
  task: [],
  task_person: [],
  checklist: [],
  checklist_round: [],
  checklist_person: [],
  checklist_template: [],
  calendar_feed: ["secret_hash"],
  calendar_feed_person: [],
  weather_location: [],
};

export const NOT_EXPORTED = new Set([
  "d1_migrations",
  "signed_in_device",
  "sign_in_throttle",
  "recovery_token",
  "error_log",
  "scheduler_run",
  "weather_cache",
  "weather_day",
  "briefing",
  "briefing_pending",
  "reminder_sent",
]);

/** Settings › Export. The browser fetches the images itself and builds the ZIP. */
export const exportRoutes = new Hono<AppEnv>().use(requireDevice);

exportRoutes.get("/export", async (c) => {
  const tables = await readTables(c.env.DB, Object.keys(EXPORTED));
  for (const [name, hidden] of Object.entries(EXPORTED)) {
    for (const row of tables[name]) for (const column of hidden) delete row[column];
  }
  return c.json({
    format: "family-calendar-export",
    version: 1,
    appVersion: APP_VERSION,
    exportedAt: c.get("now").toISOString(),
    tables,
  });
});

/** The browser says the ZIP was saved; Settings shows when. */
exportRoutes.post("/export/done", async (c) => {
  const lastExportAt = c.get("now").toISOString();
  await c.get("db").update(schema.family).set({ lastExportAt });
  return c.json({ lastExportAt });
});

/** Every Entry as one .ics file, Private ones included in full. */
exportRoutes.get("/export/entries.ics", async (c) => {
  const db = c.get("db");
  const [[family], entries] = await Promise.all([
    db.select().from(schema.family).limit(1),
    allEntries(db),
  ]);
  const body = calendar(entries, {
    name: family.name,
    timeZone: family.timeZone,
    busy: "",
    revealPrivate: true,
    now: c.get("now"),
  });
  return c.body(body, 200, {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": 'attachment; filename="entries.ics"',
    "Cache-Control": "no-store",
  });
});
