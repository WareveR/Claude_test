import { eq, inArray } from "drizzle-orm";
import type { Db } from "../db";
import { schema } from "../db";

/** Wrong attempts allowed before each further attempt has to wait. */
export const FREE_ATTEMPTS = 5;
const MAX_WAIT_SECONDS = 15 * 60;

/** Seconds to wait after `failures` wrong attempts: 1, 2, 4, … up to 15 minutes. */
export function waitSeconds(failures: number): number {
  if (failures < FREE_ATTEMPTS) return 0;
  return Math.min(2 ** (failures - FREE_ATTEMPTS), MAX_WAIT_SECONDS);
}

export function clientIp(c: { req: { header(name: string): string | undefined } }): string {
  return c.req.header("CF-Connecting-IP") ?? "unknown";
}

function keys(ip: string) {
  return [`ip:${ip}`, "global"];
}

/** Returns how many seconds the caller must still wait, or 0 when it may try now. */
export async function retryAfter(db: Db, ip: string, now: Date): Promise<number> {
  const rows = await db
    .select()
    .from(schema.signInThrottle)
    .where(inArray(schema.signInThrottle.key, keys(ip)));
  let wait = 0;
  for (const row of rows) {
    const readyAt = Date.parse(row.lastFailureAt) + waitSeconds(row.failures) * 1000;
    wait = Math.max(wait, Math.ceil((readyAt - now.getTime()) / 1000));
  }
  return wait;
}

export async function recordFailure(db: Db, ip: string, now: Date): Promise<void> {
  for (const key of keys(ip)) {
    const [row] = await db
      .select()
      .from(schema.signInThrottle)
      .where(eq(schema.signInThrottle.key, key));
    await db
      .insert(schema.signInThrottle)
      .values({ key, failures: (row?.failures ?? 0) + 1, lastFailureAt: now.toISOString() })
      .onConflictDoUpdate({
        target: schema.signInThrottle.key,
        set: { failures: (row?.failures ?? 0) + 1, lastFailureAt: now.toISOString() },
      });
  }
}

export async function clearFailures(db: Db, ip: string): Promise<void> {
  await db.delete(schema.signInThrottle).where(inArray(schema.signInThrottle.key, keys(ip)));
}
