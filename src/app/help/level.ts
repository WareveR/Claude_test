import { useSyncExternalStore } from "react";
import { HELP_LEVELS, type HelpLevel } from "../../core/help";

/** The help level belongs to this browser only, like the theme. */
const KEY = "helpLevel";
const DEFAULT: HelpLevel = "medium";
const listeners = new Set<() => void>();
let current: HelpLevel | null = null;

export function getHelpLevel(): HelpLevel {
  if (current === null) {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch {
      // Without storage the default applies.
    }
    current = HELP_LEVELS.find((l) => l === stored) ?? DEFAULT;
  }
  return current;
}

/** Marks <html> so the stylesheet can show the ⓘ beside field titles at the high level. */
export function applyHelpLevel(level: HelpLevel = getHelpLevel()) {
  document.documentElement.dataset.helpLevel = level;
}

export function setHelpLevel(level: HelpLevel) {
  current = level;
  try {
    if (level === DEFAULT) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, level);
  } catch {
    // Without storage the level lasts until the page reloads.
  }
  applyHelpLevel(level);
  for (const listener of listeners) listener();
}

export function useHelpLevel(): HelpLevel {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getHelpLevel,
    () => DEFAULT,
  );
}
