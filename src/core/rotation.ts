import { daysBetween, startOfWeek, type PlainDate } from "./plain-date";

/**
 * A repeating Task's Rotation: the Persons who take turns doing it, in order. With "turn" the
 * next Person takes each new one; with "week" whose turn it is goes by the week it is due, so a
 * Task done several times a week stays with one Person all week.
 */
export type Rotation = {
  personIds: string[];
  every: "turn" | "week";
  /** Whose turn it is by the plan, as an index into personIds: the turn at `anchor`. */
  turn: number;
  /** The due date the turn was counted from; weekly turns count whole weeks from it. */
  anchor: PlainDate;
};

export const MAX_ROTATION = 12;

export function isRotation(value: unknown): value is Rotation {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    Array.isArray(r.personIds) &&
    r.personIds.length >= 2 &&
    r.personIds.length <= MAX_ROTATION &&
    r.personIds.every((p) => typeof p === "string") &&
    new Set(r.personIds).size === r.personIds.length &&
    (r.every === "turn" || r.every === "week") &&
    Number.isInteger(r.turn) &&
    (r.turn as number) >= 0 &&
    (r.turn as number) < r.personIds.length &&
    typeof r.anchor === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(r.anchor)
  );
}

/** Whose turn it is, by the plan, for the Task of this Rotation due on `dueDate`. */
export function turnFor(rotation: Rotation, dueDate: PlainDate): string {
  const n = rotation.personIds.length;
  if (rotation.every === "turn") return rotation.personIds[rotation.turn % n];
  const weeks = Math.floor(daysBetween(startOfWeek(rotation.anchor), startOfWeek(dueDate)) / 7);
  return rotation.personIds[(((rotation.turn + weeks) % n) + n) % n];
}

/** The Rotation the next Task of the series carries: the next Person's turn. */
export function nextRotation(rotation: Rotation): Rotation {
  return rotation.every === "turn"
    ? { ...rotation, turn: (rotation.turn + 1) % rotation.personIds.length }
    : rotation;
}
