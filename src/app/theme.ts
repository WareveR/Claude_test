import { useSyncExternalStore } from "react";

/** The colour theme belongs to this browser only, like Display Mode. */
export const THEMES = ["auto", "light", "dark", "spring", "ocean"] as const;
export type Theme = (typeof THEMES)[number];

const KEY = "theme";
const listeners = new Set<() => void>();
let current: Theme | null = null;

function read(): Theme {
  if (current === null) {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch {
      // Without storage the theme follows the device.
    }
    current = THEMES.find((t) => t === stored) ?? "auto";
  }
  return current;
}

/** Puts the theme on <html>; "auto" sets nothing so the device's light or dark setting decides. */
export function applyTheme(theme: Theme = read()) {
  if (theme === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

export function setTheme(theme: Theme) {
  current = theme;
  try {
    if (theme === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Without storage the theme lasts until the page reloads.
  }
  applyTheme(theme);
  for (const listener of listeners) listener();
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read,
    () => "auto",
  );
}
