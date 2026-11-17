import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { parseGift, seesGiftsFor, type GiftIdea } from "../../core/gifts";
import type { Account } from "../auth/account";
import { randomId } from "../auth/crypto";
import { schema, type Db } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

/** Far more than any Family notes down. */
export const MAX_GIFTS = 1000;

type Row = typeof schema.giftIdea.$inferSelect;

function present(row: Row): GiftIdea {
  return {
    id: row.id,
    personId: row.personId,
    text: row.text,
    link: row.link,
    occasion: row.occasion,
    givenOn: row.givenOn,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    changedAt: row.changedAt,
  };
}

async function personExists(db: Db, id: string) {
  const [row] = await db
    .select({ id: schema.person.id })
    .from(schema.person)
    .where(eq(schema.person.id, id));
  return Boolean(row);
}

/** The idea, unless it is for this Account's own Person: then it is as good as missing. */
async function visibleGift(db: Db, viewer: Account, id: string) {
  const [row] = await db.select().from(schema.giftIdea).where(eq(schema.giftIdea.id, id));
  return row && seesGiftsFor(viewer, row.personId) ? row : null;
}

/**
 * Gift Ideas: every Account reads and changes them, except those for its own Person, which it
 * never sees and can't add (they would vanish from it at once).
 */
export const giftRoutes = new Hono<AppEnv>().use(requireDevice);

giftRoutes.get("/gifts", async (c) => {
  const viewer = c.get("account");
  const rows = await c
    .get("db")
    .select()
    .from(schema.giftIdea)
    .orderBy(asc(schema.giftIdea.createdAt), asc(schema.giftIdea.id));
  return c.json(rows.filter((r) => seesGiftsFor(viewer, r.personId)).map(present));
});

async function readBody(c: { req: { json(): Promise<unknown> } }, db: Db, viewer: Account) {
  const parsed = parseGift((await c.req.json().catch(() => ({}))) as Record<string, unknown>);
  if ("field" in parsed) return parsed;
  if (!(await personExists(db, parsed.gift.personId))) return { field: "personId" };
  if (!seesGiftsFor(viewer, parsed.gift.personId)) return { field: "personId" };
  return parsed;
}

giftRoutes.post("/gifts", async (c) => {
  const db = c.get("db");
  const viewer = c.get("account");
  const parsed = await readBody(c, db, viewer);
  if ("field" in parsed) return c.json({ error: "invalid", field: parsed.field }, 400);
  if ((await db.$count(schema.giftIdea)) >= MAX_GIFTS) return c.json({ error: "too_many" }, 409);
  const now = c.get("now").toISOString();
  const [row] = await db
    .insert(schema.giftIdea)
    .values({
      id: randomId(),
      ...parsed.gift,
      createdBy: viewer.id,
      createdAt: now,
      changedAt: now,
    })
    .returning();
  return c.json(present(row), 201);
});

giftRoutes.put("/gifts/:id", async (c) => {
  const db = c.get("db");
  const viewer = c.get("account");
  const existing = await visibleGift(db, viewer, c.req.param("id"));
  if (!existing) return c.json({ error: "not_found" }, 404);
  const parsed = await readBody(c, db, viewer);
  if ("field" in parsed) return c.json({ error: "invalid", field: parsed.field }, 400);
  const [row] = await db
    .update(schema.giftIdea)
    .set({ ...parsed.gift, changedAt: c.get("now").toISOString() })
    .where(eq(schema.giftIdea.id, existing.id))
    .returning();
  return c.json(present(row));
});

giftRoutes.delete("/gifts/:id", async (c) => {
  const db = c.get("db");
  const existing = await visibleGift(db, c.get("account"), c.req.param("id"));
  if (!existing) return c.json({ error: "not_found" }, 404);
  await db.delete(schema.giftIdea).where(eq(schema.giftIdea.id, existing.id));
  return c.body(null, 204);
});
