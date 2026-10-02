import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { EntryTypeDefaults } from "../../core/entry-type";

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
  passwordHash: text("password_hash").notNull().default(""),
  recoveryEmail: text("recovery_email").notNull().default(""),
  /** SHA-256 of the setup code last used, to notice when the installer sets a new one. */
  setupCodeHash: text("setup_code_hash").notNull().default(""),
});

/** A browser that signed in with the Family Password. Only the session token's hash is kept. */
export const signedInDevice = sqliteTable("signed_in_device", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sessionHash: text("session_hash").notNull().unique(),
  language: text("language"),
  createdAt: text("created_at").notNull(),
  lastUsedAt: text("last_used_at").notNull(),
});

/** Wrong sign-in or setup attempts, per client IP ("ip:…") and for the whole Family ("global"). */
export const signInThrottle = sqliteTable("sign_in_throttle", {
  key: text("key").primaryKey(),
  failures: integer("failures").notNull(),
  lastFailureAt: text("last_failure_at").notNull(),
});

/** Someone in the Family whom Entries and Tasks can be for. Archived Persons stay on old items. */
export const person = sqliteTable("person", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  /** R2 key of the photo, shrunk in the browser; images are never overwritten. */
  photoKey: text("photo_key"),
  dateOfBirth: text("date_of_birth"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  changedAt: text("changed_at").notNull(),
});

/** Other names Voice Entry understands for a Person ("Mum", "Di"); never shown in views. */
export const personNickname = sqliteTable("person_nickname", {
  id: text("id").primaryKey(),
  personId: text("person_id")
    .notNull()
    .references(() => person.id, { onDelete: "cascade" }),
  nickname: text("nickname").notNull(),
});

/** Uploaded images (Person photos, Entry Type thumbnails) and when each was last referenced. */
export const image = sqliteTable("image", {
  key: text("key").primaryKey(),
  contentType: text("content_type").notNull(),
  createdAt: text("created_at").notNull(),
  lastUsedAt: text("last_used_at").notNull(),
});

/**
 * An Entry Type: built-in ones carry a builtinKey and no name until the Family renames them,
 * so each device shows the name in its own language.
 */
export const entryType = sqliteTable("entry_type", {
  id: text("id").primaryKey(),
  builtinKey: text("builtin_key"),
  name: text("name"),
  color: text("color").notNull(),
  icon: text("icon"),
  thumbnailKey: text("thumbnail_key"),
  defaults: text("defaults", { mode: "json" }).$type<EntryTypeDefaults>().notNull(),
  createdAt: text("created_at").notNull(),
  changedAt: text("changed_at").notNull(),
});
