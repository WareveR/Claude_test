import { useSyncExternalStore } from "react";
import { NO_FILTER, parseFilter, type PersonFilter } from "../../core/person-filter";

/** The Person Filter lives in this browser only, so each device keeps its own. */
const KEY = "person-filter";
const listeners = new Set<() => void>();
let current: PersonFilter | null = null;

function read(): PersonFilter {
  if (current) return current;
  try {
    const stored = localStorage.getItem(KEY);
    current = stored ? parseFilter(JSON.parse(stored)) : NO_FILTER;
  } catch {
    current = NO_FILTER;
  }
  return current;
}

export function setPersonFilter(filter: PersonFilter) {
  current = filter;
  try {
    localStorage.setItem(KEY, JSON.stringify(filter));
  } catch {
    // Without storage the filter still applies until the page reloads.
  }
  for (const listener of listeners) listener();
}

export function usePersonFilter(): PersonFilter {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read,
    () => NO_FILTER,
  );
}
