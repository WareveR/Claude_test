import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { isPlainDate } from "../../core/plain-date";
import { randomId } from "../auth/crypto";
import { detachBirthday, syncBirthday, syncedBirthday } from "../birthdays";
import type { Db } from "../db";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

const COLOR = /^#[0-9a-f]{6}$/i;

export type PersonInput = {
  name: string;
  color: string;
  photoKey: string | null;
  dateOfBirth: string | null;
  nicknames: string[];
  archived: boolean;
};

/** Validates a full or partial Person; returns the bad field's name or the clean values. */
function parsePerson(body: Record<string, unknown>, partial: boolean) {
  const out: Partial<PersonInput> = {};
  if (!partial || "name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return { field: "name" };
    out.name = name;
  }
  if (!partial || "color" in body) {
    if (typeof body.color !== "string" || !COLOR.test(body.color)) return { field: "color" };
    out.color = body.color.toLowerCase();
  }
  if ("photoKey" in body) {
    if (body.photoKey !== null && typeof body.photoKey !== "string") return { field: "photoKey" };
    out.photoKey = body.photoKey as string | null;
  }
  if ("dateOfBirth" in body) {
    const dob = body.dateOfBirth;
    if (dob !== null && (typeof dob !== "string" || !isPlainDate(dob))) {
      return { field: "dateOfBirth" };
    }
    out.dateOfBirth = dob as string | null;
  }
  if ("nicknames" in body) {
    if (!Array.isArray(body.nicknames)) return { field: "nicknames" };
    const names = body.nicknames
      .filter((n): n is string => typeof n === "string")
      .map((n) => n.trim())
      .filter(Boolean);
    out.nicknames = [...new Set(names)];
  }
  if ("archived" in body) out.archived = Boolean(body.archived);
  return { values: out };
}

async function listPersons(db: Db) {
  const persons = await db.select().from(schema.person).orderBy(asc(schema.person.name));
  const nicknames = await db.select().from(schema.personNickname);
  return persons.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    photoKey: p.photoKey,
    dateOfBirth: p.dateOfBirth,
    archived: p.archived,
    nicknames: nicknames.filter((n) => n.personId === p.id).map((n) => n.nickname),
  }));
}

/**
 * Whether any Entry or Task mentions the Person; such a Person can only be archived.
 * Entries and Tasks add their checks here as they arrive.
 */
export const personMentionChecks: ((db: Db, personId: string) => Promise<boolean>)[] = [];

async function isMentioned(db: Db, personId: string) {
  for (const check of personMentionChecks) if (await check(db, personId)) return true;
  return false;
}

export const personRoutes = new Hono<AppEnv>().use(requireDevice);

personRoutes.get("/persons", async (c) => c.json(await listPersons(c.get("db"))));

personRoutes.post("/persons", async (c) => {
  const db = c.get("db");
  const parsed = parsePerson(await c.req.json().catch(() => ({})), false);
  if (!parsed.values) return c.json({ error: "invalid", field: parsed.field }, 400);
  const v = parsed.values;
  const now = c.get("now").toISOString();
  const id = randomId();
  await db.batch([
    db.insert(schema.person).values({
      id,
      name: v.name!,
      color: v.color!,
      photoKey: v.photoKey ?? null,
      dateOfBirth: v.dateOfBirth ?? null,
      archived: v.archived ?? false,
      createdAt: now,
      changedAt: now,
    }),
    ...(v.nicknames ?? []).map((nickname) =>
      db.insert(schema.personNickname).values({ id: randomId(), personId: id, nickname }),
    ),
  ]);
  await syncBirthday(db, id, now);
  const person = (await listPersons(db)).find((p) => p.id === id);
  return c.json(person, 201);
});

personRoutes.patch("/persons/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = parsePerson(body, true);
  if (!parsed.values) return c.json({ error: "invalid", field: parsed.field }, 400);
  const { nicknames, ...fields } = parsed.values;
  const [existing] = await db.select().from(schema.person).where(eq(schema.person.id, id));
  if (!existing) return c.json({ error: "not_found" }, 404);
  const now = c.get("now").toISOString();
  // Archiving asks whether to keep the Birthday on the calendar, then Family-wide.
  if (fields.archived && !existing.archived && body.keepBirthday === true) {
    await detachBirthday(db, id, now);
  }
  await db.batch([
    db
      .update(schema.person)
      .set({ ...fields, changedAt: now })
      .where(eq(schema.person.id, id)),
    ...(nicknames
      ? [
          db.delete(schema.personNickname).where(eq(schema.personNickname.personId, id)),
          ...nicknames.map((nickname) =>
            db.insert(schema.personNickname).values({ id: randomId(), personId: id, nickname }),
          ),
        ]
      : []),
  ]);
  await syncBirthday(db, id, now);
  return c.json((await listPersons(db)).find((p) => p.id === id));
});

personRoutes.delete("/persons/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  if (await isMentioned(db, id)) return c.json({ error: "person_in_use" }, 409);
  const birthday = await syncedBirthday(db, id);
  const deletePerson = db
    .delete(schema.person)
    .where(eq(schema.person.id, id))
    .returning({ id: schema.person.id });
  // The synced Birthday goes with its Person, before the Person it points at.
  const deleted = birthday
    ? (
        await db.batch([
          db.delete(schema.entry).where(eq(schema.entry.id, birthday.id)),
          deletePerson,
        ])
      )[1]
    : await deletePerson;
  if (deleted.length === 0) return c.json({ error: "not_found" }, 404);
  return c.body(null, 204);
});
