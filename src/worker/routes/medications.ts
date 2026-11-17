import { and, asc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { isClockTime } from "../../core/entry-time";
import { parseMedication, type Dose, type Medication } from "../../core/medication";
import { isPlainDate } from "../../core/plain-date";
import type { Account } from "../auth/account";
import { randomId } from "../auth/crypto";
import { schema, type Db } from "../db";
import { seesInFull } from "../private";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

/** Far more than any Family takes at once. */
export const MAX_MEDICATIONS = 200;

type Row = typeof schema.medication.$inferSelect;

export function presentMedication(row: Row): Medication {
  return {
    id: row.id,
    personId: row.personId,
    name: row.name,
    dose: row.dose,
    times: row.times as Medication["times"],
    startDate: row.startDate,
    endDate: row.endDate,
    private: row.private,
    notes: row.notes,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    changedAt: row.changedAt,
  };
}

/** Whether this Account sees the Medication at all: a hidden Private one is not even listed. */
export function seesMedication(viewer: Pick<Account, "id" | "personId">, row: Row) {
  return seesInFull(viewer, row, [row.personId]);
}

async function visibleMedication(db: Db, viewer: Account, id: string) {
  const [row] = await db.select().from(schema.medication).where(eq(schema.medication.id, id));
  return row && seesMedication(viewer, row) ? row : null;
}

async function personExists(db: Db, id: string) {
  const [row] = await db
    .select({ id: schema.person.id })
    .from(schema.person)
    .where(eq(schema.person.id, id));
  return Boolean(row);
}

/**
 * Medications and the doses taken. A Private Medication (the default) is seen, changed and
 * ticked only by whoever added it and the Account of its Person; for everyone else it does not
 * exist.
 */
export const medicationRoutes = new Hono<AppEnv>().use(requireDevice);

medicationRoutes.get("/medications", async (c) => {
  const viewer = c.get("account");
  const rows = await c
    .get("db")
    .select()
    .from(schema.medication)
    .orderBy(asc(schema.medication.name), asc(schema.medication.id));
  return c.json(rows.filter((row) => seesMedication(viewer, row)).map(presentMedication));
});

medicationRoutes.post("/medications", async (c) => {
  const db = c.get("db");
  const parsed = parseMedication(await c.req.json().catch(() => ({})));
  if ("field" in parsed) return c.json({ error: "invalid", field: parsed.field }, 400);
  if (!(await personExists(db, parsed.medication.personId))) {
    return c.json({ error: "invalid", field: "personId" }, 400);
  }
  if ((await db.$count(schema.medication)) >= MAX_MEDICATIONS) {
    return c.json({ error: "too_many" }, 409);
  }
  const now = c.get("now").toISOString();
  const [row] = await db
    .insert(schema.medication)
    .values({
      id: randomId(),
      ...parsed.medication,
      createdBy: c.get("account").id,
      createdAt: now,
      changedAt: now,
    })
    .returning();
  return c.json(presentMedication(row), 201);
});

medicationRoutes.put("/medications/:id", async (c) => {
  const db = c.get("db");
  const viewer = c.get("account");
  const existing = await visibleMedication(db, viewer, c.req.param("id"));
  if (!existing) return c.json({ error: "not_found" }, 404);
  const parsed = parseMedication(await c.req.json().catch(() => ({})));
  if ("field" in parsed) return c.json({ error: "invalid", field: parsed.field }, 400);
  if (!(await personExists(db, parsed.medication.personId))) {
    return c.json({ error: "invalid", field: "personId" }, 400);
  }
  // Moving a Private one to another Person must not hide it from the one changing it.
  const next = { ...existing, ...parsed.medication };
  if (!seesMedication(viewer, next)) return c.json({ error: "invalid", field: "personId" }, 400);
  const [row] = await db
    .update(schema.medication)
    .set({ ...parsed.medication, changedAt: c.get("now").toISOString() })
    .where(eq(schema.medication.id, existing.id))
    .returning();
  return c.json(presentMedication(row));
});

medicationRoutes.delete("/medications/:id", async (c) => {
  const db = c.get("db");
  const existing = await visibleMedication(db, c.get("account"), c.req.param("id"));
  if (!existing) return c.json({ error: "not_found" }, 404);
  await db.delete(schema.medication).where(eq(schema.medication.id, existing.id));
  return c.body(null, 204);
});

/** The doses taken on a day, of the Medications this Account sees. */
medicationRoutes.get("/medications/doses", async (c) => {
  const db = c.get("db");
  const date = c.req.query("date") ?? "";
  if (!isPlainDate(date)) return c.json({ error: "invalid", field: "date" }, 400);
  const viewer = c.get("account");
  const meds = (await db.select().from(schema.medication)).filter((row) =>
    seesMedication(viewer, row),
  );
  if (meds.length === 0) return c.json([]);
  const rows = await db
    .select()
    .from(schema.medicationDose)
    .where(
      and(
        eq(schema.medicationDose.date, date),
        inArray(
          schema.medicationDose.medicationId,
          meds.map((m) => m.id),
        ),
      ),
    );
  const doses: Dose[] = rows.map((r) => ({
    medicationId: r.medicationId,
    date: r.date,
    time: r.time as Dose["time"],
    takenAt: r.takenAt,
  }));
  return c.json(doses);
});

/** The due date and time of a dose, or the first bad field. */
function readDose(body: Record<string, unknown>) {
  const { date, time } = body;
  if (typeof date !== "string" || !isPlainDate(date)) return { field: "date" } as const;
  if (typeof time !== "string" || !isClockTime(time)) return { field: "time" } as const;
  return { date, time };
}

/** Marks a dose taken: from the app, or from the "Taken" button on its Reminder. */
medicationRoutes.post("/medications/:id/doses", async (c) => {
  const db = c.get("db");
  const viewer = c.get("account");
  const med = await visibleMedication(db, viewer, c.req.param("id"));
  if (!med) return c.json({ error: "not_found" }, 404);
  const dose = readDose((await c.req.json().catch(() => ({}))) as Record<string, unknown>);
  if ("field" in dose) return c.json({ error: "invalid", field: dose.field }, 400);
  const due =
    med.times.includes(dose.time) &&
    med.startDate <= dose.date &&
    (med.endDate === null || med.endDate >= dose.date);
  if (!due) return c.json({ error: "invalid", field: "time" }, 400);
  await db
    .insert(schema.medicationDose)
    .values({
      id: randomId(),
      medicationId: med.id,
      date: dose.date,
      time: dose.time,
      takenAt: c.get("now").toISOString(),
      takenBy: viewer.id,
    })
    .onConflictDoNothing();
  return c.body(null, 204);
});

/** Takes back a dose marked by mistake. */
medicationRoutes.delete("/medications/:id/doses", async (c) => {
  const db = c.get("db");
  const med = await visibleMedication(db, c.get("account"), c.req.param("id"));
  if (!med) return c.json({ error: "not_found" }, 404);
  const dose = readDose({ date: c.req.query("date"), time: c.req.query("time") });
  if ("field" in dose) return c.json({ error: "invalid", field: dose.field }, 400);
  await db
    .delete(schema.medicationDose)
    .where(
      and(
        eq(schema.medicationDose.medicationId, med.id),
        eq(schema.medicationDose.date, dose.date),
        eq(schema.medicationDose.time, dose.time),
      ),
    );
  return c.body(null, 204);
});
