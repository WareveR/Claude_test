import { and, eq, isNotNull } from "drizzle-orm";
import { templateText } from "../core/checklist-template";
import { isLanguage } from "../core/languages";
import { preparationFor } from "../core/preparation";
import type { Repetition } from "../core/repetition";
import type { Db } from "./db";
import { schema } from "./db";
import { createChecklist } from "./routes/checklists";

/**
 * Gives a new Entry the predefined list its title or type calls for ("Natação" → the swimming
 * bag), linked to it, due on its day and repeating with it, all items to do; the Family edits or
 * removes it like any other. Nothing when no list fits or the Family deleted that list.
 */
export async function prepareEntry(
  db: Db,
  entry: {
    id: string;
    title: string;
    entryTypeId: string;
    startDate: string;
    repetition: Repetition | null;
    personIds: string[];
  },
  at: Date,
) {
  const [type] = await db
    .select({ builtinKey: schema.entryType.builtinKey })
    .from(schema.entryType)
    .where(eq(schema.entryType.id, entry.entryTypeId));
  const key = preparationFor(entry.title, type?.builtinKey ?? null);
  if (!key) return;
  const [template] = await db
    .select()
    .from(schema.checklistTemplate)
    .where(eq(schema.checklistTemplate.builtinKey, key));
  if (!template) return;
  const [family] = await db.select({ language: schema.family.language }).from(schema.family);
  const text = templateText(template, isLanguage(family?.language) ? family.language : "pt-PT");
  if (text.items.length === 0) return;
  await createChecklist(
    db,
    {
      name: text.name,
      startDate: entry.startDate,
      endDate: entry.startDate,
      repetition: entry.repetition,
      remindAtStart: false,
      entryId: entry.id,
      personIds: entry.personIds,
    },
    text.items,
    at,
  );
}

/**
 * When an Entry goes, the list made with it goes too if nobody touched it (made in the same
 * instant, nothing ticked); any other list it had stays, only unlinked.
 */
export async function dropUntouchedPreparation(db: Db, entryId: string, createdAt: string) {
  const lists = await db
    .select({ id: schema.checklist.id })
    .from(schema.checklist)
    .where(and(eq(schema.checklist.entryId, entryId), eq(schema.checklist.createdAt, createdAt)));
  for (const list of lists) {
    const ticked = await db
      .select({ id: schema.task.id })
      .from(schema.task)
      .where(and(eq(schema.task.checklistId, list.id), isNotNull(schema.task.doneAt)));
    if (ticked.length > 0) continue;
    await db.batch([
      db.delete(schema.task).where(eq(schema.task.checklistId, list.id)),
      db.delete(schema.checklist).where(eq(schema.checklist.id, list.id)),
    ]);
  }
}
