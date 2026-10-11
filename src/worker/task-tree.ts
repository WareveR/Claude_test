import { eq } from "drizzle-orm";
import { settleDone } from "../core/task-tree";
import type { Db } from "./db";
import { schema } from "./db";

/**
 * Brings a Checklist's items with items in line with what they hold (core/task-tree.ts), after
 * a tick, or after an item was added, moved or deleted.
 */
export async function settleChecklist(
  db: Db,
  checklistId: string,
  at: string,
  tick?: { id: string; done: boolean },
) {
  const items = await db
    .select({ id: schema.task.id, parentId: schema.task.parentId, doneAt: schema.task.doneAt })
    .from(schema.task)
    .where(eq(schema.task.checklistId, checklistId));
  const changes = settleDone(items, at, tick);
  if (changes.length === 0) return;
  const [first, ...rest] = changes.map((change) =>
    db
      .update(schema.task)
      .set({ doneAt: change.doneAt, changedAt: at })
      .where(eq(schema.task.id, change.id)),
  );
  await db.batch([first, ...rest]);
}
