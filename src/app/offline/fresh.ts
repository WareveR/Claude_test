import type { UseQueryResult } from "@tanstack/react-query";

/** Data fetched this recently is as good as fresh: every list refreshes once a minute. */
const FRESH_MS = 60_000;

/**
 * Whether a form may start from a query's data. The offline copy can hold an older version,
 * so while the first refetch after opening is under way the form waits for it, unless what it
 * has was fetched in the last minute; offline, the copy is all there is and the form shows it.
 */
export function readyToEdit(
  query: Pick<UseQueryResult, "data" | "isFetchedAfterMount" | "fetchStatus" | "dataUpdatedAt">,
  now = Date.now(),
) {
  return (
    query.data !== undefined &&
    (query.isFetchedAfterMount ||
      query.fetchStatus !== "fetching" ||
      now - query.dataUpdatedAt < FRESH_MS)
  );
}
