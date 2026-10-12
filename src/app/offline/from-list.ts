import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * One item as a list already in the cache holds it, with when that list was fetched, so a page
 * that opens the item can show it at once instead of waiting for its own request.
 */
export function fromList<T extends { id: string }>(
  queryClient: QueryClient,
  listKey: QueryKey,
  id: string | undefined,
): { data: T; updatedAt: number } | undefined {
  if (!id) return undefined;
  let found: { data: T; updatedAt: number } | undefined;
  for (const [key, list] of queryClient.getQueriesData<T[]>({ queryKey: listKey })) {
    const state = queryClient.getQueryState(key);
    // A list marked out of date by an edit may still hold the item as it was before.
    if (!state || state.isInvalidated || !Array.isArray(list)) continue;
    const item = list.find((i) => i.id === id);
    if (item && (!found || state.dataUpdatedAt > found.updatedAt)) {
      found = { data: item, updatedAt: state.dataUpdatedAt };
    }
  }
  return found;
}
