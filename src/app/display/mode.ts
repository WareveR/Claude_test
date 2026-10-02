import { useSyncExternalStore } from "react";

/** Display Mode belongs to this browser only: a tablet on the wall, not the Family. */
const KEY = "display-mode";
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

export function setDisplayMode(on: boolean) {
  current = on;
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // Without storage Display Mode lasts until the page reloads.
  }
  for (const listener of listeners) listener();
}

export function useDisplayMode(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read,
    () => false,
  );
}
