import { eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { parseLift, type Lift } from "../../core/lifts";
import type { Account } from "../auth/account";
import { schema, type Db } from "../db";
import { seesInFull } from "../private";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";
import { allEntries } from "./entries";

/**
 * Lifts: who takes an Entry's Persons and who picks them up. Any Account that sees the Entry in
 * full reads and changes its Lift; a hidden Private Entry's is as good as missing.
 */
export const liftRoutes = new Hono<AppEnv>().use(requireDevice);

liftRoutes.get("/lifts", async (c) => {
  const db = c.get("db");
  const viewer = c.get("account");
  const rows = await db.select().from(schema.entryLift);
  if (rows.length === 0) return c.json([]);
  const entries = await allEntries(
    db,
    inArray(
      schema.entry.id,
      rows.map((r) => r.entryId),
    ),
  );
  const shown = new Set(entries.filter((e) => seesInFull(viewer, e, e.personIds)).map((e) => e.id));
  const lifts: Lift[] = rows
    .filter((r) => shown.has(r.entryId))
    .map((r) => ({ entryId: r.entryId, dropOffId: r.dropOffId, pickUpId: r.pickUpId }));
  return c.json(lifts);
});

async function visibleEntry(db: Db, viewer: Account, id: string) {
  const [entry] = await allEntries(db, eq(schema.entry.id, id));
  return entry && seesInFull(viewer, entry, entry.personIds) ? entry : null;
}

async function personsExist(db: Db, ids: string[]) {
  if (ids.length === 0) return true;
  const rows = await db
    .select({ id: schema.person.id })
    .from(schema.person)
    .where(inArray(schema.person.id, ids));
  return rows.length === new Set(ids).size;
}

/** Sets who takes and who picks up; either may still be nobody. */
liftRoutes.put("/lifts/:entryId", async (c) => {
  const db = c.get("db");
  const entry = await visibleEntry(db, c.get("account"), c.req.param("entryId"));
  if (!entry) return c.json({ error: "not_found" }, 404);
  const parsed = parseLift(await c.req.json().catch(() => ({})));
  if ("field" in parsed) return c.json({ error: "invalid", field: parsed.field }, 400);
  const ids = [parsed.lift.dropOffId, parsed.lift.pickUpId].filter((id): id is string => !!id);
  if (!(await personsExist(db, ids))) return c.json({ error: "invalid", field: "personId" }, 400);
  const values = { ...parsed.lift, changedAt: c.get("now").toISOString() };
  await db
    .insert(schema.entryLift)
    .values({ entryId: entry.id, ...values })
    .onConflictDoUpdate({ target: schema.entryLift.entryId, set: values });
  return c.json({ entryId: entry.id, ...parsed.lift } satisfies Lift);
});

/** The Entry needs no Lift after all. */
liftRoutes.delete("/lifts/:entryId", async (c) => {
  const db = c.get("db");
  const entry = await visibleEntry(db, c.get("account"), c.req.param("entryId"));
  if (!entry) return c.json({ error: "not_found" }, 404);
  await db.delete(schema.entryLift).where(eq(schema.entryLift.entryId, entry.id));
  return c.body(null, 204);
});
