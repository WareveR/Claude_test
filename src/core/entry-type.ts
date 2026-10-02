import type { Repetition } from "./repetition";

export const IMPORTANCES = ["low", "normal", "high"] as const;
export type Importance = (typeof IMPORTANCES)[number];

/** The app's fixed icon set for Entry Types and Entries; the views draw them as line icons. */
export const ICONS = [
  "calendar",
  "cake",
  "plane",
  "stethoscope",
  "ticket",
  "bike",
  "party",
  "school",
  "briefcase",
  "car",
  "home",
  "heart",
  "music",
  "utensils",
  "baby",
  "dog",
  "gift",
  "star",
  "sun",
  "book",
  "cart",
  "phone",
  "trophy",
  "pin",
] as const;
export type Icon = (typeof ICONS)[number];

/**
 * A Reminder is minutes before the start. For an All-day Entry the start counts as 09:00
 * on its first day, so 0 is "on the day" and 4320 is "3 days before".
 */
export type ReminderOffset = number;

/** What a new Entry of this type is pre-filled with; none of it restricts an Entry. */
export type EntryTypeDefaults = {
  allDay?: boolean;
  /** Wall-clock "HH:mm" a new Timed Entry starts at. */
  startTime?: string;
  durationMinutes?: number;
  repetition?: Repetition | null;
  importance?: Importance;
  location?: string;
  personIds?: string[];
  notes?: string;
  reminders?: ReminderOffset[];
};

export const BUILT_IN_TYPES = [
  "birthday",
  "holiday",
  "appointment",
  "booking",
  "activity",
  "event",
  "general",
] as const;
export type BuiltInType = (typeof BUILT_IN_TYPES)[number];

/** Birthday and General keep the app's own behaviour working, so they can't be deleted. */
export const UNDELETABLE_TYPES: BuiltInType[] = ["birthday", "general"];

const DAY = 24 * 60;

/** The seven built-in Entry Types and their defaults, from the v1 spec. */
export const BUILT_IN_DEFAULTS: Record<
  BuiltInType,
  { color: string; icon: Icon; defaults: EntryTypeDefaults }
> = {
  birthday: {
    color: "#d1495b",
    icon: "cake",
    defaults: {
      allDay: true,
      repetition: { frequency: "yearly", interval: 1, end: { type: "never" } },
      reminders: [3 * DAY, 0],
    },
  },
  holiday: { color: "#f4a261", icon: "plane", defaults: { allDay: true } },
  appointment: {
    color: "#1e88e5",
    icon: "stethoscope",
    defaults: { allDay: false, durationMinutes: 60, reminders: [DAY, 60] },
  },
  booking: { color: "#8e44ad", icon: "ticket", defaults: { allDay: false, durationMinutes: 60 } },
  activity: {
    color: "#43a047",
    icon: "bike",
    defaults: {
      allDay: false,
      durationMinutes: 60,
      repetition: { frequency: "weekly", interval: 1, end: { type: "never" } },
    },
  },
  event: { color: "#c2185b", icon: "party", defaults: { allDay: false, durationMinutes: 120 } },
  general: { color: "#607d8b", icon: "calendar", defaults: {} },
};
