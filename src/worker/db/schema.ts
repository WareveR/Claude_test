import { sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * The one Family of this installation (ADR-0001) and its Family-wide settings.
 * Wall-clock values are stored as text; technical timestamps as ISO UTC instants.
 */
export const family = sqliteTable("family", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  language: text("language").notNull(),
  timeZone: text("time_zone").notNull(),
  createdAt: text("created_at").notNull(),
  changedAt: text("changed_at").notNull(),
});
