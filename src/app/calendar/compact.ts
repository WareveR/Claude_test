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
