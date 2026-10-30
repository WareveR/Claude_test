import { isPlainDate, type PlainDate } from "./plain-date";

/** Where "open …" may go: the calendar views by a day, and the app's other pages. */
export const VOICE_PLACES = [
  "day",
  "week",
  "month",
  "year",
  "agenda",
  "tasks",
  "shopping",
  "tree",
  "summary",
  "wall",
  "suggestions",
  "search",
  "settings",
] as const;

export type VoicePlace = (typeof VOICE_PLACES)[number];

export type VoiceOpen = { place: VoicePlace; date: PlainDate | null; query: string | null };

/** The model's "open" answer checked; null when it names no place the app has. */
export function parseVoiceOpen(value: Record<string, unknown>): VoiceOpen | null {
  const place = VOICE_PLACES.find((p) => p === value.place);
  if (!place) return null;
  const date = typeof value.date === "string" && isPlainDate(value.date) ? value.date : null;
  const query =
    place === "search" && typeof value.title === "string" && value.title.trim()
      ? value.title.trim().slice(0, 100)
      : null;
  return { place, date, query };
}
