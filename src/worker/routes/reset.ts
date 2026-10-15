import { eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { BUILT_IN_DEFAULTS, BUILT_IN_TYPES } from "../../core/entry-type";
import { RESET_PARTS, type ResetPart } from "../../core/reset";
import { verifyPassword } from "../auth/password";
import { clearFailures, clientIp, recordFailure, retryAfter } from "../auth/throttle";
import { snapshot } from "../backup";
import type { Db } from "../db";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";
import { seedBuiltInTemplates } from "./checklist-templates";

/**
 * Settings › Danger zone: deletes the chosen kinds of data for good. The Family Password, the
 * recovery email and the Signed-in Devices always stay. Images no longer used go with the
 * nightly clean-up 30 days later, so the copy saved just before still finds them.
 */
export const resetRoutes = new Hono<AppEnv>().use(requireDevice);

/** The statements that delete the chosen parts, in an order the foreign keys accept. */
export async function resetSteps(db: Db, parts: Set<ResetPart>, now: string) {
  const persons = parts.has("persons");
  const [general] = await db
    .select({ id: schema.entryType.id })
    .from(schema.entryType)
    .where(eq(schema.entryType.builtinKey, "general"));
  const steps = [];

  if (persons) {
    steps.push(
      db.delete(schema.entryPerson),
      db.delete(schema.taskPerson),
      db.delete(schema.checklistPerson),
      db.delete(schema.calendarFeedPerson),
      // A synced Birthday goes with its Person; one typed by hand is an ordinary Entry.
      db.delete(schema.entry).where(isNotNull(schema.entry.birthdayPersonId)),
      db.update(schema.signedInDevice).set({ reminderPersonIds: null }),
      db.delete(schema.personNickname),
      db.delete(schema.person),
    );
  }
  if (parts.has("entries")) {
    // Synced Birthdays stay while their Person does.
    steps.push(db.delete(schema.entry).where(isNull(schema.entry.birthdayPersonId)));
  }
  if (parts.has("tasks")) {
    steps.push(db.delete(schema.task), db.delete(schema.checklist));
  }
  if (parts.has("shopping")) steps.push(db.delete(schema.shoppingItem));
  if (parts.has("tree")) {
    steps.push(
      db.delete(schema.relativeParent),
      db.delete(schema.relativePartner),
      db.delete(schema.relative),
    );
  }
  if (parts.has("entryTypes")) {
    const custom = db
      .select({ id: schema.entryType.id })
      .from(schema.entryType)
      .where(isNull(schema.entryType.builtinKey));
    steps.push(
      db
        .update(schema.entry)
        .set({ entryTypeId: general.id, changedAt: now })
        .where(inArray(schema.entry.entryTypeId, custom)),
      db.delete(schema.entryType).where(isNull(schema.entryType.builtinKey)),
      ...BUILT_IN_TYPES.map((key) =>
        db
          .update(schema.entryType)
          .set({
            name: null,
            color: BUILT_IN_DEFAULTS[key].color,
            icon: BUILT_IN_DEFAULTS[key].icon,
            thumbnailKey: null,
            defaults: BUILT_IN_DEFAULTS[key].defaults,
            changedAt: now,
          })
          .where(eq(schema.entryType.builtinKey, key)),
      ),
    );
  }
  if (parts.has("templates")) {
    steps.push(db.delete(schema.checklistTemplate), ...seedBuiltInTemplates(db, now));
  }
  if (parts.has("settings")) {
    steps.push(
      db.update(schema.family).set({
        holidayPlaces: [{ country: "PT" }],
        wasteCollection: [],
        selectedWeatherLocationId: null,
        sleepStartHour: 23,
        sleepEndHour: 7,
        changedAt: now,
      }),
      db.delete(schema.weatherLocation),
      db.delete(schema.calendarFeed),
    );
  }
  if (parts.has("errors")) steps.push(db.delete(schema.errorLog));
  // The Briefings are rewritten from what is left at the Scheduler's next run.
  steps.push(
    db.delete(schema.briefing),
    db.insert(schema.briefingPending).values({ id: 1 }).onConflictDoNothing(),
  );
  return steps;
}

/**
 * Checks the Family Password, saves a full copy to the Backup bucket ("before-reset/…", restored
 * by hand like any Backup) and deletes the chosen parts at once. With `check`, only the password
 * is checked, so the device can download the Export before anything is deleted.
 */
resetRoutes.post("/reset", async (c) => {
  const db = c.get("db");
  const now = c.get("now");
  const ip = clientIp(c);
  const wait = await retryAfter(db, ip, now);
  if (wait > 0) return c.json({ error: "too_many_attempts", retryAfter: wait }, 429);

  const body = await c.req.json().catch(() => ({}));
  const parts = Array.isArray(body.parts) ? body.parts : [];
  if (parts.length === 0 || !parts.every((p: unknown) => RESET_PARTS.includes(p as ResetPart))) {
    return c.json({ error: "invalid", field: "parts" }, 400);
  }
  const [family] = await db.select().from(schema.family).limit(1);
  if (!(await verifyPassword(String(body.password ?? ""), family.passwordHash))) {
    await recordFailure(db, ip, now);
    return c.json({ error: "wrong_password" }, 401);
  }
  await clearFailures(db, ip);
  if (body.check === true) return c.body(null, 204);

  await c.env.BACKUPS.put(
    `before-reset/${now.toISOString()}.json`,
    JSON.stringify(await snapshot(c.env.DB, now)),
    { httpMetadata: { contentType: "application/json" } },
  );
  const [first, ...rest] = await resetSteps(db, new Set(parts as ResetPart[]), now.toISOString());
  await db.batch([first, ...rest]);
  return c.body(null, 204);
});
