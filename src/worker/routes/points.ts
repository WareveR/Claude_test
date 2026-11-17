import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { randomId } from "../auth/crypto";
import { schema } from "../db";
import { requireDevice } from "../require-device";
import type { AppEnv } from "../types";

/** One Person's standing: points earned less rewards given, and what they save for. */
export type PointsStanding = {
  personId: string;
  points: number;
  goal: number | null;
  reward: string;
};

export const MAX_GOAL = 10_000;
const MAX_REWARD = 100;

/**
 * Points and allowance: Tasks with points earn them for their Persons when ticked; each Person
 * may save for a goal and a reward. Only Persons with points or a goal are listed.
 */
export const pointsRoutes = new Hono<AppEnv>().use(requireDevice);

pointsRoutes.get("/points", async (c) => {
  const db = c.get("db");
  const [sums, goals] = await Promise.all([
    db
      .select({
        personId: schema.pointsEntry.personId,
        points: sql<number>`sum(${schema.pointsEntry.points})`,
      })
      .from(schema.pointsEntry)
      .groupBy(schema.pointsEntry.personId),
    db.select().from(schema.pointsGoal),
  ]);
  const ids = new Set([...sums.map((s) => s.personId), ...goals.map((g) => g.personId)]);
  const standings: PointsStanding[] = [...ids].map((personId) => {
    const goal = goals.find((g) => g.personId === personId);
    return {
      personId,
      points: Number(sums.find((s) => s.personId === personId)?.points ?? 0),
      goal: goal?.goal ?? null,
      reward: goal?.reward ?? "",
    };
  });
  return c.json(standings);
});

/** Sets what a Person saves for; a goal of null takes it away. */
pointsRoutes.put("/points/:personId/goal", async (c) => {
  const db = c.get("db");
  const personId = c.req.param("personId");
  const [person] = await db
    .select({ id: schema.person.id })
    .from(schema.person)
    .where(eq(schema.person.id, personId));
  if (!person) return c.json({ error: "not_found" }, 404);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const goal = body.goal ?? null;
  if (goal === null) {
    await db.delete(schema.pointsGoal).where(eq(schema.pointsGoal.personId, personId));
    return c.body(null, 204);
  }
  if (!Number.isInteger(goal) || (goal as number) < 1 || (goal as number) > MAX_GOAL) {
    return c.json({ error: "invalid", field: "goal" }, 400);
  }
  const reward = typeof body.reward === "string" ? body.reward.trim() : "";
  if (reward.length > MAX_REWARD) return c.json({ error: "invalid", field: "reward" }, 400);
  await db
    .insert(schema.pointsGoal)
    .values({ personId, goal: goal as number, reward })
    .onConflictDoUpdate({
      target: schema.pointsGoal.personId,
      set: { goal: goal as number, reward },
    });
  return c.body(null, 204);
});

/** The reward was given: its points are spent. */
pointsRoutes.post("/points/:personId/redeem", async (c) => {
  const db = c.get("db");
  const personId = c.req.param("personId");
  const [goal] = await db
    .select()
    .from(schema.pointsGoal)
    .where(eq(schema.pointsGoal.personId, personId));
  if (!goal) return c.json({ error: "not_found" }, 404);
  const [sum] = await db
    .select({ points: sql<number>`coalesce(sum(${schema.pointsEntry.points}), 0)` })
    .from(schema.pointsEntry)
    .where(eq(schema.pointsEntry.personId, personId));
  if (Number(sum.points) < goal.goal) return c.json({ error: "not_enough" }, 409);
  await db.insert(schema.pointsEntry).values({
    id: randomId(),
    personId,
    points: -goal.goal,
    taskId: null,
    createdAt: c.get("now").toISOString(),
  });
  return c.body(null, 204);
});
