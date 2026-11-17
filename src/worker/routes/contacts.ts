import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { parseContact, type Contact } from "../../core/contacts";
import { randomId } from "../auth/crypto";
import { schema, type Db } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

/** A Family's address book stays short; this is far more than any needs. */
export const MAX_CONTACTS = 500;

type Row = typeof schema.contact.$inferSelect;

function present(row: Row): Contact {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    phone: row.phone,
    email: row.email,
    personId: row.personId,
    notes: row.notes,
    createdAt: row.createdAt,
    changedAt: row.changedAt,
  };
}

async function personExists(db: Db, id: string | null) {
  if (id === null) return true;
  const [row] = await db
    .select({ id: schema.person.id })
    .from(schema.person)
    .where(eq(schema.person.id, id));
  return Boolean(row);
}

/** The Family's useful Contacts: any Account reads and changes them. */
export const contactRoutes = new Hono<AppEnv>().use(requireDevice);

contactRoutes.get("/contacts", async (c) => {
  const rows = await c
    .get("db")
    .select()
    .from(schema.contact)
    .orderBy(asc(schema.contact.name), asc(schema.contact.id));
  return c.json(rows.map(present));
});

contactRoutes.post("/contacts", async (c) => {
  const db = c.get("db");
  const parsed = parseContact(await c.req.json().catch(() => ({})));
  if ("field" in parsed) return c.json({ error: "invalid", field: parsed.field }, 400);
  if (!(await personExists(db, parsed.contact.personId))) {
    return c.json({ error: "invalid", field: "personId" }, 400);
  }
  const count = await db.$count(schema.contact);
  if (count >= MAX_CONTACTS) return c.json({ error: "too_many" }, 409);
  const now = c.get("now").toISOString();
  const [row] = await db
    .insert(schema.contact)
    .values({ id: randomId(), ...parsed.contact, createdAt: now, changedAt: now })
    .returning();
  return c.json(present(row), 201);
});

contactRoutes.put("/contacts/:id", async (c) => {
  const db = c.get("db");
  const parsed = parseContact(await c.req.json().catch(() => ({})));
  if ("field" in parsed) return c.json({ error: "invalid", field: parsed.field }, 400);
  if (!(await personExists(db, parsed.contact.personId))) {
    return c.json({ error: "invalid", field: "personId" }, 400);
  }
  const [row] = await db
    .update(schema.contact)
    .set({ ...parsed.contact, changedAt: c.get("now").toISOString() })
    .where(eq(schema.contact.id, c.req.param("id")))
    .returning();
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json(present(row));
});

contactRoutes.delete("/contacts/:id", async (c) => {
  const deleted = await c
    .get("db")
    .delete(schema.contact)
    .where(eq(schema.contact.id, c.req.param("id")))
    .returning({ id: schema.contact.id });
  if (deleted.length === 0) return c.json({ error: "not_found" }, 404);
  return c.body(null, 204);
});
