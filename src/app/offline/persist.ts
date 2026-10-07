import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { Query, QueryClient } from "@tanstack/react-query";
import { APP_VERSION } from "../../core/version";

/** Where this device keeps its copy of the calendar for reading offline. */
export const PERSIST_KEY = "offlineCopy";

function storage() {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export const persister = createSyncStoragePersister({ storage: storage(), key: PERSIST_KEY });

/**
 * Lazily loaded libraries are cached as queries, but they are code, not data: stored as JSON they
 * come back as plain objects without their functions and break the app on the next start.
 */
const LIBRARIES = ["date-holidays", "astronomy-engine"];

export const persistOptions = {
  persister,
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Query) =>
      query.state.status === "success" && !LIBRARIES.includes(String(query.queryKey[0])),
  },
  // Also the queries' gcTime, so it must stay under the 2^31 ms timer limit (~24.8 days):
  // a longer timeout fires at once and empties the restored copy.
  maxAge: 24 * 24 * 60 * 60 * 1000,
  // A new version starts from a fresh copy, so old shapes are never read.
  buster: APP_VERSION,
};

/**
 * A signed-out or revoked device keeps nothing: every cached answer and the stored copy go at
 * once. Only the sign-in status stays, so the app knows to show sign-in.
 */
export function wipeOfflineCopy(queryClient: QueryClient) {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "status" });
  try {
    storage()?.removeItem(PERSIST_KEY);
  } catch {
    // Nothing stored, nothing to wipe.
  }
}
