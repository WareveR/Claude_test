import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { EntryTypeDefaults, Importance, ReminderOffset } from "../../core/entry-type";
import type { HolidayPlace } from "../../core/holidays";
import type { Repetition } from "../../core/repetition";
import type { Segment } from "../../core/briefing";
import type { Forecast } from "../../core/weather";

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
  /** Countries with optional regions and municipality whose Public Holidays show. */
  holidayPlaces: text("holiday_places", { mode: "json" })
    .$type<HolidayPlace[]>()
    .notNull()
    .default([{ country: "PT" }]),
  /** The Weather Location whose forecast every device shows; none shows no weather. */
  selectedWeatherLocationId: text("selected_weather_location_id"),
  /** When a full Export was last downloaded, shown in Settings. */
  lastExportAt: text("last_export_at"),
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

/**
 * Something on the calendar. Times are wall-clock in the Family Time Zone (ADR-0002): a Timed
 * Entry has start date + time and an optional end; an All-day Entry has an inclusive date range.
 */
export const entry = sqliteTable("entry", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  entryTypeId: text("entry_type_id")
    .notNull()
    .references(() => entryType.id),
  allDay: integer("all_day", { mode: "boolean" }).notNull(),
  startDate: text("start_date").notNull(),
  startTime: text("start_time"),
  endDate: text("end_date"),
  endTime: text("end_time"),
  importance: text("importance").$type<Importance>().notNull().default("normal"),
  location: text("location").notNull().default(""),
  notes: text("notes").notNull().default(""),
  /** Overrides the Entry Type's icon; from the app's fixed set. */
  icon: text("icon"),
  private: integer("private", { mode: "boolean" }).notNull().default(false),
  reminders: text("reminders", { mode: "json" }).$type<ReminderOffset[]>().notNull(),
  repetition: text("repetition", { mode: "json" }).$type<Repetition | null>(),
  /** Links the Entries a "this and the following" change split one series into. */
  seriesId: text("series_id"),
  /** A Birthday Entry kept in sync with this Person's date of birth; it fixes date and Person. */
  birthdayPersonId: text("birthday_person_id").references(() => person.id),
  /** A Birthday Entry whose start date carries the real birth year, so the age can show. */
  birthYearKnown: integer("birth_year_known", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  changedAt: text("changed_at").notNull(),
});

/** The Persons an Entry is for; none means Family-wide. */
export const entryPerson = sqliteTable(
  "entry_person",
  {
    entryId: text("entry_id")
      .notNull()
      .references(() => entry.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => person.id),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.personId] })],
);

/**
 * One Occurrence of a repeating Entry skipped or edited alone, keyed by the Entry and the
 * Occurrence's original date. The override holds the changed fields (never the Repetition).
 */
export const occurrenceException = sqliteTable(
  "occurrence_exception",
  {
    entryId: text("entry_id")
      .notNull()
      .references(() => entry.id, { onDelete: "cascade" }),
    originalDate: text("original_date").notNull(),
    skipped: integer("skipped", { mode: "boolean" }).notNull().default(false),
    override: text("override", { mode: "json" }).$type<Record<string, unknown> | null>(),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.originalDate] })],
);

/**
 * A to-do beside the calendar. The due date and time are wall-clock in the Family Time Zone;
 * `doneAt` records when any device ticked it done.
 */
export const task = sqliteTable("task", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  notes: text("notes").notNull().default(""),
  dueDate: text("due_date"),
  dueTime: text("due_time"),
  private: integer("private", { mode: "boolean" }).notNull().default(false),
  doneAt: text("done_at"),
  /** A repeating Task brings up the next one when ticked; needs a due date. */
  repetition: text("repetition", { mode: "json" }).$type<Repetition | null>(),
  /** Links the Tasks of one repeating series. */
  seriesId: text("series_id"),
  /** The Task whose tick created this one; undoing that tick removes it if still untouched. */
  repeatOf: text("repeat_of"),
  /** The Checklist this Task belongs to, if any; such a Task doesn't repeat on its own. */
  checklistId: text("checklist_id").references(() => checklist.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull(),
  changedAt: text("changed_at").notNull(),
});

/** The Persons a Task is for; none means Family-wide. */
export const taskPerson = sqliteTable(
  "task_person",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => person.id),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.personId] })],
);

/**
 * A group of ordinary Tasks with progress, such as summer cleaning. Its optional period makes it
 * not pending before the start and its undone Tasks overdue at the end. No Private switch.
 */
export const checklist = sqliteTable("checklist", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
  /** Brings the Checklist back as a new round, its period moving to the next date. */
  repetition: text("repetition", { mode: "json" }).$type<Repetition | null>(),
  createdAt: text("created_at").notNull(),
  changedAt: text("changed_at").notNull(),
});

/** A closed round of a Checklist: only its result is kept ("2025: 7 of 8"). */
export const checklistRound = sqliteTable("checklist_round", {
  id: text("id").primaryKey(),
  checklistId: text("checklist_id")
    .notNull()
    .references(() => checklist.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  done: integer("done").notNull(),
  total: integer("total").notNull(),
  closedAt: text("closed_at").notNull(),
});

/** A Checklist's Persons: only the default for its new Tasks, each Task keeps its own. */
export const checklistPerson = sqliteTable(
  "checklist_person",
  {
    checklistId: text("checklist_id")
      .notNull()
      .references(() => checklist.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => person.id),
  },
  (t) => [primaryKey({ columns: [t.checklistId, t.personId] })],
);

/**
 * A single-use link sent by email: choosing a new Family Password (valid 1 hour) or confirming
 * a new recovery email (valid 24 hours). Only the token's hash is kept.
 */
export const recoveryToken = sqliteTable("recovery_token", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  purpose: text("purpose").$type<"password" | "email">().notNull(),
  /** The recovery email waiting to be confirmed. */
  newEmail: text("new_email"),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
});

/**
 * Failures seen by any device or by the Worker, kept 90 days. Never holds notes or titles:
 * the action and message are technical (a request path, an error name).
 */
export const errorLog = sqliteTable("error_log", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  at: text("at").notNull(),
  source: text("source").$type<"device" | "server">().notNull(),
  /** A copy of the device's name; devices come and go. */
  deviceName: text("device_name"),
  appVersion: text("app_version").notNull(),
  action: text("action").notNull(),
  message: text("message").notNull(),
  comment: text("comment"),
  reportedAt: text("reported_at"),
});

/** Which Scheduler jobs already ran for which key (usually a Family-local day). */
export const schedulerRun = sqliteTable(
  "scheduler_run",
  {
    job: text("job").notNull(),
    key: text("key").notNull(),
    at: text("at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.job, t.key] })],
);

/**
 * A read-only .ics address other calendar apps subscribe to. Only the secret's hash is kept,
 * so the full address is shown once, when the Feed is created or replaced.
 */
export const calendarFeed = sqliteTable("calendar_feed", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  secretHash: text("secret_hash").notNull().unique(),
  /** Whether Entries for no Person in particular are included. */
  familyWide: integer("family_wide", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  replacedAt: text("replaced_at"),
});

/** The Persons a Feed covers; none means every Person. */
export const calendarFeedPerson = sqliteTable(
  "calendar_feed_person",
  {
    feedId: text("feed_id")
      .notNull()
      .references(() => calendarFeed.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => person.id),
  },
  (t) => [primaryKey({ columns: [t.feedId, t.personId] })],
);

/** A place saved for the weather, found with Open-Meteo's geocoding search; up to 10. */
export const weatherLocation = sqliteTable("weather_location", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** The region, like a district; may be empty. */
  admin: text("admin").notNull(),
  country: text("country").notNull(),
  countryCode: text("country_code").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  createdAt: text("created_at").notNull(),
});

/** The last Open-Meteo forecast fetched for a Weather Location, and when fetching last ran. */
export const weatherCache = sqliteTable("weather_cache", {
  locationId: text("location_id")
    .primaryKey()
    .references(() => weatherLocation.id, { onDelete: "cascade" }),
  forecast: text("forecast", { mode: "json" }).$type<Forecast>(),
  fetchedAt: text("fetched_at"),
  attemptedAt: text("attempted_at").notNull(),
});

/** The latest Briefing per scope ("family" or a Person's id) and language. */
export const briefing = sqliteTable(
  "briefing",
  {
    scope: text("scope").notNull(),
    language: text("language").notNull(),
    segments: text("segments", { mode: "json" }).$type<Segment[]>().notNull(),
    /** Written as the countdown list because the model failed. */
    fallback: integer("fallback", { mode: "boolean" }).notNull(),
    writtenAt: text("written_at").notNull(),
    /** What the next 7 days looked like when written; a change means a rewrite. */
    week: text("week").notNull().default(""),
  },
  (t) => [primaryKey({ columns: [t.scope, t.language] })],
);

/** One row while an Entry or Task changed since the Scheduler last checked the Briefings. */
export const briefingPending = sqliteTable("briefing_pending", {
  id: integer("id").primaryKey(),
});
