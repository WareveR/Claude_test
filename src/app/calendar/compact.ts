import { useSyncExternalStore } from "react";

/** Whether the week view hides its weather and Tasks to give the grid the room, per device. */
const KEY = "week-compact";
const listeners = new Set<() => void>();
let current: boolean | null = null;

function read(): boolean {
  if (current === null) {
    try {
      current = localStorage.getItem(KEY) === "1";
    } catch {
      current = false;
    }
  }
  return current;
}

export function setWeekCompact(compact: boolean) {
  current = compact;
  try {
    localStorage.setItem(KEY, compact ? "1" : "0");
  } catch {
    // Not remembered; it still applies until the page reloads.
  }
  for (const listener of listeners) listener();
}

export function useWeekCompact(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read,
    () => false,
  );
}
