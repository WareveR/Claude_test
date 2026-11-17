import { and, asc, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import {
  parseContract,
  paymentTask,
  type Contract,
  type ContractInput,
} from "../../core/contracts";
import { todayIn } from "../../core/plain-date";
import { randomId } from "../auth/crypto";
import { schema, type Db } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

/** Far more than any Family pays. */
export const MAX_CONTRACTS = 200;

type Row = typeof schema.contract.$inferSelect;

function present(row: Row): Contract {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    amount: row.amount,
    frequency: row.frequency,
    payment: row.payment,
    payDay: row.payDay,
    payMonth: row.payMonth,
    renewalDate: row.renewalDate,
    notes: row.notes,
    createdAt: row.createdAt,
    changedAt: row.changedAt,
  };
}

/** The open (not yet ticked) Task of a series. */
async function openTask(db: Db, seriesId: string | null) {
  if (!seriesId) return null;
  const [row] = await db
    .select()
    .from(schema.task)
    .where(and(eq(schema.task.seriesId, seriesId), isNull(schema.task.doneAt)));
  return row ?? null;
}

/**
 * Keeps the Task that pays a Contract in step with it: made when it is paid by hand, retitled
 * when it changes, moved to the new pay day only when the day changes (so a bill still unpaid
 * isn't skipped), and removed when it goes to direct debit or is deleted. Returns its series.
 */
async function syncTask(
  db: Db,
  input: ContractInput,
  before: Row | null,
  context: { accountId: string; now: Date },
): Promise<string | null> {
  const [family] = await db.select().from(schema.family).limit(1);
  const today = todayIn(family?.timeZone ?? "Europe/Lisbon", context.now);
  const language = family?.language === "en" ? "en" : "pt-PT";
  const spec = paymentTask(input, today, language);
  const open = await openTask(db, before?.taskSeriesId ?? null);
  const now = context.now.toISOString();
  if (!spec) {
    if (open) await db.delete(schema.task).where(eq(schema.task.id, open.id));
    return null;
  }
  if (!open) {
    const id = randomId();
    await db.insert(schema.task).values({
      id,
      title: spec.title,
      dueDate: spec.dueDate,
      repetition: spec.repetition,
      seriesId: id,
      createdBy: context.accountId,
      createdAt: now,
      changedAt: now,
    });
    return id;
  }
  const moved =
    !before ||
    before.frequency !== input.frequency ||
    before.payDay !== input.payDay ||
    before.payMonth !== input.payMonth;
  await db
    .update(schema.task)
    .set({
      title: spec.title,
      repetition: spec.repetition,
      ...(moved ? { dueDate: spec.dueDate } : {}),
      changedAt: now,
    })
    .where(eq(schema.task.id, open.id));
  return before?.taskSeriesId ?? null;
}

/** Contracts and bills: any Account reads and changes them. */
export const contractRoutes = new Hono<AppEnv>().use(requireDevice);

contractRoutes.get("/contracts", async (c) => {
  const rows = await c
    .get("db")
    .select()
    .from(schema.contract)
    .orderBy(asc(schema.contract.name), asc(schema.contract.id));
  return c.json(rows.map(present));
});

contractRoutes.post("/contracts", async (c) => {
  const db = c.get("db");
  const parsed = parseContract(await c.req.json().catch(() => ({})));
  if ("field" in parsed) return c.json({ error: "invalid", field: parsed.field }, 400);
  if ((await db.$count(schema.contract)) >= MAX_CONTRACTS) {
    return c.json({ error: "too_many" }, 409);
  }
  const taskSeriesId = await syncTask(db, parsed.contract, null, {
    accountId: c.get("account").id,
    now: c.get("now"),
  });
  const now = c.get("now").toISOString();
  const [row] = await db
    .insert(schema.contract)
    .values({ id: randomId(), ...parsed.contract, taskSeriesId, createdAt: now, changedAt: now })
    .returning();
  return c.json(present(row), 201);
});

contractRoutes.put("/contracts/:id", async (c) => {
  const db = c.get("db");
  const [existing] = await db
    .select()
    .from(schema.contract)
    .where(eq(schema.contract.id, c.req.param("id")));
  if (!existing) return c.json({ error: "not_found" }, 404);
  const parsed = parseContract(await c.req.json().catch(() => ({})));
  if ("field" in parsed) return c.json({ error: "invalid", field: parsed.field }, 400);
  const taskSeriesId = await syncTask(db, parsed.contract, existing, {
    accountId: c.get("account").id,
    now: c.get("now"),
  });
  const [row] = await db
    .update(schema.contract)
    .set({ ...parsed.contract, taskSeriesId, changedAt: c.get("now").toISOString() })
    .where(eq(schema.contract.id, existing.id))
    .returning();
  return c.json(present(row));
});

contractRoutes.delete("/contracts/:id", async (c) => {
  const db = c.get("db");
  const [existing] = await db
    .select()
    .from(schema.contract)
    .where(eq(schema.contract.id, c.req.param("id")));
  if (!existing) return c.json({ error: "not_found" }, 404);
  // Its Task to pay goes too; the ones already ticked stay as a record.
  const open = await openTask(db, existing.taskSeriesId);
  if (open) await db.delete(schema.task).where(eq(schema.task.id, open.id));
  await db.delete(schema.contract).where(eq(schema.contract.id, existing.id));
  return c.body(null, 204);
});
