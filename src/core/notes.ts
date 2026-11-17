import { addDays, type PlainDate } from "./plain-date";

/**
 * A Note: a short message one Family member leaves for the others on the Wall ("há sopa no
 * frigorífico"), like a paper note on the fridge. Not an Entry: it has no time, only how long it
 * stays up.
 */
export type Note = {
  id: string;
  text: string;
  color: NoteColor;
  /** The last day it shows (Family time); null stays until someone removes it. */
  until: PlainDate | null;
  /** The name of the Person of the Account that wrote it; "" when that Account has none. */
  author: string;
  createdAt: string;
};

/** The longest Note: a few words to read across the room. */
export const MAX_NOTE = 200;

/** Paper colours, light enough for dark text in every theme. */
export const NOTE_COLORS = [
  "#fff59d",
  "#f8bbd0",
  "#bbdefb",
  "#c8e6c9",
  "#ffccbc",
  "#e1bee7",
] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export function isNoteColor(value: unknown): value is NoteColor {
  return typeof value === "string" && (NOTE_COLORS as readonly string[]).includes(value);
}

/** How long a Note stays up, as offered when writing it. */
export const NOTE_KEEPS = ["today", "tomorrow", "removed"] as const;
export type NoteKeep = (typeof NOTE_KEEPS)[number];

export function isNoteKeep(value: unknown): value is NoteKeep {
  return typeof value === "string" && (NOTE_KEEPS as readonly string[]).includes(value);
}

/** The last day a Note written today shows. */
export function noteUntil(keep: NoteKeep, today: PlainDate): PlainDate | null {
  if (keep === "today") return today;
  if (keep === "tomorrow") return addDays(today, 1);
  return null;
}

/** Whether a Note still shows today. */
export function noteShows(note: { until: string | null }, today: PlainDate): boolean {
  return note.until === null || note.until >= today;
}

const LEADS = [
  // "deixa um recado: há sopa", "deixa recado para todos que há sopa", "recado: há sopa"
  /^(?:(?:deixa|deixar|escreve|escrever|põe|pôr|p[oõ]e)\s+(?:um\s+|o\s+)?)?recado(?:\s+(?:para|a)\s+(?:todos|a\s+fam[ií]lia))?\s*(?::|,|-|que\b|a\s+dizer(?:\s+que)?)\s*(.+)$/iu,
  // "leave a note: soup in the fridge", "note for everyone: …"
  /^(?:(?:leave|write|post|put up)\s+(?:a\s+)?)?note(?:\s+for\s+(?:everyone|the\s+family))?\s*(?::|,|-|that\b|saying(?:\s+that)?)\s*(.+)$/iu,
];

/**
 * The text of a Note said in a sentence, like "deixa um recado: há sopa" or "leave a note: soup
 * in the fridge"; null when the sentence is not a Note. Needs no model.
 */
export function readNotePhrase(sentence: string): string | null {
  const text = sentence.trim().replace(/\s+/g, " ");
  for (const lead of LEADS) {
    const match = lead.exec(text);
    if (!match) continue;
    const said = match[1]
      .trim()
      .replace(/[.!]+$/u, "")
      .trim();
    if (!said) return null;
    const note = said.charAt(0).toLocaleUpperCase() + said.slice(1);
    return note.slice(0, MAX_NOTE);
  }
  return null;
}
