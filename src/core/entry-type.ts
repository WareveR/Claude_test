import type { Repetition } from "./repetition";

export const IMPORTANCES = ["low", "normal", "high"] as const;
export type Importance = (typeof IMPORTANCES)[number];

/**
 * The app's fixed icon set for Entry Types and Entries, in groups for the picker; the views draw
 * them as line icons. Keys are stored, so a key is never renamed or removed.
 */
export const ICON_GROUPS = [
  {
    id: "general",
    icons: ["calendar", "star", "pin", "sun", "moon", "umbrella", "snowflake", "bell", "alarm"],
  },
  {
    id: "beauty",
    icons: [
      "massage",
      "eyebrows",
      "waxing",
      "haircut",
      "nails",
      "spa",
      "bath",
      "shower",
      "makeup",
      "perfume",
    ],
  },
  {
    id: "sport",
    icons: [
      "gym",
      "swimming",
      "running",
      "bike",
      "yoga",
      "football",
      "volleyball",
      "hiking",
      "ski",
      "sailing",
      "activity",
      "medal",
      "trophy",
    ],
  },
  {
    id: "health",
    icons: [
      "stethoscope",
      "heartPulse",
      "pill",
      "vaccine",
      "hospital",
      "dentist",
      "glasses",
      "ear",
      "brain",
      "bone",
      "ambulance",
    ],
  },
  {
    id: "food",
    icons: [
      "utensils",
      "coffee",
      "pizza",
      "salad",
      "soup",
      "cooking",
      "chef",
      "wine",
      "beer",
      "iceCream",
      "apple",
      "cake",
    ],
  },
  {
    id: "home",
    icons: [
      "home",
      "cleaning",
      "laundry",
      "repair",
      "diy",
      "painting",
      "garden",
      "plants",
      "rubbish",
      "recycle",
      "key",
      "sofa",
      "bed",
    ],
  },
  {
    id: "people",
    icons: [
      "baby",
      "family",
      "person",
      "meeting",
      "help",
      "heart",
      "party",
      "gift",
      "church",
      "call",
      "chat",
    ],
  },
  { id: "pets", icons: ["dog", "cat", "fish", "bird", "rabbit", "paw"] },
  {
    id: "work",
    icons: [
      "briefcase",
      "school",
      "backpack",
      "pencil",
      "book",
      "library",
      "laptop",
      "calculator",
      "document",
      "mail",
      "office",
      "phone",
      "video",
    ],
  },
  {
    id: "money",
    icons: ["cart", "bag", "store", "shirt", "bank", "card", "wallet", "savings", "receipt"],
  },
  {
    id: "travel",
    icons: [
      "plane",
      "car",
      "train",
      "bus",
      "taxi",
      "ship",
      "fuel",
      "luggage",
      "hotel",
      "tent",
      "trees",
      "beach",
    ],
  },
  {
    id: "leisure",
    icons: [
      "ticket",
      "music",
      "film",
      "tv",
      "game",
      "camera",
      "guitar",
      "piano",
      "drum",
      "palette",
      "singing",
      "theatre",
      "museum",
      "popcorn",
    ],
  },
] as const;
export type IconGroup = (typeof ICON_GROUPS)[number]["id"];
export type Icon = (typeof ICON_GROUPS)[number]["icons"][number];
export const ICONS: readonly Icon[] = ICON_GROUPS.flatMap((group) => group.icons);

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
  "beauty",
  "meal",
  "home",
  "pet",
  "work",
  "school",
  "payment",
  "general",
] as const;
export type BuiltInType = (typeof BUILT_IN_TYPES)[number];

/**
 * One colour per icon group, the colours Entry Types choose from; each built-in type takes its
 * group's. None of them is a Person's colour (persons/model.ts), so the two never get mixed up.
 */
export const TYPE_COLORS: Record<IconGroup, string> = {
  people: "#e53935",
  beauty: "#d81b60",
  leisure: "#8e24aa",
  work: "#3949ab",
  health: "#1e88e5",
  travel: "#00acc1",
  money: "#00897b",
  sport: "#43a047",
  pets: "#9e9d24",
  food: "#f57c00",
  home: "#8d6e63",
  general: "#607d8b",
};

/** Birthday and General keep the app's own behaviour working, so they can't be deleted. */
export const UNDELETABLE_TYPES: BuiltInType[] = ["birthday", "general"];

const DAY = 24 * 60;

/** The built-in Entry Types and their defaults: the v1 spec's seven and one more per icon group. */
export const BUILT_IN_DEFAULTS: Record<
  BuiltInType,
  { color: string; icon: Icon; defaults: EntryTypeDefaults }
> = {
  birthday: {
    color: TYPE_COLORS.people,
    icon: "cake",
    defaults: {
      allDay: true,
      repetition: { frequency: "yearly", interval: 1, end: { type: "never" } },
      reminders: [3 * DAY, 0],
    },
  },
  holiday: { color: TYPE_COLORS.travel, icon: "plane", defaults: { allDay: true } },
  appointment: {
    color: TYPE_COLORS.health,
    icon: "stethoscope",
    defaults: { allDay: false, durationMinutes: 60, reminders: [DAY, 60] },
  },
  booking: {
    color: TYPE_COLORS.leisure,
    icon: "ticket",
    defaults: { allDay: false, durationMinutes: 60 },
  },
  activity: {
    color: TYPE_COLORS.sport,
    icon: "bike",
    defaults: {
      allDay: false,
      durationMinutes: 60,
      repetition: { frequency: "weekly", interval: 1, end: { type: "never" } },
    },
  },
  event: {
    color: TYPE_COLORS.people,
    icon: "party",
    defaults: { allDay: false, durationMinutes: 120 },
  },
  beauty: {
    color: TYPE_COLORS.beauty,
    icon: "massage",
    defaults: { allDay: false, durationMinutes: 60, reminders: [DAY] },
  },
  meal: {
    color: TYPE_COLORS.food,
    icon: "utensils",
    defaults: { allDay: false, durationMinutes: 90 },
  },
  home: { color: TYPE_COLORS.home, icon: "home", defaults: { allDay: false, durationMinutes: 60 } },
  pet: {
    color: TYPE_COLORS.pets,
    icon: "paw",
    defaults: { allDay: false, durationMinutes: 30, reminders: [DAY] },
  },
  work: {
    color: TYPE_COLORS.work,
    icon: "briefcase",
    defaults: { allDay: false, durationMinutes: 60 },
  },
  school: {
    color: TYPE_COLORS.work,
    icon: "school",
    defaults: { allDay: false, durationMinutes: 60 },
  },
  payment: {
    color: TYPE_COLORS.money,
    icon: "card",
    defaults: { allDay: true, importance: "high", reminders: [3 * DAY, 0] },
  },
  general: { color: TYPE_COLORS.general, icon: "calendar", defaults: {} },
};

/** A title's words, lower case and without accents: "Natação às 10h" → natacao, as, 10h. */
export function titleWords(title: string): string[] {
  return title
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/);
}

/** Words in an Entry's title that name an icon of their own, in either language. */
const ICON_WORDS: [Icon, string[]][] = [
  ["gym", ["ginasio", "gym", "treino", "workout", "musculacao"]],
  ["swimming", ["natacao", "piscina", "swimming", "swim"]],
  ["running", ["corrida", "running", "jogging"]],
  ["football", ["futebol", "football", "soccer"]],
  ["yoga", ["yoga", "ioga", "pilates"]],
  ["music", ["musica", "music"]],
  ["church", ["catequese", "catechism", "missa"]],
  ["tent", ["escuteiros", "escuteiro", "scouts"]],
  ["cart", ["supermercado", "groceries"]],
  ["dentist", ["dentista", "dentist"]],
];

/**
 * The icon a new Entry gets. A built-in Entry Type is a whole group ("Activity" draws a bike), so
 * an Entry whose title names an icon of its own ("Ginásio" → the gym) takes that one; anything
 * else, and every Entry of a type the Family made, gets none and shows its type's icon.
 */
export function newEntryIcon(
  title: string,
  type: { builtinKey?: string | null; icon?: string | null },
): Icon | null {
  if (!type.builtinKey) return null;
  const said = new Set(titleWords(title));
  const named = ICON_WORDS.find(([, keys]) => keys.some((k) => said.has(k)))?.[0] ?? null;
  return named === type.icon ? null : named;
}
