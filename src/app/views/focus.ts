import type { PlainDate } from "../../core/plain-date";

const KEY = "focus-day";
let focus: PlainDate | null = null;

/** The day last in focus (the day view's, or a day picked in the month or year), for this tab. */
export function focusedDay(): PlainDate | null {
  if (focus === null) {
    try {
      focus = sessionStorage.getItem(KEY);
    } catch {
      // Without storage it starts with none.
    }
  }
  return focus;
}

export function setFocusedDay(day: PlainDate) {
  focus = day;
  try {
    sessionStorage.setItem(KEY, day);
  } catch {
    // Kept until the page reloads.
  }
}
