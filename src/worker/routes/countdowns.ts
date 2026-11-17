import { eq, inArray, or } from "drizzle-orm";
import { Hono } from "hono";
import { nextCountdowns } from "../../core/countdown";
import { todayIn } from "../../core/plain-date";
import type { Account } from "../auth/account";
import { schema, type Db } from "../db";
import { seesInFull } from "../private";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";
import { allEntries } from "./entries";

/**
 * Countdowns: the Wall's "days to go" for the Entries marked for it, the Birthdays and
 * Christmas. Private Entries never count: the Wall is seen by everyone in the house.
 */
export const countdownRoutes = new Hono<AppEnv>().use(requireDevice);

countdownRoutes.get("/countdowns", async (c) => {
  const db = c.get("db");
  const viewer = c.get("account");
  const [[family], [birthdayType], marks] = await Promise.all([
    db.select({ timeZone: schema.family.timeZone }).from(schema.family),
    db
      .select({ id: schema.entryType.id })
      .from(schema.entryType)
      .where(eq(schema.entryType.builtinKey, "birthday")),
    db.select({ entryId: schema.countdownMark.entryId }).from(schema.countdownMark),
  ]);
  const markedIds = marks.map((m) => m.entryId);
  const conditions = [
    ...(markedIds.length > 0 ? [inArray(schema.entry.id, markedIds)] : []),
    ...(birthdayType ? [eq(schema.entry.entryTypeId, birthdayType.id)] : []),
  ];
  const entries = conditions.length > 0 ? await allEntries(db, or(...conditions)) : [];
  const shown = entries.filter((e) => !e.private);
  const today = todayIn(family?.timeZone ?? "Europe/Lisbon", c.get("now"));
  const items = nextCountdowns(
    shown.filter((e) => markedIds.includes(e.id)),
    shown.filter((e) => !markedIds.includes(e.id) && e.entryTypeId === birthdayType?.id),
    today,
  );
  return c.json({
    items,
    // Which Entries are marked, for the switch on the Entry; never a hidden one.
    marked: entries
      .filter((e) => markedIds.includes(e.id) && seesInFull(viewer, e, e.personIds))
      .map((e) => e.id),
  });
});

/** The Entry, when this Account sees it in full; a hidden Private one is as good as missing. */
async function visibleEntry(db: Db, viewer: Account, id: string) {
  const [entry] = await allEntries(db, eq(schema.entry.id, id));
  return entry && seesInFull(viewer, entry, entry.personIds) ? entry : null;
}

countdownRoutes.put("/countdowns/:entryId", async (c) => {
  const entry = await visibleEntry(c.get("db"), c.get("account"), c.req.param("entryId"));
  if (!entry) return c.json({ error: "not_found" }, 404);
  await c
    .get("db")
    .insert(schema.countdownMark)
    .values({ entryId: entry.id, createdAt: c.get("now").toISOString() })
    .onConflictDoNothing();
  return c.body(null, 204);
});

countdownRoutes.delete("/countdowns/:entryId", async (c) => {
  const entry = await visibleEntry(c.get("db"), c.get("account"), c.req.param("entryId"));
  if (!entry) return c.json({ error: "not_found" }, 404);
  await c.get("db").delete(schema.countdownMark).where(eq(schema.countdownMark.entryId, entry.id));
  return c.body(null, 204);
});
