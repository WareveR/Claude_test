import { eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { calendar, type FeedEntry } from "../../core/ics";
import { matchesFilter } from "../../core/person-filter";
import { randomId, randomToken, sha256 } from "../auth/crypto";
import type { Db } from "../db";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";
import { allEntries } from "./entries";
import { personMentionChecks } from "./persons";

/** What a Private Entry is called in a Feed, in the Family Language. */
const BUSY: Record<string, string> = { "pt-PT": "Ocupado", en: "Busy" };

function feedUrl(c: Context<AppEnv>, secret: string) {
  return `${new URL(c.req.url).origin}/api/feed/${secret}.ics`;
}

async function listFeeds(db: Db) {
  const [feeds, links] = await Promise.all([
    db.select().from(schema.calendarFeed).orderBy(schema.calendarFeed.createdAt),
    db.select().from(schema.calendarFeedPerson),
  ]);
  return feeds.map((feed) => ({
    id: feed.id,
    name: feed.name,
    familyWide: feed.familyWide,
    personIds: links.filter((l) => l.feedId === feed.id).map((l) => l.personId),
    createdAt: feed.createdAt,
    replacedAt: feed.replacedAt,
  }));
}

async function parseFeed(db: Db, body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  if (!name) return { field: "name" };
  const personIds = Array.isArray(body.personIds) ? [...new Set(body.personIds)] : [];
  if (!personIds.every((p): p is string => typeof p === "string")) return { field: "personIds" };
  const persons = await db.select({ id: schema.person.id }).from(schema.person);
  if (!personIds.every((p) => persons.some((person) => person.id === p))) {
    return { field: "personIds" };
  }
  return { values: { name, personIds, familyWide: body.familyWide !== false } };
}

// A Person a Feed covers is archived rather than deleted, so the Feed never widens.
personMentionChecks.push(async (db, personId) => {
  const [link] = await db
    .select()
    .from(schema.calendarFeedPerson)
    .where(eq(schema.calendarFeedPerson.personId, personId))
    .limit(1);
  return Boolean(link);
});

/** Settings › Calendar Feeds. */
export const feedRoutes = new Hono<AppEnv>().use(requireDevice);

feedRoutes.get("/feeds", async (c) => c.json(await listFeeds(c.get("db"))));

feedRoutes.post("/feeds", async (c) => {
  const db = c.get("db");
  const parsed = await parseFeed(db, await c.req.json().catch(() => ({})));
  if (!parsed.values) return c.json({ error: "invalid", field: parsed.field }, 400);
  const { name, personIds, familyWide } = parsed.values;
  const id = randomId();
  const secret = randomToken();
  await db.batch([
    db.insert(schema.calendarFeed).values({
      id,
      name,
      familyWide,
      secretHash: await sha256(secret),
      createdAt: c.get("now").toISOString(),
    }),
    ...personIds.map((personId) =>
      db.insert(schema.calendarFeedPerson).values({ feedId: id, personId }),
    ),
  ]);
  const feed = (await listFeeds(db)).find((f) => f.id === id)!;
  // The only time the address is shown: only its hash is kept.
  return c.json({ ...feed, url: feedUrl(c, secret) }, 201);
});

/** Replace: a new address; the old one stops working at once. */
feedRoutes.post("/feeds/:id/replace", async (c) => {
  const db = c.get("db");
  const secret = randomToken();
  const updated = await db
    .update(schema.calendarFeed)
    .set({ secretHash: await sha256(secret), replacedAt: c.get("now").toISOString() })
    .where(eq(schema.calendarFeed.id, c.req.param("id")))
    .returning({ id: schema.calendarFeed.id });
  if (updated.length === 0) return c.json({ error: "not_found" }, 404);
  const feed = (await listFeeds(db)).find((f) => f.id === updated[0].id)!;
  return c.json({ ...feed, url: feedUrl(c, secret) });
});

/** Revoke: the address stops working and the Feed is gone. */
feedRoutes.delete("/feeds/:id", async (c) => {
  const deleted = await c
    .get("db")
    .delete(schema.calendarFeed)
    .where(eq(schema.calendarFeed.id, c.req.param("id")))
    .returning({ id: schema.calendarFeed.id });
  if (deleted.length === 0) return c.json({ error: "not_found" }, 404);
  return c.body(null, 204);
});

/**
 * The .ics itself, read by other calendar apps without a session: the secret in the address
 * is the only key. Holds Entries only, never Tasks, Checklists or Public Holidays.
 */
export const publicFeedRoutes = new Hono<AppEnv>();

publicFeedRoutes.get("/feed/:file", async (c) => {
  const db = c.get("db");
  const file = c.req.param("file");
  if (!file.endsWith(".ics")) return c.json({ error: "not_found" }, 404);
  const [feed] = await db
    .select()
    .from(schema.calendarFeed)
    .where(eq(schema.calendarFeed.secretHash, await sha256(file.slice(0, -4))));
  if (!feed) return c.json({ error: "not_found" }, 404);

  const [[family], links, entries] = await Promise.all([
    db.select().from(schema.family).limit(1),
    db
      .select()
      .from(schema.calendarFeedPerson)
      .where(eq(schema.calendarFeedPerson.feedId, feed.id)),
    allEntries(db),
  ]);
  const filter = {
    personIds: links.map((l) => l.personId),
    familyWide: feed.familyWide,
    holidays: false,
  };
  const included: FeedEntry[] = entries
    .filter((entry) => matchesFilter(entry.personIds, filter))
    .map((entry) => ({
      ...entry,
      // An Occurrence moved to Persons outside the Feed leaves it.
      exceptions: entry.exceptions.map((e) => {
        const ids = (e.override as { personIds?: string[] } | null)?.personIds;
        return ids && !matchesFilter(ids, filter)
          ? { date: e.date, skipped: true, override: null }
          : e;
      }),
    }));

  const body = calendar(included, {
    name: feed.name,
    timeZone: family.timeZone,
    busy: BUSY[family.language] ?? BUSY.en,
    now: c.get("now"),
  });
  return c.body(body, 200, {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": 'inline; filename="calendar.ics"',
    "Cache-Control": "private, max-age=300",
  });
});
