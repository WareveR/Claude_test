import type { UseQueryResult } from "@tanstack/react-query";

/**
 * Whether a form may start from a query's data. The offline copy can hold an older version,
 * so while the first refetch after opening is under way the form waits for it; offline, the
 * copy is all there is and the form shows it.
 */
export function readyToEdit(
  query: Pick<UseQueryResult, "data" | "isFetchedAfterMount" | "fetchStatus">,
) {
  return (
    query.data !== undefined && (query.isFetchedAfterMount || query.fetchStatus !== "fetching")
  );
}
