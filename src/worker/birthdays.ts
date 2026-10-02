import { eq } from "drizzle-orm";
import type { Repetition } from "../core/repetition";
import { randomId } from "./auth/crypto";
import type { Db } from "./db";
import { schema } from "./db";

const YEARLY: Repetition = { frequency: "yearly", interval: 1, end: { type: "never" } };

async function birthdayType(db: Db) {
  const [type] = await db
    .select()
    .from(schema.entryType)
    .where(eq(schema.entryType.builtinKey, "birthday"));
  return type;
}

/** The Birthday Entry kept in sync with this Person's date of birth, if any. */
export async function syncedBirthday(db: Db, personId: string) {
  const [row] = await db
    .select()
    .from(schema.entry)
    .where(eq(schema.entry.birthdayPersonId, personId));
  return row;
}

/**
 * Brings the Person's synced Birthday Entry in line with their date of birth: created when a date
 * of birth appears, moved and renamed with the Person, removed when the date goes or the Person
 * is archived. Only the date, title and Person are synced; notes, Importance, icon, Reminders and
 * Private belong to the Entry.
 */
export async function syncBirthday(db: Db, personId: string, now: string) {
  const [person] = await db.select().from(schema.person).where(eq(schema.person.id, personId));
  const existing = await syncedBirthday(db, personId);
  if (!person || !person.dateOfBirth || person.archived) {
    if (existing) await db.delete(schema.entry).where(eq(schema.entry.id, existing.id));
    return;
  }
  const dob = person.dateOfBirth;
  const type = await birthdayType(db);
  if (!type) return;
  const synced = {
    title: person.name,
    entryTypeId: type.id,
    allDay: true,
    startDate: dob,
    startTime: null,
    endDate: dob,
    endTime: null,
    repetition: YEARLY,
    birthdayPersonId: personId,
    birthYearKnown: true,
  };
  if (existing) {
    const moved = existing.startDate !== dob;
    const unchanged = !moved && existing.title === person.name && existing.entryTypeId === type.id;
    if (unchanged) return;
    await db.batch([
      db
        .update(schema.entry)
        .set({ ...synced, changedAt: now })
        .where(eq(schema.entry.id, existing.id)),
      // Exceptions are keyed by the old dates, which no longer fall on the Birthday.
      ...(moved
        ? [
            db
              .delete(schema.occurrenceException)
              .where(eq(schema.occurrenceException.entryId, existing.id)),
          ]
        : []),
    ]);
    return;
  }
  const id = randomId();
  await db.batch([
    db.insert(schema.entry).values({
      id,
      ...synced,
      importance: type.defaults.importance ?? "normal",
      location: "",
      notes: "",
      icon: null,
      private: false,
      reminders: type.defaults.reminders ?? [],
      createdAt: now,
      changedAt: now,
    }),
    db.insert(schema.entryPerson).values({ entryId: id, personId }),
  ]);
}

/**
 * Keeps an archived Person's Birthday on the calendar: it loses its Person link and becomes an
 * ordinary, Family-wide, hand-editable Birthday Entry.
 */
export async function detachBirthday(db: Db, personId: string, now: string) {
  const existing = await syncedBirthday(db, personId);
  if (!existing) return;
  await db.batch([
    db
      .update(schema.entry)
      .set({ birthdayPersonId: null, changedAt: now })
      .where(eq(schema.entry.id, existing.id)),
    db.delete(schema.entryPerson).where(eq(schema.entryPerson.entryId, existing.id)),
  ]);
}
