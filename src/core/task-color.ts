import { NOTE_COLORS } from "./notes";

/**
 * The background a Task, a Task with items or one of its items may have: the Notes' paper
 * colours, light enough to tint any theme. None is the default.
 */
export const TASK_COLORS = NOTE_COLORS;
export type TaskColor = (typeof TASK_COLORS)[number];

export function isTaskColor(value: unknown): value is TaskColor {
  return typeof value === "string" && (TASK_COLORS as readonly string[]).includes(value);
}

/**
 * A body's `color`: undefined when absent (a change that doesn't mention it keeps it), null for
 * none, or one of TASK_COLORS; anything else is invalid.
 */
export function parseTaskColor(
  body: Record<string, unknown>,
): { ok: true; color: TaskColor | null | undefined } | { ok: false } {
  const color = body.color;
  if (color === undefined || color === null) return { ok: true, color };
  return isTaskColor(color) ? { ok: true, color } : { ok: false };
}
