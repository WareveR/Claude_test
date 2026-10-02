import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
