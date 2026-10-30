import { Hono } from "hono";
import { calendar } from "../../core/ics";
import { APP_VERSION } from "../../core/version";
import { readTables } from "../backup";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";
import type { Account } from "../auth/account";
import { seesInFull } from "../private";
import { allEntries, forViewer } from "./entries";
import { BUSY } from "./feeds";

/**
 * The tables a full Export holds, with columns it leaves out. Never the password hash, secrets,
 * Signed-in Devices or the Error Log; a new table must be added here or to NOT_EXPORTED.
 */
export const EXPORTED: Record<string, string[]> = {
  family: ["password_hash", "setup_code_hash"],
  account: ["password_hash"],
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
  shopping_item: [],
  relative: [],
  relative_parent: [],
  relative_partner: [],
  attachment: [],
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

type Row = Record<string, unknown>;

/**
 * Blanks what an Account may not see of Private Entries and Tasks in the Export: each keeps its
 * dates and Persons, like in the calendar.
 */
function hidePrivate(tables: Record<string, Row[]>, viewer: Account) {
  const personsOf = (links: Row[], key: string) => {
    const map = new Map<string, string[]>();
    for (const l of links)
      map.set(l[key] as string, [...(map.get(l[key] as string) ?? []), l.person_id as string]);
    return map;
  };
  const sees = (row: Row, personIds: string[]) =>
    seesInFull(
      viewer,
      { private: Boolean(row.private), createdBy: (row.created_by as string | null) ?? null },
      personIds,
    );
  const entryPersons = personsOf(tables.entry_person, "entry_id");
  const hiddenEntries = new Map<string, Row>();
  for (const row of tables.entry) {
    if (sees(row, entryPersons.get(row.id as string) ?? [])) continue;
    Object.assign(row, { title: "", location: "", notes: "", icon: null });
    hiddenEntries.set(row.id as string, row);
  }
  for (const e of tables.occurrence_exception) {
    if (typeof e.override !== "string") continue;
    const override = JSON.parse(e.override) as Row;
    const entry = tables.entry.find((r) => r.id === e.entry_id);
    const hidden =
      hiddenEntries.has(e.entry_id as string) ||
      (override.private === true &&
        entry !== undefined &&
        !sees({ ...entry, private: true }, (override.personIds as string[] | undefined) ?? []));
    if (hidden) e.override = JSON.stringify({ ...override, title: "", location: "", notes: "" });
  }
  const taskPersons = personsOf(tables.task_person, "task_id");
  const hiddenTasks = new Set<string>();
  for (const row of tables.task) {
    if (sees(row, taskPersons.get(row.id as string) ?? [])) continue;
    Object.assign(row, { title: "", notes: "" });
    hiddenTasks.add(row.id as string);
  }
  // A hidden Entry's or Task's attachments are left out altogether, names included.
  tables.attachment = tables.attachment.filter(
    (a) => !hiddenEntries.has(a.entry_id as string) && !hiddenTasks.has(a.task_id as string),
  );
}

/** Settings › Export. The browser fetches the images itself and builds the ZIP. */
export const exportRoutes = new Hono<AppEnv>().use(requireDevice);

exportRoutes.get("/export", async (c) => {
  const tables = await readTables(c.env.DB, Object.keys(EXPORTED));
  for (const [name, hidden] of Object.entries(EXPORTED)) {
    for (const row of tables[name]) for (const column of hidden) delete row[column];
  }
  hidePrivate(tables, c.get("account"));
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

/**
 * Every Entry as one .ics file, Private ones included in full when this Account may see them,
 * otherwise as busy.
 */
exportRoutes.get("/export/entries.ics", async (c) => {
  const db = c.get("db");
  const [[family], entries] = await Promise.all([
    db.select().from(schema.family).limit(1),
    allEntries(db),
  ]);
  const busy = BUSY[family.language] ?? BUSY.en;
  const viewer = c.get("account");
  const shown = entries.map((entry) => {
    const seen = forViewer(viewer, entry);
    const exceptions = seen.exceptions.map((e) =>
      e.override?.hidden ? { ...e, override: { ...e.override, title: busy } } : e,
    );
    return { ...seen, title: seen.hidden ? busy : seen.title, exceptions };
  });
  const body = calendar(shown, {
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
