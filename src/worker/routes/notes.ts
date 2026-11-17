import { and, desc, eq, isNotNull, lt } from "drizzle-orm";
import { Hono } from "hono";
import {
  isNoteColor,
  isNoteKeep,
  MAX_NOTE,
  noteShows,
  noteUntil,
  type Note,
} from "../../core/notes";
import { todayIn } from "../../core/plain-date";
import { randomId } from "../auth/crypto";
import { schema, type Db } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

/** The most Notes up at once: a Wall full of paper is read by no one. */
export const MAX_NOTES = 30;

async function familyToday(db: Db, now: Date) {
  const [family] = await db.select({ timeZone: schema.family.timeZone }).from(schema.family);
  return todayIn(family?.timeZone ?? "Europe/Lisbon", now);
}

/**
 * Notes on the Wall: any Account writes or removes one, in Display Mode too, like paper on the
 * fridge. Those past their last day are no longer listed and go when the next one is written.
 */
export const noteRoutes = new Hono<AppEnv>().use(requireDevice);

noteRoutes.get("/notes", async (c) => {
  const db = c.get("db");
  const today = await familyToday(db, c.get("now"));
  const rows = await db
    .select({
      id: schema.note.id,
      text: schema.note.text,
      color: schema.note.color,
      until: schema.note.until,
      createdAt: schema.note.createdAt,
      author: schema.person.name,
    })
    .from(schema.note)
    .leftJoin(schema.account, eq(schema.account.id, schema.note.authorAccountId))
    .leftJoin(schema.person, eq(schema.person.id, schema.account.personId))
    .orderBy(desc(schema.note.createdAt), desc(schema.note.id));
  const notes: Note[] = rows
    .filter((r) => noteShows(r, today))
    .map((r) => ({
      id: r.id,
      text: r.text,
      color: isNoteColor(r.color) ? r.color : "#fff59d",
      until: r.until,
      author: r.author ?? "",
      createdAt: r.createdAt,
    }));
  return c.json(notes);
});

noteRoutes.post("/notes", async (c) => {
  const db = c.get("db");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  // The browser may name the Note, so voice can offer to undo it.
  const id = body.id === undefined ? randomId() : body.id;
  if (typeof id !== "string" || !/^[\w-]{1,64}$/.test(id)) {
    return c.json({ error: "invalid", field: "id" }, 400);
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > MAX_NOTE) return c.json({ error: "invalid", field: "text" }, 400);
  if (!isNoteColor(body.color)) return c.json({ error: "invalid", field: "color" }, 400);
  if (!isNoteKeep(body.keep)) return c.json({ error: "invalid", field: "keep" }, 400);
  const today = await familyToday(db, c.get("now"));
  // Out-of-date Notes are cleared here, so they never pile up.
  await db
    .delete(schema.note)
    .where(and(isNotNull(schema.note.until), lt(schema.note.until, today)));
  const up = await db.select({ id: schema.note.id }).from(schema.note);
  if (up.some((n) => n.id === id)) return c.json({ error: "exists" }, 409);
  if (up.length >= MAX_NOTES) return c.json({ error: "too_many" }, 409);
  const [row] = await db
    .insert(schema.note)
    .values({
      id,
      text,
      color: body.color,
      until: noteUntil(body.keep, today),
      authorAccountId: c.get("account").id,
      createdAt: c.get("now").toISOString(),
    })
    .returning();
  const account = c.get("account");
  const [person] = account.personId
    ? await db
        .select({ name: schema.person.name })
        .from(schema.person)
        .where(eq(schema.person.id, account.personId))
    : [];
  const note: Note = {
    id: row.id,
    text: row.text,
    color: body.color,
    until: row.until,
    author: person?.name ?? "",
    createdAt: row.createdAt,
  };
  return c.json(note, 201);
});

noteRoutes.delete("/notes/:id", async (c) => {
  const deleted = await c
    .get("db")
    .delete(schema.note)
    .where(eq(schema.note.id, c.req.param("id")))
    .returning({ id: schema.note.id });
  if (deleted.length === 0) return c.json({ error: "not_found" }, 404);
  return c.body(null, 204);
});
