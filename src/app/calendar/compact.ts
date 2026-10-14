import { useSyncExternalStore } from "react";

/** A switch remembered on this device, read by every view that shows it. */
function deviceSwitch(key: string, initial: boolean) {
  const listeners = new Set<() => void>();
  let current: boolean | null = null;

  function read(): boolean {
    if (current === null) {
      try {
        const stored = localStorage.getItem(key);
        current = stored === null ? initial : stored === "1";
      } catch {
        current = initial;
      }
    }
    return current;
  }

  function set(on: boolean) {
    current = on;
    try {
      localStorage.setItem(key, on ? "1" : "0");
    } catch {
      // Not remembered; it still applies until the page reloads.
    }
    for (const listener of listeners) listener();
  }

  function use(): boolean {
    return useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      read,
      () => initial,
    );
  }

  return [use, set] as const;
}

/**
 * Whether the week view and the Wall hide the weather and the day notes (Moon, holidays, waste
 * collection) to give the grid the room.
 */
export const [useWeekCompact, setWeekCompact] = deviceSwitch("week-compact", false);

/** Whether the week view and the Wall hide the week's Tasks; they are always in the Summary. */
export const [useTasksHidden, setTasksHidden] = deviceSwitch("week-tasks-hidden", true);

/** Whether the day view shows the day's weather hour by hour under its bar. */
export const [useDayHours, setDayHours] = deviceSwitch("day-hours", false);

/** One of a few choices remembered on this device, read by every view that shows it. */
function deviceChoice<T extends string>(key: string, choices: readonly T[], initial: T) {
  const listeners = new Set<() => void>();
  let current: T | null = null;

  function read(): T {
    if (current === null) {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(key);
      } catch {
        // Without storage it starts from the default.
      }
      current = choices.find((c) => c === stored) ?? initial;
    }
    return current;
  }

  function set(choice: T) {
    current = choice;
    try {
      localStorage.setItem(key, choice);
    } catch {
      // Not remembered; it still applies until the page reloads.
    }
    for (const listener of listeners) listener();
  }

  function use(): T {
    return useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      read,
      () => initial,
    );
  }

  return [use, set] as const;
}

/**
 * What the day and week views and the Wall show: All-day Entries with the day notes (Moon, time
 * change, meteor showers…) and the Timed Entries in the hours, or only one of the two.
 */
export const GRID_LAYERS = ["both", "allDay", "timed"] as const;
export type GridLayers = (typeof GRID_LAYERS)[number];
export const [useGridLayers, setGridLayers] = deviceChoice<GridLayers>(
  "grid-layers",
  GRID_LAYERS,
  "both",
);
