import {
  type AnySQLiteColumn,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import type { EntryTypeDefaults, Importance, ReminderOffset } from "../../core/entry-type";
import type { DeviceKind } from "../../core/device-kind";
import type { HolidayPlace } from "../../core/holidays";
import type { Repetition } from "../../core/repetition";
import type { Segment } from "../../core/briefing";
import type { DayWeather, Forecast, HourWeather } from "../../core/weather";
import type { WasteCollection } from "../../core/waste";

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
  /** No longer used: the Family Password became the Owner's Account (migration 0035). */
  passwordHash: text("password_hash").notNull().default(""),
  /** No longer used: the recovery email became the Owner's Account email (migration 0035). */
  recoveryEmail: text("recovery_email").notNull().default(""),
  /** SHA-256 of the setup code last used, to notice when the installer sets a new one. */
  setupCodeHash: text("setup_code_hash").notNull().default(""),
  /** Countries with optional regions and municipality whose Public Holidays show. */
  holidayPlaces: text("holiday_places", { mode: "json" })
    .$type<HolidayPlace[]>()
    .notNull()
    .default([{ country: "PT" }]),
  /** Which bins are collected on which weekdays, for the Waste Layer. */
  wasteCollection: text("waste_collection", { mode: "json" })
    .$type<WasteCollection>()
    .notNull()
    .default([]),
  /** The Weather Location whose forecast every device shows; none shows no weather. */
  selectedWeatherLocationId: text("selected_weather_location_id"),
  /** When a full Export was last downloaded, shown in Settings. */
  lastExportAt: text("last_export_at"),
  /** The Family's sleeping hours, from this whole hour to that one (wrapping midnight). */
  sleepStartHour: integer("sleep_start_hour").notNull().default(23),
  sleepEndHour: integer("sleep_end_hour").notNull().default(7),
});

export type Role = "owner" | "admin" | "member";

/**
 * An adult who signs in with their own email and password. It belongs to one Person (chosen on
 * the Owner's first sign-in after accounts came in); a Person without one, like a child, never
 * signs in. Exactly one Account is the Owner.
 */
export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  personId: text("person_id").references(() => person.id, { onDelete: "set null" }),
  /** Kept in lower case; signs in and receives the recovery and notice emails. */
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<Role>().notNull(),
  /** Shows the tools for testing and diagnosing the app. */
  dev: integer("dev", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  changedAt: text("changed_at").notNull(),
});

/** A browser that signed in with an Account. Only the session token's hash is kept. */
export const signedInDevice = sqliteTable("signed_in_device", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => account.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sessionHash: text("session_hash").notNull().unique(),
  language: text("language"),
  createdAt: text("created_at").notNull(),
  lastUsedAt: text("last_used_at").notNull(),
  /** The browser's Web Push subscription; none until notifications are allowed in Settings. */
  pushSubscription: text("push_subscription", { mode: "json" }).$type<PushSubscriptionJson>(),
  remindersOn: integer("reminders_on", { mode: "boolean" }).notNull().default(true),
  /** The Persons this device is reminded about; null is everyone. Family-wide items always come. */
  reminderPersonIds: text("reminder_person_ids", { mode: "json" }).$type<string[]>(),
  /** Phone, tablet, computer…: guessed by the device itself, changeable in Settings. */
  kind: text("kind").$type<DeviceKind>(),
  /** The maker's model name when the browser tells it, like "SM-X710". */
  model: text("model"),
});

/** What a browser's PushSubscription.toJSON() gives. */
export type PushSubscriptionJson = { endpoint: string; keys: { p256dh: string; auth: string } };

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
  /** Unused since items nest (migration 0027 turned sections into parent items); always "". */
  section: text("section").notNull().default(""),
  /**
   * The item this one sits inside, in the same Checklist; null at the top. An item with items
   * of its own is done when all of them are, and goes with its parent.
   */
  parentId: text("parent_id").references((): AnySQLiteColumn => task.id, { onDelete: "cascade" }),
  /** The Entry a loose Task prepares for, shown with it; never set on a Checklist's items. */
  entryId: text("entry_id").references(() => entry.id, { onDelete: "set null" }),
  /** High comes first among the Tasks due the same day. */
  importance: text("importance").$type<Importance>().notNull().default("normal"),
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
  /** A Reminder at 09:00 on the first day of its period. */
  remindAtStart: integer("remind_at_start", { mode: "boolean" }).notNull().default(true),
  /** The Entry this Checklist prepares for, such as a party or a trip, shown with it. */
  entryId: text("entry_id").references(() => entry.id, { onDelete: "set null" }),
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
 * A Checklist template, Family-wide: a name and the ordered names of its items. A built-in one
 * carries its builtinKey and no name or items until the Family edits it, so each device reads
 * it in its own language; restoring defaults clears them again.
 */
export const checklistTemplate = sqliteTable("checklist_template", {
  id: text("id").primaryKey(),
  builtinKey: text("builtin_key"),
  name: text("name"),
  items: text("items", { mode: "json" }).$type<string[] | null>(),
  createdAt: text("created_at").notNull(),
  changedAt: text("changed_at").notNull(),
});

/**
 * A single-use link sent by email to one Account: choosing a new password (valid 1 hour) or confirming
 * a new recovery email (valid 24 hours). Only the token's hash is kept.
 */
export const recoveryToken = sqliteTable("recovery_token", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  purpose: text("purpose").$type<"password" | "email">().notNull(),
  /** The Account whose password or email it changes. */
  accountId: text("account_id").references(() => account.id, { onDelete: "cascade" }),
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

/**
 * The last forecast read for each day at a Weather Location, kept after the day has passed so
 * past days still show their weather: the day's summary and its hours.
 */
export const weatherDay = sqliteTable(
  "weather_day",
  {
    locationId: text("location_id")
      .notNull()
      .references(() => weatherLocation.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    day: text("day", { mode: "json" }).$type<DayWeather>().notNull(),
    hours: text("hours", { mode: "json" }).$type<HourWeather[]>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.locationId, t.date] })],
);

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

/** Each Reminder sent ("entry:<id>:<date>:<offset>"), so none is sent twice. */
export const reminderSent = sqliteTable("reminder_sent", {
  key: text("key").primaryKey(),
  sentAt: text("sent_at").notNull(),
});

/**
 * One item of the Family's Shopping List. A bought one leaves the list after its day (in the
 * Family Time Zone) but stays, so its name is suggested again; deleting removes it for good.
 * Its section is worked out from the name, never stored.
 */
export const shoppingItem = sqliteTable("shopping_item", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** Free text: "2", "1 kg"; "" for none. */
  quantity: text("quantity").notNull().default(""),
  note: text("note").notNull().default(""),
  /** The shop it is to be bought at, as typed; "" for any shop. */
  store: text("store").notNull().default(""),
  boughtAt: text("bought_at"),
  createdAt: text("created_at").notNull(),
  changedAt: text("changed_at").notNull(),
});

/**
 * Someone in the Family Tree: to show the children where they come from. Not a Person: never
 * on the calendar, and may have lived long ago.
 */
export const relative = sqliteTable("relative", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nickname: text("nickname").notNull().default(""),
  /** "f", "m", or "" when not said; picks words like "avó" or "avô". */
  sex: text("sex").notNull().default(""),
  birthDate: text("birth_date"),
  deathDate: text("death_date"),
  birthPlace: text("birth_place").notNull().default(""),
  /** R2 key of the photo, shrunk in the browser; images are never overwritten. */
  photoKey: text("photo_key"),
  /** Free text: stories, what they liked, where they lived. */
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull(),
  changedAt: text("changed_at").notNull(),
});

/** A Relative's parent; at most two each. */
export const relativeParent = sqliteTable(
  "relative_parent",
  {
    childId: text("child_id")
      .notNull()
      .references(() => relative.id, { onDelete: "cascade" }),
    parentId: text("parent_id")
      .notNull()
      .references(() => relative.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.childId, t.parentId] })],
);

/** Two Relatives who are or were a couple, stored once with the smaller id first. */
export const relativePartner = sqliteTable(
  "relative_partner",
  {
    aId: text("a_id")
      .notNull()
      .references(() => relative.id, { onDelete: "cascade" }),
    bId: text("b_id")
      .notNull()
      .references(() => relative.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.aId, t.bId] })],
);
