import { sql } from "drizzle-orm";
import type { Db } from "./db";
import { schema } from "./db";

/** Workers AI calls (dictation, voice, Suggestions) one Account may make per day. */
export const AI_CALLS_PER_DAY = 300;
/** Errors one Signed-in Device may log per hour; a loop of failures stops filling the log. */
export const ERRORS_PER_HOUR = 60;
/** All attachments together stay well inside the free R2 storage. */
export const ATTACHMENTS_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;

export const day = (now: Date) => now.toISOString().slice(0, 10);
export const hour = (now: Date) => now.toISOString().slice(0, 13);

/**
 * Counts one use of `key` in `window` and says whether it is still within `limit`. One atomic
 * upsert: a new window starts again at 1.
 */
export async function withinLimit(db: Db, key: string, window: string, limit: number) {
  const t = schema.usageCount;
  const [row] = await db
    .insert(t)
    .values({ key, window, count: 1 })
    .onConflictDoUpdate({
      target: t.key,
      set: {
        count: sql`CASE WHEN ${t.window} = ${window} THEN ${t.count} + 1 ELSE 1 END`,
        window,
      },
    })
    .returning({ count: t.count });
  return row.count <= limit;
}
